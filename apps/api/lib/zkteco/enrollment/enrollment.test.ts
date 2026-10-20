import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildBiodataUpsertCommand,
  buildHandshakeOptions,
  buildUserDeleteCommand,
  buildUserUpsertCommand,
  formatCommandLine,
  parseDeviceCommandReplies,
} from './commands';
import { parseAdmsEnrollmentUpload, parseUsbBiodataFile, parseUsbUserFile } from './parse-records';
import { computeTemplatesHash, planDeviceSync, type PlannerDevice, type PlannerUser } from './sync-planner';
import { decryptTemplate, encryptTemplate } from './template-crypto';

function userRecord(pin: string, name: string, privilege = 0) {
  const record = Buffer.alloc(72);
  record.writeUInt16LE(1, 0);
  record[2] = privilege;
  record.write(name, 11, 'utf8');
  record[39] = 1;
  record.write(pin, 48, 'utf8');
  return record;
}

test('parses 72-byte user.dat records', () => {
  const users = parseUsbUserFile(Buffer.concat([userRecord('00273960', 'Shume Leta Kankea'), userRecord('w/a/c/30', 'Admin', 14)]));
  assert.deepEqual(users, [
    { pin: '00273960', name: 'Shume Leta Kankea', privilege: 0, password: null, card: null },
    { pin: 'w/a/c/30', name: 'Admin', privilege: 14, password: null, card: null },
  ]);
  assert.throws(() => parseUsbUserFile(Buffer.alloc(71)));
});

test('parses biotemplate.dat lines and keeps base64 padding', () => {
  const [template] = parseUsbBiodataFile('Pin=00273960\tNo=0\tIndex=3\tValid=1\tDuress=0\tType=8\tMajorVer=12\tMinorVer=0\tFormat=0\tTmp=ab+c/d==\r\n\r\n');
  assert.deepEqual(template, {
    pin: '00273960', bioType: 8, bioNo: 0, bioIndex: 3, valid: 1, duress: 0, majorVer: 12, minorVer: 0, format: 0, template: 'ab+c/d==',
  });
});

test('parses ADMS uploads in push 2.x and tabledata styles', () => {
  const operlog = parseAdmsEnrollmentUpload([
    'OPLOG 6\t0\t2026-10-20 10:00:00\t1\t0\t0\t0',
    'USER PIN=00274056\tName=Getachew\tPri=0\tPasswd=\tCard=\tGrp=1\tTZ=0000000000000000\tVerify=0',
    'BIODATA Pin=00274056\tNo=0\tIndex=0\tValid=1\tDuress=0\tType=2\tMajorVer=12\tMinorVer=0\tFormat=0\tTmp=QUJD',
  ].join('\n'), 'OPERLOG');
  assert.equal(operlog.users[0].pin, '00274056');
  assert.equal(operlog.templates[0].bioType, 2);

  const tabledata = parseAdmsEnrollmentUpload('user uid=1\tcardno=0\tpin=7\tpassword=\tname=X\tprivilege=14\nbiodata pin=7\tno=0\tindex=0\tvalid=1\tduress=0\ttype=8\tmajorver=12\tminorver=0\tformat=0\ttmp=WFla');
  assert.deepEqual(tabledata.users[0], { pin: '7', name: 'X', privilege: 14, password: null, card: null });
  assert.equal(tabledata.templates[0].template, 'WFla');

  const bare = parseAdmsEnrollmentUpload('Pin=9\tNo=0\tIndex=0\tValid=1\tDuress=0\tType=2\tMajorVer=12\tMinorVer=0\tFormat=0\tTmp=QQ==', 'BIODATA');
  assert.equal(bare.templates[0].pin, '9');
});

test('builds ADMS command lines', () => {
  assert.equal(
    buildUserUpsertCommand({ pin: '00273960', name: 'Shume\tLeta', privilege: 0, password: null, card: null }),
    'DATA UPDATE USERINFO PIN=00273960\tName=Shume Leta\tPri=0\tPasswd=\tCard=\tGrp=1\tTZ=0000000000000000\tVerify=0',
  );
  assert.equal(
    buildBiodataUpsertCommand({ pin: '1', bioType: 2, bioNo: 0, bioIndex: 4, valid: 1, duress: 0, majorVer: 12, minorVer: 0, format: 0, template: 'QUJD' }),
    'DATA UPDATE BIODATA Pin=1\tNo=0\tIndex=4\tValid=1\tDuress=0\tType=2\tMajorVer=12\tMinorVer=0\tFormat=0\tTmp=QUJD',
  );
  assert.equal(formatCommandLine(42, buildUserDeleteCommand('1')), 'C:42:DATA DELETE USERINFO PIN=1');
  const options = buildHandshakeOptions('SN123');
  assert.match(options, /^GET OPTION FROM: SN123\n/);
  assert.doesNotMatch(options.split('\n').find((line) => line.startsWith('TransFlag='))!, /AttLog/);
});

