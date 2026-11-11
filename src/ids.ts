import { randomBytes } from "node:crypto";

function shortId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export function newJobId(): string {
  return shortId("job");
}

export function newSessionId(): string {
  return shortId("ses");
}
