import { EventEmitter } from 'node:events';
import smpp, { type PDU, type Session } from 'smpp';
import { DATA_CODING, buildConcatUdh, splitSms, toSmppDestination } from './segment';

export type SmppConfig = {
  host: string;
  port: number;
  systemId: string;
  password: string;
  systemType: string;
  bindMode: 'TRX' | 'TX';
  sourceAddr: string;
  sourceTon: number;
  sourceNpi: number;
  enquireLinkMs: number;
  maxTps: number;
  submitTimeoutMs: number;
  registeredDelivery: boolean;
  localAddress?: string;
};

export type SmppState = 'idle' | 'connecting' | 'bound' | 'down' | 'stopped';

export type SmppSendResult = {
  messageIds: string[];
  parts: number;
  encoding: 'GSM' | 'UCS2';
};

export class SmppSubmitError extends Error {
  constructor(message: string, readonly commandStatus: number | null) {
    super(message);
    this.name = 'SmppSubmitError';
  }
}

export class SmppNotBoundError extends Error {
  constructor(state: SmppState) {
    super(`SMPP session is not bound (state: ${state})`);
    this.name = 'SmppNotBoundError';
  }
}

const ESME_ROK = 0x0000;
const ESME_RTHROTTLED = 0x0058;
const MAX_RECONNECT_DELAY_MS = 60_000;

const STATUS_NAMES = new Map(Object.entries(smpp.errors).map(([name, id]) => [id, name]));

