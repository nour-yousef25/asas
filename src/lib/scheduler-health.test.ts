import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSchedulerHeartbeat } from "@/lib/scheduler-health";

describe("scheduler heartbeat health", () => {
  let directory = "";
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "asas-scheduler-")); });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

  it("accepts a secure current heartbeat and denies stale or world-readable files", async () => {
    const path = join(directory, "heartbeat.json");
    await writeFile(path, JSON.stringify({ schemaVersion: 1, catalogueVersion: "1.0.0", lastHeartbeatAt: "2026-08-25T12:00:00.000Z", lastRunId: "scheduler-run-123456" }), { mode: 0o640 });
    await chmod(path, 0o640);
    await expect(assertSchedulerHeartbeat(path, "300", new Date("2026-08-25T12:04:00.000Z"))).resolves.toMatchObject({ catalogueVersion: "1.0.0" });
    await expect(assertSchedulerHeartbeat(path, "30", new Date("2026-08-25T12:04:00.000Z"))).rejects.toMatchObject({ code: "LAG_EXCEEDED" });
    await chmod(path, 0o644);
    await expect(assertSchedulerHeartbeat(path, "300", new Date("2026-08-25T12:04:00.000Z"))).rejects.toMatchObject({ code: "HEARTBEAT_DENIED" });
  });
});
