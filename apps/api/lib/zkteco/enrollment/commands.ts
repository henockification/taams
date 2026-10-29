import type { DeviceCommandReply, EnrollmentTemplate, EnrollmentUser } from './types';

// ZKTeco ADMS (PUSH) command text. Each line goes to the device as "C:<id>:<command>".
function clean(value: string | number | null | undefined) {
  return String(value ?? '').replace(/[\t\r\n]/g, ' ').trim();
}

export function buildUserUpsertCommand(user: EnrollmentUser) {
  return [
    `DATA UPDATE USERINFO PIN=${clean(user.pin)}`,
    `Name=${clean(user.name)}`,
    `Pri=${user.privilege ?? 0}`,
    `Passwd=${clean(user.password)}`,
    `Card=${clean(user.card)}`,
    'Grp=1',
    'TZ=0000000000000000',
    'Verify=0',
  ].join('\t');
}

export function buildBiodataUpsertCommand(template: EnrollmentTemplate) {
  return [
    `DATA UPDATE BIODATA Pin=${clean(template.pin)}`,
    `No=${template.bioNo}`,
    `Index=${template.bioIndex}`,
    `Valid=${template.valid}`,
    `Duress=${template.duress}`,
    `Type=${template.bioType}`,
    `MajorVer=${template.majorVer}`,
    `MinorVer=${template.minorVer}`,
    `Format=${template.format}`,
    `Tmp=${template.template}`,
  ].join('\t');
}

// Deleting the user also removes all of its templates on the device.
export function buildUserDeleteCommand(pin: string) {
  return `DATA DELETE USERINFO PIN=${clean(pin)}`;
}

export const QUERY_ALL_USERS_COMMAND = 'DATA QUERY USERINFO';

export function buildBiodataQueryCommand(bioType: number) {
  return `DATA QUERY BIODATA Type=${bioType}`;
}

export function formatCommandLine(id: number, command: string) {
  return `C:${id}:${command}`;
}

// devicecmd body: one "ID=12&Return=0&CMD=DATA" line per executed command.
export function parseDeviceCommandReplies(body: string): DeviceCommandReply[] {
  const replies: DeviceCommandReply[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const params = new URLSearchParams(line);
    const id = Number.parseInt(params.get('ID') ?? '', 10);
    const returnCode = Number.parseInt(params.get('Return') ?? '', 10);
    if (!Number.isFinite(id) || !Number.isFinite(returnCode)) continue;
    replies.push({ id, returnCode, cmd: params.get('CMD') });
  }
  return replies;
}

// Reply to the device's "GET /iclock/cdata?options=all" handshake. AttLog/AttPhoto are left
// out of TransFlag on purpose: punches keep coming only through TCP pull.
export function buildHandshakeOptions(serialNumber: string, options: { delaySeconds?: number; timeZone?: number } = {}) {
  return [
    `GET OPTION FROM: ${serialNumber}`,
    'ATTLOGStamp=None',
    'OPERLOGStamp=9999',
    'ATTPHOTOStamp=None',
    'ErrorDelay=30',
    `Delay=${options.delaySeconds ?? 10}`,
    'TransTimes=00:00;14:05',
    'TransInterval=1',
    'TransFlag=TransData OpLog\tEnrollUser\tChgUser\tEnrollFP\tChgFP\tFACE\tBIODATA',
    `TimeZone=${options.timeZone ?? 3}`,
    'Realtime=1',
    'Encrypt=None',
    'ServerVer=2.4.1',
    'PushProtVer=2.4.1',
    // Tells the device this server handles face (2), palm (8) and visible-light face (9) BIODATA,
    // and asks it to report its own biometric versions (shown in the device console).
    'MultiBioDataSupport=0:1:1:0:0:0:0:0:1:1',
    'MultiBioPhotoSupport=0:0:0:0:0:0:0:0:0:1',
    'PushOptionsFlag=1',
    'PushOptions=FingerFunOn,FaceFunOn,FPVersion,FaceVersion,PvFunOn,PvVersion,BioPhotoFun,BioDataFun,MultiBioDataSupport,MultiBioPhotoSupport,MultiBioVersion,MaxMultiBioDataCount',
  ].join('\n');
}
