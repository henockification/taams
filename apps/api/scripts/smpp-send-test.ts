// One-shot SMPP connectivity check. Run on the host with the whitelisted LAN IP:
//   npx tsx --env-file=.env scripts/smpp-send-test.ts 2519XXXXXXXX "TAAMS test message"
// Binds, sends one SMS, waits briefly for a delivery receipt, then unbinds.
import type { PDU } from 'smpp';
import { SmppClient, readSmppConfigFromEnv } from '../lib/sms/smpp-client';

const [to, ...words] = process.argv.slice(2);
const message = words.join(' ') || 'TAAMS SMPP test message';

if (!to) {
  console.error('Usage: tsx scripts/smpp-send-test.ts <phone> [message]');
  process.exit(1);
}

const config = readSmppConfigFromEnv();
const client = new SmppClient({ ...config, registeredDelivery: true });

client.on('state', (state) => console.log('state:', state));
client.on('deliver_sm', (pdu: PDU) => {
  console.log('deliver_sm:', {
    from: pdu.source_addr,
    receiptedMessageId: pdu.receipted_message_id,
    messageState: pdu.message_state,
    shortMessage: pdu.short_message,
  });
});

console.log(`Connecting to ${config.host}:${config.port} as ${config.systemId} (${config.bindMode})`
  + (config.localAddress ? ` from ${config.localAddress}` : ''));
client.start();

try {
  await client.waitUntilBound(20_000);
  const result = await client.send(to, message);
  console.log('submit_sm ok:', result);
  console.log('Waiting 30s for a delivery receipt...');
  await new Promise((resolve) => setTimeout(resolve, 30_000));
} catch (error) {
  console.error('FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.stop();
}
