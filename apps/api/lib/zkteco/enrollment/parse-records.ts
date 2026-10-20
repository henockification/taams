import type { EnrollmentTemplate, EnrollmentUser } from './types';

const USER_RECORD_SIZE = 72;

function cString(buffer: Buffer) {
  const end = buffer.indexOf(0);
  return buffer.subarray(0, end === -1 ? buffer.length : end).toString('utf8').trim();
}

// user.dat from a ZKTeco USB export: 72-byte records
// (uid u16, privilege u8, password[8], name[24], card u32, group u8, ..., user id[24] at 48).
export function parseUsbUserFile(data: Buffer): EnrollmentUser[] {
  if (data.length % USER_RECORD_SIZE !== 0) {
    throw new Error(`Invalid user.dat: size ${data.length} is not a multiple of ${USER_RECORD_SIZE}`);
  }

  const users: EnrollmentUser[] = [];
  for (let offset = 0; offset < data.length; offset += USER_RECORD_SIZE) {
    const record = data.subarray(offset, offset + USER_RECORD_SIZE);
    const pin = cString(record.subarray(48, 72));
    if (!pin) continue;
    const card = record.readUInt32LE(35);
    users.push({
      pin,
      name: cString(record.subarray(11, 35)) || null,
      privilege: record[2],
      password: cString(record.subarray(3, 11)) || null,
      card: card ? String(card) : null,
    });
  }
  return users;
}

// Tab-separated key=value fields; keys are lower-cased because firmware versions differ
// (Pin= vs PIN= vs pin=). Values keep everything after the first '=' (base64 padding).
export function parseKeyValueFields(text: string) {
  const fields: Record<string, string> = {};
  for (const part of text.split('\t')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    fields[part.slice(0, separator).trim().toLowerCase()] = part.slice(separator + 1).trim();
  }
  return fields;
}

function toInt(value: string | undefined, fallback = 0) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function templateFromFields(fields: Record<string, string>): EnrollmentTemplate | null {
  const pin = fields.pin?.trim();
  const template = fields.tmp?.trim();
  if (!pin || !template || fields.type === undefined) return null;
  return {
    pin,
    bioType: toInt(fields.type),
    bioNo: toInt(fields.no),
    bioIndex: toInt(fields.index),
    valid: toInt(fields.valid, 1),
    duress: toInt(fields.duress),
    majorVer: toInt(fields.majorver),
    minorVer: toInt(fields.minorver),
    format: toInt(fields.format),
    template,
  };
}

function userFromFields(fields: Record<string, string>): EnrollmentUser | null {
  const pin = fields.pin?.trim();
  if (!pin) return null;
  const card = fields.card ?? fields.cardno;
  return {
    pin,
    name: fields.name || null,
    privilege: toInt(fields.pri ?? fields.privilege),
    password: (fields.passwd ?? fields.password) || null,
    card: card && card !== '0' ? card : null,
  };
}

// biotemplate.dat from a USB export: one BIODATA record per CRLF line, no prefix.
export function parseUsbBiodataFile(text: string): EnrollmentTemplate[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => templateFromFields(parseKeyValueFields(line)))
    .filter((template): template is EnrollmentTemplate => template !== null);
}

// ADMS uploads (cdata OPERLOG/USERINFO/BIODATA, querydata). Lines look like
// "USER PIN=1\tName=..." / "BIODATA Pin=1\t..." (push 2.x) or "user pin=1\t..." /
// "biodata pin=1\t..." (tabledata). Lines without a prefix take their kind from the table.
export function parseAdmsEnrollmentUpload(body: string, table?: string | null) {
  const users: EnrollmentUser[] = [];
  const templates: EnrollmentTemplate[] = [];
  const tableKind = table?.trim().toUpperCase() ?? '';

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const space = line.indexOf(' ');
    const head = space === -1 ? line : line.slice(0, space);
    let kind: string;
    let rest: string;
    if (head.includes('=')) {
      kind = tableKind;
      rest = line;
    } else {
      kind = head.toUpperCase();
      rest = space === -1 ? '' : line.slice(space + 1);
    }

    const fields = parseKeyValueFields(rest);
    if (kind === 'USER' || kind === 'USERINFO') {
      const user = userFromFields(fields);
      if (user) users.push(user);
    } else if (kind === 'BIODATA') {
      const template = templateFromFields(fields);
      if (template) templates.push(template);
    }
  }

  return { users, templates };
}
