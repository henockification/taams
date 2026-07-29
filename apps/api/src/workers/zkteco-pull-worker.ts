import { syncOneDevice } from "../lib/zkteco/tcp-sync-service";

const INTERVAL_MS = Number(process.env.ZK_SYNC_INTERVAL_MS ?? 5 * 60 * 1000);

async function main() {
  console.log("ZKTeco TCP pull worker started");

  while (true) {
    try {
      await syncAllTcpPullDevices();
    } catch (error) {
      console.error("ZKTeco worker cycle failed", error);
    }

    await sleep(INTERVAL_MS);
  }
}

async function syncAllTcpPullDevices() {
  // Replace with DB query:
  // integration_mode IN ('TCP_PULL', 'HYBRID')
  // pull_enabled = true
  // auto_sync_enabled = true

  const devices = [
    {
      id: "device-id",
      serialNumber: "D3PRO001",
      ipAddress: "192.168.1.50",
      port: 4370,
      communicationKey: 0,
    },
  ];

  for (const device of devices) {
    await syncOneDevice(device);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("Fatal ZKTeco worker error", error);
  process.exit(1);
});