test('parses devicecmd replies', () => {
  assert.deepEqual(parseDeviceCommandReplies('ID=12&Return=0&CMD=DATA\nID=13&Return=-1002&CMD=DATA\n\ngarbage'), [
    { id: 12, returnCode: 0, cmd: 'DATA' },
    { id: 13, returnCode: -1002, cmd: 'DATA' },
  ]);
});

test('encrypts templates round trip', () => {
  process.env.BIOMETRIC_TEMPLATE_KEY = '11'.repeat(32);
  const encrypted = encryptTemplate('template-data');
  assert.notEqual(encrypted, encryptTemplate('template-data'));
  assert.equal(decryptTemplate(encrypted), 'template-data');
});

function device(overrides: Partial<PlannerDevice> = {}): PlannerDevice {
  return { deviceId: 'd1', removalsOnly: false, roster: new Map(), excludedEmployeeIds: new Set(), ...overrides };
}

test('plans adds, updates and held removals', () => {
  const users: PlannerUser[] = [
    { pin: 'new', employeeId: 'e1', employeeActive: true, templatesHash: 'h1' },
    { pin: 'same', employeeId: 'e2', employeeActive: true, templatesHash: 'h2' },
    { pin: 'changed', employeeId: 'e3', employeeActive: true, templatesHash: 'h3' },
    { pin: 'left', employeeId: 'e4', employeeActive: false, templatesHash: 'h4' },
    { pin: 'guard', employeeId: null, employeeActive: null, templatesHash: 'h5' },
  ];
  const roster = new Map<string, string | null>([['same', 'h2'], ['changed', null], ['left', 'h4'], ['stranger', null]]);

  const held = planDeviceSync(device({ roster }), users, false);
  assert.deepEqual(held.add, ['new', 'guard']);
  assert.deepEqual(held.update, ['changed']);
  assert.deepEqual(held.remove, []);
  assert.deepEqual(held.heldRemovals, ['left']);
  assert.deepEqual(held.unknownOnDevice, ['stranger']);

  assert.deepEqual(planDeviceSync(device({ roster }), users, true).remove, ['left']);
});

test('exclusions remove the user and the master only receives removals', () => {
  const users: PlannerUser[] = [
    { pin: 'a', employeeId: 'e1', employeeActive: true, templatesHash: 'h1' },
    { pin: 'b', employeeId: 'e2', employeeActive: false, templatesHash: 'h2' },
  ];
  const excluded = planDeviceSync(device({ roster: new Map([['a', 'h1']]), excludedEmployeeIds: new Set(['e1']) }), users, true);
  assert.deepEqual(excluded.remove, ['a']);

  const master = planDeviceSync(device({ removalsOnly: true, roster: new Map([['b', null]]) }), users, true);
  assert.deepEqual(master.add, []);
  assert.deepEqual(master.remove, ['b']);
});

test('template set hash ignores order', () => {
  assert.equal(computeTemplatesHash(['b', 'a']), computeTemplatesHash(['a', 'b']));
});

// Optional check against a real USB export: BIO_EXPORT_DIR=/path/to/export
const exportDir = process.env.BIO_EXPORT_DIR;
test('parses the real USB export', { skip: !exportDir || !existsSync(path.join(exportDir ?? '', 'user.dat')) }, () => {
  const users = parseUsbUserFile(readFileSync(path.join(exportDir!, 'user.dat')));
  const templates = parseUsbBiodataFile(readFileSync(path.join(exportDir!, 'biotemplate.dat'), 'utf8'));
  assert.equal(users.length, 835);
  assert.equal(templates.length, 34070);
  assert.equal(new Set(templates.filter((t) => t.bioType === 2).map((t) => t.pin)).size, 760);
  assert.equal(new Set(templates.filter((t) => t.bioType === 8).map((t) => t.pin)).size, 760);
  assert.equal(new Set(templates.map((t) => `${t.pin}|${t.bioType}|${t.bioNo}|${t.bioIndex}`)).size, 15200);
  const userPins = new Set(users.map((user) => user.pin));
  assert.ok(templates.every((t) => userPins.has(t.pin)));
});
