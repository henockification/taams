import ZKLib from "node-zklib";

type TestZktecoConnectionInput = {
  ipAddress: string;
  port?: number | null;
};

export type TestZktecoConnectionResult = {
  success: boolean;
  message: string;
  testedAt: Date;
  latencyMs: number;
};

export async function testZktecoConnection(input: TestZktecoConnectionInput): Promise<TestZktecoConnectionResult> {
  const startedAt = Date.now();
  const zk = new ZKLib(input.ipAddress, input.port || 4370, 10000, 4000);

  try {
    await zk.createSocket();

    return {
      success: true,
      message: "Connection successful",
      testedAt: new Date(),
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection failed",
      testedAt: new Date(),
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    try {
      await zk.disconnect();
    } catch {
      // The connection attempt result above is enough for this quick test.
    }
  }
}
