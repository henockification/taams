// Shapes shared by the USB export parser, the ADMS upload parser and the command builders.
export type EnrollmentUser = {
  pin: string;
  name: string | null;
  privilege: number;
  password: string | null;
  card: string | null;
};

export type EnrollmentTemplate = {
  pin: string;
  bioType: number;
  bioNo: number;
  bioIndex: number;
  valid: number;
  duress: number;
  majorVer: number;
  minorVer: number;
  format: number;
  template: string;
};

export type DeviceCommandReply = {
  id: number;
  returnCode: number;
  cmd: string | null;
};

// ZKTeco BIODATA Type values seen on G3 Pro (face = near-infrared face, palm = palm vein).
export const BIO_TYPE_LABELS: Record<number, string> = {
  1: 'FINGERPRINT',
  2: 'FACE',
  8: 'PALM',
  9: 'VISIBLE_FACE',
};
