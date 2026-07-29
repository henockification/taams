import ZKLib from "node-zklib";

type TcpDevice = {
  id: string;
  serialNumber: string;
  ipAddress: string;
  port: number;
  communicationKey?: number;
};

export async function syncOneDevice(device: TcpDevice) {
  console.log(`Syncing ZKTeco device ${device.serialNumber}`);

  const zk = new ZKLib(
    device.ipAddress,
    device.port || 4370,
    10000,
    4000,
  );

  try {
    await zk.createSocket();

    const attendances = await zk.getAttendances();
    const logs = attendances?.data ?? [];

    for (const log of logs) {
      const biometricId = String(log.deviceUserId ?? log.userId);
      const recordTime = log.recordTime ?? log.attTime;

      if (!recordTime) {
        console.warn("Skipping ZKTeco TCP punch without record time", log);
        continue;
      }

      const punchTime = new Date(recordTime);

      const externalUid = [
        device.serialNumber,
        biometricId,
        punchTime.toISOString(),
      ].join("_");

      // Reuse the same ingestion logic used by PUSH_ADMS:
      // await saveAttendancePunch({
      //   deviceId: device.id,
      //   biometricId,
      //   punchTime,
      //   externalUid,
      //   punchType: mapZktecoPunchType(log.type ?? log.recordType),
      //   source: "DEVICE",
      //   rawPayload: log,
      // });

      console.log("TCP punch", {
        biometricId,
        punchTime,
        externalUid,
      });
    }

    // await markDevicePullSuccess(device.id);
  } catch (error) {
    // await markDevicePullFailed(device.id, String(error));
    console.error(`Failed syncing device ${device.serialNumber}`, error);
  } finally {
    try {
      await zk.disconnect();
    } catch {
      // Ignore disconnect errors; the sync failure above is the actionable error.
    }
  }
}
