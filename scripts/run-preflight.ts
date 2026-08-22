import { collectPreflightReport } from "@/lib/installer/preflight";
import { prisma } from "@/lib/db";
import { closeRedis } from "@/lib/redis";

async function main() {
  const standardLog = console.log;
  console.log = (...values: unknown[]) => console.error(...values);
  try {
    const report = await collectPreflightReport();
    standardLog(JSON.stringify(report, null, 2));
    process.exitCode = report.ready ? 0 : 1;
  } finally {
    console.log = standardLog;
    await closeRedis();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
