export interface LogLine {
  timestamp: string;
  file: string;
  message: string;
}

// 2021/05/01 00:00:00.123456 init.go:99: reading config: config.toml
const RE_LINE = /^([0-9\s:/]+\.[0-9]{6}) (.+?\.go:[0-9]+|\*):\s(.+)$/;

export function parseLogLine(raw: string): LogLine {
  const m = RE_LINE.exec(raw);
  return m
    ? { timestamp: m[1]!, file: m[2]!, message: m[3]! }
    : { timestamp: '', file: '', message: raw };
}

export const parseLogLines = (raw: string[]): LogLine[] => raw.filter(Boolean).map(parseLogLine);

export const isErrorLine = (l: LogLine): boolean => l.message.includes('error');
