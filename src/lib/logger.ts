/**
 * W01 Observability — سجل JSON مهيكل ومنقح، مع correlation ID عند توفره.
 */
import { getCorrelationId } from "@/lib/observability/correlation";
import { redactForLog } from "@/lib/observability/redaction";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: unknown;
  error?: Error;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || "info"];

function formatEntry(entry: LogEntry): string {
  const error = entry.error
    ? {
        name: entry.error.name,
        message: entry.error.message,
        ...(process.env.NODE_ENV === "development" && entry.error.stack ? { stack: entry.error.stack } : {}),
      }
    : undefined;

  return JSON.stringify(
    redactForLog({
      timestamp: entry.timestamp,
      level: entry.level,
      context: entry.context,
      message: entry.message,
      correlationId: getCorrelationId(),
      data: entry.data,
      error,
    }),
  );
}

function createLogger(context?: string) {
  return {
    debug(message: string, data?: unknown) {
      if (currentLevel <= LOG_LEVELS.debug) {
        const entry: LogEntry = {
          level: "debug",
          message,
          timestamp: new Date().toISOString(),
          context,
          data,
        };
        console.debug(formatEntry(entry));
      }
    },

    info(message: string, data?: unknown) {
      if (currentLevel <= LOG_LEVELS.info) {
        const entry: LogEntry = {
          level: "info",
          message,
          timestamp: new Date().toISOString(),
          context,
          data,
        };
        console.info(formatEntry(entry));
      }
    },

    warn(message: string, data?: unknown) {
      if (currentLevel <= LOG_LEVELS.warn) {
        const entry: LogEntry = {
          level: "warn",
          message,
          timestamp: new Date().toISOString(),
          context,
          data,
        };
        console.warn(formatEntry(entry));
      }
    },

    error(message: string, error?: Error | unknown, data?: unknown) {
      if (currentLevel <= LOG_LEVELS.error) {
        const entry: LogEntry = {
          level: "error",
          message,
          timestamp: new Date().toISOString(),
          context,
          data,
          error: error instanceof Error ? error : undefined,
        };
        console.error(formatEntry(entry));
      }
    },

    child(subContext: string) {
      return createLogger(context ? `${context}:${subContext}` : subContext);
    },
  };
}

export const logger = createLogger();
export default logger;
