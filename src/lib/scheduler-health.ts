import { readFile, stat } from "node:fs/promises";
import { z } from "zod";

export class SchedulerHealthError extends Error {
  constructor(public readonly code: "UNCONFIGURED" | "HEARTBEAT_DENIED" | "LAG_EXCEEDED") { super(`SCHEDULER_${code}`); }
}

const heartbeatSchema = z.object({ schemaVersion: z.literal(1), catalogueVersion: z.string().regex(/^\d+\.\d+\.\d+$/), lastHeartbeatAt: z.string().datetime({ offset: true }), lastRunId: z.string().min(16).max(180) });
export type SchedulerHeartbeat = z.infer<typeof heartbeatSchema>;

export async function readSchedulerHeartbeat(path: string): Promise<SchedulerHeartbeat> {
  const details = await stat(path).catch(() => undefined);
  if (!details || !details.isFile() || (details.mode & 0o007) !== 0 || details.mode & 0o022) throw new SchedulerHealthError("HEARTBEAT_DENIED");
  try { return heartbeatSchema.parse(JSON.parse(await readFile(path, "utf8"))); } catch { throw new SchedulerHealthError("HEARTBEAT_DENIED"); }
}

export async function assertSchedulerHeartbeat(path: string | undefined, maxLagSeconds: string | undefined, now = new Date()) {
  if (!path || !maxLagSeconds || !/^[1-9][0-9]{0,5}$/.test(maxLagSeconds)) throw new SchedulerHealthError("UNCONFIGURED");
  const heartbeat = await readSchedulerHeartbeat(path);
  if (now.getTime() - new Date(heartbeat.lastHeartbeatAt).getTime() > Number(maxLagSeconds) * 1000) throw new SchedulerHealthError("LAG_EXCEEDED");
  return heartbeat;
}
