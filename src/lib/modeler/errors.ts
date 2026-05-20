// Typed error class for all Modeler server actions / route handlers.
//
// The harness convention (per the EPIC-1B spec) is to never throw a string
// out of a server action. Every failure is a `ScenarioError` with a
// machine-readable `code` so the UI can branch on the cause and the
// route handlers can map to the correct HTTP status.
//
// Codes:
//   FORBIDDEN         — caller is authenticated but lacks the required role.
//                       Maps to HTTP 403.
//   NOT_FOUND         — entity referenced by the action does not exist.
//                       Maps to HTTP 404.
//   INVALID_TRANSITION — state-machine guard refused the transition (e.g.,
//                       trying to Approve a Draft, or Activate without typing
//                       the confirmation phrase). Maps to HTTP 409.
//   VALIDATION        — Zod validation failed, or a business rule rejected
//                       the input (e.g., base_config schema mismatch).
//                       Maps to HTTP 422.

export type ScenarioErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "VALIDATION";

export class ScenarioError extends Error {
  override readonly name = "ScenarioError";
  readonly code: ScenarioErrorCode;
  /** Optional structured detail useful for the UI / logs. */
  readonly detail?: unknown;

  constructor(code: ScenarioErrorCode, message: string, detail?: unknown) {
    super(message);
    this.code = code;
    this.detail = detail;
  }

  /** Convert to an HTTP status — route handlers call this. */
  toHttpStatus(): number {
    switch (this.code) {
      case "FORBIDDEN":
        return 403;
      case "NOT_FOUND":
        return 404;
      case "INVALID_TRANSITION":
        return 409;
      case "VALIDATION":
        return 422;
    }
  }
}

/** Type guard used by route handlers / UI to detect ScenarioError. */
export function isScenarioError(err: unknown): err is ScenarioError {
  return err instanceof ScenarioError;
}
