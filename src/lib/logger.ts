type LogLevel = "info" | "warn" | "error" | "debug";

interface LogMeta {
  taskId?: string;
  reason?: string;
  attempt?: number;
  [key: string]: unknown;
}

export const log = (level: LogLevel, message: string, meta: LogMeta = {}): void => {
  console.log(
    JSON.stringify({
      level,
      message,
      ...meta,
    }),
  );
};
