import { collectPreflightReport } from "@/lib/installer/preflight";

const report = await collectPreflightReport();
console.log(JSON.stringify(report, null, 2));
process.exit(report.ready ? 0 : 1);
