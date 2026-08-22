/**
 * W01 Observability — تنقيح دفاعي للحقول الحساسة قبل وصولها إلى السجل.
 */
const sensitiveKeyPattern = /(?:authorization|cookie|password|secret|token|api[-_]?key|credential|private[-_]?key|access[-_]?key)/i;
const bearerPattern = /bearer\s+[a-z0-9._~+/=-]+/i;

export function redactForLog(value: unknown, visited = new WeakSet<object>()): unknown {
  if (typeof value === "string") {
    return bearerPattern.test(value) ? "[REDACTED]" : value;
  }

  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (visited.has(value)) return "[CIRCULAR]";
  visited.add(value);

  if (Array.isArray(value)) return value.map((item) => redactForLog(item, visited));

  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(source).map(([key, item]) => [key, sensitiveKeyPattern.test(key) ? "[REDACTED]" : redactForLog(item, visited)]),
  );
}
