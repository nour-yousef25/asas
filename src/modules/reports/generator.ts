/**
 * Report Generation only: no PDF, CSV, XLSX, JSON download, stored artifact, or share delivery.
 * Tenant Context → policy → scoped report service is mandatory for every call.
 */
export { reportGenerationService, type ReportGenerationInput, type ReportName } from "./report-service";
