import { createHash } from 'node:crypto';

export type PlannerUser = {
  pin: string;
  employeeId: string | null;
  // null when the PIN is not linked to a TAAMS employee (still copied: the master is the source).
  employeeActive: boolean | null;
  templatesHash: string;
};

export type PlannerDevice = {
  deviceId: string;
  // Master: only removals are ever sent to it.
  removalsOnly: boolean;
  roster: Map<string, string | null>;
  excludedEmployeeIds: Set<string>;
};

export type DevicePlan = {
  deviceId: string;
  add: string[];
  update: string[];
  remove: string[];
  // Removals found but held back because the run did not allow removals.
  heldRemovals: string[];
  // PINs on the device that TAAMS does not know; never touched.
  unknownOnDevice: string[];
};

// Hash of a user's template set, compared with the roster to decide whether to re-send.
export function computeTemplatesHash(templateHashes: string[]) {
  return createHash('sha256').update([...templateHashes].sort().join('|')).digest('hex');
}

function isWanted(user: PlannerUser, device: PlannerDevice) {
  if (user.employeeId && device.excludedEmployeeIds.has(user.employeeId)) return false;
  return user.employeeActive !== false;
}

export function planDeviceSync(device: PlannerDevice, users: PlannerUser[], allowRemovals: boolean): DevicePlan {
  const plan: DevicePlan = { deviceId: device.deviceId, add: [], update: [], remove: [], heldRemovals: [], unknownOnDevice: [] };
  const usersByPin = new Map(users.map((user) => [user.pin, user]));

  if (!device.removalsOnly) {
    for (const user of users) {
      if (!isWanted(user, device)) continue;
      if (!device.roster.has(user.pin)) {
        plan.add.push(user.pin);
      } else if (device.roster.get(user.pin) !== user.templatesHash) {
        plan.update.push(user.pin);
      }
    }
  }

  for (const pin of device.roster.keys()) {
    const user = usersByPin.get(pin);
    if (!user) {
      plan.unknownOnDevice.push(pin);
      continue;
    }
    if (isWanted(user, device)) continue;
    (allowRemovals ? plan.remove : plan.heldRemovals).push(pin);
  }

  return plan;
}
