import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { PDU } from "smpp";
import {
  SmppClient,
  SmppNotBoundError,
  SmppSubmitError,
  readSmppConfigFromEnv,
} from "../../lib/sms/smpp-client";

// Internal HTTP -> SMPP bridge. Run exactly one instance, on the host that owns the
// LAN IP Ethio Telecom whitelisted. The API reaches it through SMS_GATEWAY_URL.

const PORT = Number(process.env.SMS_GATEWAY_PORT ?? 3090);
const HOST = process.env.SMS_GATEWAY_HOST ?? "0.0.0.0";
const TOKEN = process.env.SMS_GATEWAY_TOKEN?.trim();
const MAX_BODY_BYTES = 16 * 1024;

if (!TOKEN) {
  console.error("SMS_GATEWAY_TOKEN is not configured");
  process.exit(1);
}

const config = readSmppConfigFromEnv();
const client = new SmppClient(config);

client.on("state", (state) => console.log("SMPP state", { state, host: config.host, port: config.port }));
client.on("deliver_sm", (pdu: PDU) => {
  console.log("SMPP deliver_sm", {
    from: pdu.source_addr,
    receiptedMessageId: pdu.receipted_message_id ?? null,
    messageState: pdu.message_state ?? null,
    isReceipt: Boolean((pdu.esm_class ?? 0) & 0x04),
  });
});

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error("SMS gateway request failed", error);
    sendJson(res, 500, { error: "Internal error" });
  });
});

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/health") {
    const bound = client.state === "bound";
    sendJson(res, bound ? 200 : 503, { state: client.state, lastError: client.lastError });
    return;
  }

  if (req.method !== "POST" || url.pathname !== "/send") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (!isAuthorized(req.headers.authorization)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  let body: { to?: unknown; message?: unknown };
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: "Body must be JSON" });
    return;
  }

  if (typeof body.to !== "string" || typeof body.message !== "string" || !body.message.trim()) {
    sendJson(res, 400, { error: "`to` and `message` are required strings" });
    return;
  }

  try {
    const result = await client.send(body.to, body.message);
    sendJson(res, 200, {
      messageId: result.messageIds.at(-1) ?? null,
      messageIds: result.messageIds,
      parts: result.parts,
      encoding: result.encoding,
    });
  } catch (error) {
    if (error instanceof SmppNotBoundError) {
      sendJson(res, 503, { error: error.message });
      return;
    }
    if (error instanceof SmppSubmitError) {
      sendJson(res, 502, { error: error.message, commandStatus: error.commandStatus });
      return;
    }
    throw error;
  }
}

function isAuthorized(header: string | undefined) {
  const expected = Buffer.from(`Bearer ${TOKEN}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  if (res.headersSent) return;
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function shutdown(signal: string) {
  console.log(`SMS gateway received ${signal}, unbinding`);
  server.close();
  await client.stop();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

client.start();
server.listen(PORT, HOST, () => {
  console.log("SMS gateway listening", {
    port: PORT,
    smsc: `${config.host}:${config.port}`,
    bindMode: config.bindMode,
    systemId: config.systemId,
    sourceAddr: config.sourceAddr,
    localAddress: config.localAddress ?? null,
  });
});
