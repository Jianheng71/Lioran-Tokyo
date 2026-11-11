import { randomBytes } from "node:crypto";

/** Generated ids are a prefix plus 12 lowercase hex chars from randomBytes(6). */
const SESSION_ID_RE = /^ses_[0-9a-f]{12}$/;
const JOB_ID_RE = /^job_[0-9a-f]{12}$/;

function shortId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export function newJobId(): string {
  return shortId("job");
}

export function newSessionId(): string {
  return shortId("ses");
}

export function isSessionId(id: unknown): id is string {
  return typeof id === "string" && SESSION_ID_RE.test(id);
}

export function isJobId(id: unknown): id is string {
  return typeof id === "string" && JOB_ID_RE.test(id);
}

function invalidId(kind: "session" | "job"): Error {
  return Object.assign(new Error(`Invalid ${kind} id`), { status: 400 });
}

/** Reject before any session path join. */
export function assertSessionId(id: string): string {
  if (!isSessionId(id)) throw invalidId("session");
  return id;
}

/** Reject before any job path join. */
export function assertJobId(id: string): string {
  if (!isJobId(id)) throw invalidId("job");
  return id;
}
