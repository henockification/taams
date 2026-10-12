// Minimal typings for the `smpp` package (node-smpp), which ships without types.
declare module 'smpp' {
  import { EventEmitter } from 'node:events';

  export interface PDU {
    command: string;
    command_status: number;
    sequence_number: number;
    message_id?: string;
    receipted_message_id?: string;
    message_state?: number;
    source_addr?: string;
    destination_addr?: string;
    esm_class?: number;
    short_message?: string | Buffer | { udh?: Buffer; message: string | Buffer };
    response(options?: Record<string, unknown>): PDU;
    [key: string]: unknown;
  }

  type Command = (
    options?: Record<string, unknown>,
    responseCallback?: (pdu: PDU) => void,
    sendCallback?: (pdu: PDU) => void,
    failureCallback?: (pdu: PDU, error?: Error) => void,
  ) => boolean;

  export interface Session extends EventEmitter {
    closed: boolean;
    bind_transceiver: Command;
    bind_transmitter: Command;
    submit_sm: Command;
    enquire_link: Command;
    unbind: Command;
    send(pdu: PDU, responseCallback?: (pdu: PDU) => void): boolean;
    close(callback?: () => void): void;
    destroy(callback?: () => void): void;
  }

  export function connect(options: Record<string, unknown>, listener?: (session: Session) => void): Session;
  export const errors: Record<string, number>;

  const smpp: {
    connect: typeof connect;
    errors: typeof errors;
  };
  export default smpp;
}
