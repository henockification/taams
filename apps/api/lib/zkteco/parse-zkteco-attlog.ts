import { ParsedZktecoPunch } from "../../types/zkteco";

export function parseZktecoAttLog(rawBody: string): ParsedZktecoPunch[] {
    return rawBody
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
        const parts = line.split(/\t|\s{2,}/);

        const biometricId = parts[0];
        const punchTimeRaw = parts[1];

        if (!biometricId || !punchTimeRaw) {
            throw new Error(`Invalid ZKTeco attendance line: ${line}`);
        }

        return {
            biometricId,
            punchTime: new Date(punchTimeRaw),
            verifyMode: parts[2],
            inOutMode: parts[3],
            workCode: parts[4],
            rawLine: line,
        };
    });
}