export function smppStatusName(status: number) {
  return STATUS_NAMES.get(status) ?? `0x${status.toString(16).padStart(4, '0')}`;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function numberEnv(name: string, fallback: number) {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
}

export function readSmppConfigFromEnv(): SmppConfig {
  return {
    host: requiredEnv('SMPP_HOST'),
    port: numberEnv('SMPP_PORT', 2775),
    systemId: requiredEnv('SMPP_SYSTEM_ID'),
    password: requiredEnv('SMPP_PASSWORD'),
    systemType: process.env.SMPP_SYSTEM_TYPE?.trim() ?? '',
    bindMode: process.env.SMPP_BIND_MODE?.trim().toUpperCase() === 'TX' ? 'TX' : 'TRX',
    sourceAddr: requiredEnv('SMPP_SOURCE_ADDR'),
    // Short codes are usually TON 0 (unknown) / NPI 1; alphanumeric sender IDs use TON 5 / NPI 0.
    sourceTon: numberEnv('SMPP_SOURCE_TON', 0),
    sourceNpi: numberEnv('SMPP_SOURCE_NPI', 1),
    enquireLinkMs: numberEnv('SMPP_ENQUIRE_LINK_MS', 30_000),
    maxTps: numberEnv('SMPP_MAX_TPS', 10),
    submitTimeoutMs: numberEnv('SMPP_SUBMIT_TIMEOUT_MS', 10_000),
    registeredDelivery: process.env.SMPP_REGISTERED_DELIVERY?.trim().toLowerCase() === 'true',
    localAddress: process.env.SMPP_LOCAL_ADDRESS?.trim() || undefined,
  };
}

/**
 * Holds one long-lived SMPP bind to the SMSC and reconnects with backoff when it drops.
 * Emits: 'state' (SmppState), 'deliver_sm' (PDU).
 */
export class SmppClient extends EventEmitter {
  private session: Session | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelayMs = 1_000;
  private nextSlotAt = 0;
  private concatReference = Math.floor(Math.random() * 256);
  private pending = new Set<(error: Error) => void>();
  state: SmppState = 'idle';
  lastError: string | null = null;

  constructor(private readonly config: SmppConfig) {
    super();
  }

  start() {
    if (this.state !== 'idle' && this.state !== 'stopped') return;
    this.connect();
  }

  async stop() {
    this.setState('stopped');
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const session = this.session;
    this.session = null;
    if (!session || session.closed) return;
    await new Promise<void>((resolve) => {
      const done = () => session.close(resolve);
      const timer = setTimeout(done, 2_000);
      session.unbind({}, () => {
        clearTimeout(timer);
        done();
      });
    });
  }

  waitUntilBound(timeoutMs: number) {
    if (this.state === 'bound') return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off('state', onState);
        reject(new Error(`SMPP bind not established within ${timeoutMs}ms (last error: ${this.lastError ?? 'none'})`));
      }, timeoutMs);
      const onState = (state: SmppState) => {
        if (state !== 'bound') return;
        clearTimeout(timer);
        this.off('state', onState);
        resolve();
      };
      this.on('state', onState);
    });
  }

  async send(to: string, text: string): Promise<SmppSendResult> {
    const destination = toSmppDestination(to);
    if (!/^\d{8,15}$/.test(destination)) throw new SmppSubmitError(`Invalid destination number: ${to}`, null);

    const { encoding, parts } = splitSms(text);
    const reference = this.nextConcatReference();
    const messageIds: string[] = [];

    for (const [index, part] of parts.entries()) {
      const multipart = parts.length > 1;
      const params: Record<string, unknown> = {
        source_addr_ton: this.config.sourceTon,
        source_addr_npi: this.config.sourceNpi,
        source_addr: this.config.sourceAddr,
        dest_addr_ton: 1,
        dest_addr_npi: 1,
        destination_addr: destination,
        data_coding: DATA_CODING[encoding],
        esm_class: multipart ? 0x40 : 0x00,
        // Only request a receipt for the last part so one SMS yields one DLR.
        registered_delivery: this.config.registeredDelivery && index === parts.length - 1 ? 1 : 0,
        short_message: multipart
          ? { udh: buildConcatUdh(reference, parts.length, index + 1), message: part }
          : part,
      };
      const response = await this.submitWithThrottleRetry(params);
      messageIds.push(response.message_id ?? '');
    }

    return { messageIds, parts: parts.length, encoding };
  }

  private async submitWithThrottleRetry(params: Record<string, unknown>) {
    try {
      return await this.submit(params);
    } catch (error) {
      if (!(error instanceof SmppSubmitError) || error.commandStatus !== ESME_RTHROTTLED) throw error;
      await sleep(1_000);
      return this.submit(params);
    }
  }

  private async submit(params: Record<string, unknown>) {
    await this.throttle();
    const session = this.session;
    if (!session || this.state !== 'bound') throw new SmppNotBoundError(this.state);

    return new Promise<PDU>((resolve, reject) => {
      const fail = (error: Error) => {
        clearTimeout(timer);
        this.pending.delete(fail);
        reject(error);
      };
      const timer = setTimeout(
        () => fail(new SmppSubmitError(`submit_sm timed out after ${this.config.submitTimeoutMs}ms`, null)),
        this.config.submitTimeoutMs,
      );
      this.pending.add(fail);

      session.submit_sm(
        params,
        (pdu) => {
          if (pdu.command_status !== ESME_ROK) {
            fail(new SmppSubmitError(`SMSC rejected submit_sm: ${smppStatusName(pdu.command_status)}`, pdu.command_status));
            return;
          }
          clearTimeout(timer);
          this.pending.delete(fail);
          resolve(pdu);
        },
        undefined,
        (pdu, error) => fail(new SmppSubmitError(
          `submit_sm could not be written: ${error?.message ?? smppStatusName(pdu.command_status)}`,
          pdu.command_status,
        )),
      );
    });
  }

  private async throttle() {
    const interval = 1_000 / Math.max(this.config.maxTps, 1);
    const now = Date.now();
    const slot = Math.max(now, this.nextSlotAt);
    this.nextSlotAt = slot + interval;
    if (slot > now) await sleep(slot - now);
  }

  private nextConcatReference() {
    this.concatReference = (this.concatReference + 1) % 256;
    return this.concatReference;
  }

  private connect() {
    this.setState('connecting');
    const session = smpp.connect({
      url: `smpp://${this.config.host}:${this.config.port}`,
      auto_enquire_link_period: this.config.enquireLinkMs,
      connectTimeout: 15_000,
      ...(this.config.localAddress ? { localAddress: this.config.localAddress } : {}),
    });
    this.session = session;

    session.on('connect', () => {
      const bind = this.config.bindMode === 'TX' ? session.bind_transmitter : session.bind_transceiver;
      bind.call(session, {
        system_id: this.config.systemId,
        password: this.config.password,
        system_type: this.config.systemType,
        interface_version: 0x34,
      }, (pdu: PDU) => {
        if (pdu.command_status === ESME_ROK) {
          this.reconnectDelayMs = 1_000;
          this.lastError = null;
          this.setState('bound');
          return;
        }
        this.lastError = `bind failed: ${smppStatusName(pdu.command_status)}`;
        console.error(`SMPP ${this.lastError}`);
        session.close();
      });
    });

    session.on('enquire_link', (pdu: PDU) => session.send(pdu.response()));
    session.on('deliver_sm', (pdu: PDU) => {
      session.send(pdu.response());
      this.emit('deliver_sm', pdu);
    });
    session.on('unbind', (pdu: PDU) => {
      session.send(pdu.response());
      session.close();
    });
    session.on('error', (error: Error) => {
      this.lastError = error.message;
      console.error('SMPP socket error', error.message);
    });
    session.on('close', () => {
      if (this.session !== session) return;
      this.session = null;
      for (const fail of [...this.pending]) fail(new SmppSubmitError('SMPP connection closed before submit_sm_resp', null));
      if (this.state === 'stopped') return;
      this.setState('down');
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
    console.warn(`SMPP reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.state !== 'stopped') this.connect();
    }, delay);
  }

  private setState(state: SmppState) {
    if (this.state === state) return;
    this.state = state;
    this.emit('state', state);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
