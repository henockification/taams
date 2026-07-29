declare module "node-zklib" {
  type ZktecoAttendanceLog = {
    deviceUserId?: string | number;
    userId?: string | number;
    recordTime?: string | Date;
    attTime?: string | Date;
    type?: string | number;
    recordType?: string | number;
    [key: string]: unknown;
  };

  export default class ZKLib {
    constructor(ipAddress: string, port: number, timeout: number, inPort: number);
    createSocket(): Promise<void>;
    getAttendances(): Promise<{ data?: ZktecoAttendanceLog[] } | null | undefined>;
    disconnect(): Promise<void>;
  }
}
