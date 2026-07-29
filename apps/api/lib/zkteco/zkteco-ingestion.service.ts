import { IngestZktecoPushInput } from "../../types/zkteco";
import { parseZktecoAttLog } from "./parse-zkteco-attlog";

export async function ingestZktecoPush(input: IngestZktecoPushInput) {
  const { serialNumber, table, rawBody, query } = input;

  // 1. Find device by serial number
  // const device = await db.biometricDevice.findFirst({
  //   where: { serialNumber, isActive: true },
  // });

  // if (!device) {
  //   throw new Error(`Unknown ZKTeco device: ${serialNumber}`);
  // }

  if (table?.toUpperCase() !== "ATTLOG") {
    console.log("Ignoring non-attendance ZKTeco table", { table });
    return;
  }

  const punches = parseZktecoAttLog(rawBody);

  for (const punch of punches) {
    const externalUid = [
      serialNumber,
      punch.biometricId,
      punch.punchTime.toISOString(),
    ].join("_");

    // 2. Find employee by biometric_id
    // const employee = await db.employee.findFirst({
    //   where: { biometricId: punch.biometricId },
    // });

    // 3. Insert punch with duplicate protection
    // await db.attendancePunch.upsert({
    //   where: {
    //     deviceId_externalUid: {
    //       deviceId: device.id,
    //       externalUid,
    //     },
    //   },
    //   update: {},
    //   create: {
    //     employeeId: employee?.id ?? null,
    //     biometricId: punch.biometricId,
    //     deviceId: device.id,
    //     punchTime: punch.punchTime,
    //     punchType: mapZktecoPunchType(punch.inOutMode),
    //     verificationType: punch.verifyMode,
    //     externalUid,
    //     source: "DEVICE",
    //     isManual: false,
    //     rawPayload: {
    //       serialNumber,
    //       table,
    //       query,
    //       rawLine: punch.rawLine,
    //     },
    //   },
    // });

    console.log("Parsed punch", {
      biometricId: punch.biometricId,
      punchTime: punch.punchTime,
      externalUid,
    });
  }

  // 4. Update device health
  // await db.biometricDevice.update({
  //   where: { id: device.id },
  //   data: {
  //     lastPushAt: new Date(),
  //     lastSeenAt: new Date(),
  //     healthStatus: "ONLINE",
  //   },
  // });
}

function mapZktecoPunchType(inOutMode?: string) {
  switch (inOutMode) {
    case "0":
      return "IN";
    case "1":
      return "OUT";
    case "2":
      return "BREAK_OUT";
    case "3":
      return "BREAK_IN";
    default:
      return "UNKNOWN";
  }
}