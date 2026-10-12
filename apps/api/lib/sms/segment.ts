// SMS encoding and concatenation helpers for SMPP submit_sm.
// GSM 03.38 text goes out as data_coding 0 (SMSC default alphabet); anything else
// (Amharic/Ge'ez, emoji, ...) goes out as UCS2 (data_coding 8).

export type SmsEncoding = 'GSM' | 'UCS2';

export const DATA_CODING: Record<SmsEncoding, number> = {
  GSM: 0x00,
  UCS2: 0x08,
};

const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENDED = '^{}\\[~]|€\f';

const GSM_BASIC_SET = new Set(Array.from(GSM_BASIC));
const GSM_EXTENDED_SET = new Set(Array.from(GSM_EXTENDED));

const LIMITS: Record<SmsEncoding, { single: number; part: number }> = {
  // GSM units are septets (extended chars take two); UCS2 units are UTF-16 code units.
  GSM: { single: 160, part: 153 },
  UCS2: { single: 70, part: 67 },
};

export const MAX_SMS_PARTS = 10;

export function detectSmsEncoding(text: string): SmsEncoding {
  for (const char of text) {
    if (!GSM_BASIC_SET.has(char) && !GSM_EXTENDED_SET.has(char)) return 'UCS2';
  }
  return 'GSM';
}

function unitLength(char: string, encoding: SmsEncoding) {
  if (encoding === 'GSM') return GSM_EXTENDED_SET.has(char) ? 2 : 1;
  return char.length; // surrogate pairs count as two UTF-16 units
}

/** Splits text into SMS-sized parts without breaking a GSM escape or a surrogate pair. */
export function splitSms(text: string, encoding = detectSmsEncoding(text)) {
  const limits = LIMITS[encoding];
  const chars = Array.from(text);
  const total = chars.reduce((sum, char) => sum + unitLength(char, encoding), 0);
  if (total <= limits.single) return { encoding, parts: [text] };

  const parts: string[] = [];
  let current = '';
  let currentUnits = 0;
  for (const char of chars) {
    const units = unitLength(char, encoding);
    if (currentUnits + units > limits.part) {
      parts.push(current);
      current = '';
      currentUnits = 0;
    }
    current += char;
    currentUnits += units;
  }
  if (current) parts.push(current);

  if (parts.length > MAX_SMS_PARTS) {
    throw new Error(`SMS is too long (${parts.length} parts, max ${MAX_SMS_PARTS})`);
  }
  return { encoding, parts };
}

/** 8-bit concatenation UDH: IEI 0x00, length 3, reference, total parts, part number. */
export function buildConcatUdh(reference: number, total: number, sequence: number) {
  return Buffer.from([0x05, 0x00, 0x03, reference & 0xff, total, sequence]);
}

/** Converts +2519XXXXXXXX / 09XXXXXXXX style numbers to the international digits SMPP expects. */
export function toSmppDestination(phone: string) {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('251')) return digits;
  if (digits.startsWith('0')) return `251${digits.slice(1)}`;
  if (digits.length === 9) return `251${digits}`;
  return digits;
}
