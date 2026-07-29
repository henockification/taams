export type ParsedZktecoPunch = {
    biometricId: string;
    punchTime: Date;
    verifyMode?: string;
    inOutMode?: string;
    workCode?: string;
    rawLine: string;
};

export type IngestZktecoPushInput = {
    serialNumber: string;
    table: string | null;
    rawBody: string;
    query: Record<string, string>;
  };