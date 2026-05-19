// Slip-fit validator. Architecture §6.
//
// Three independent dimensions are checked: LOA, beam, draft. Each can
// fail independently; the result reports *all* failing dimensions, not just
// the first one (so the UI can show the operator everything they need to
// override or escalate in one round-trip).
//
// The draft check applies a safety margin (default 1.0ft per spec; the
// architecture §6.1 example used 0.5 — see the FAILURE_MARGIN_DECISION
// note below). The margin is parameterized so it can be tuned without
// touching the comparison logic.

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Vessel {
  loa_ft: number;
  beam_ft: number;
  draft_ft: number;
}

export interface Slip {
  loa_limit_ft: number;
  beam_limit_ft: number;
  min_depth_at_mlw_ft: number;
}

export type FailureDimension = "loa" | "beam" | "draft";

export type ValidationResult =
  | { ok: true }
  | { ok: false; reasons: FailureDimension[]; suggestions?: string };

export type OverrideResult =
  | { ok: true; overrideReason: string }
  | { error: string };

export interface ValidateOptions {
  /**
   * Safety clearance added to vessel draft before comparing to slip depth.
   *
   * The agent brief specifies 1.0ft; Architecture §6.1's example uses 0.5ft.
   * Default kept at 1.0ft per the agent brief (more conservative — bigger
   * safety buffer), but every caller MUST be aware that this affects which
   * vessels get rejected. To switch to the architecture-example value,
   * pass `{ draftSafetyMarginFt: 0.5 }`.
   */
  draftSafetyMarginFt?: number;
}

// TODO (Mac, before EPIC-2A): RECONCILE SAFETY MARGIN.
// Architecture §6.1 and QA-STRATEGY §3.4 both specify 0.5ft.
// This default of 1.0ft came from the originating agent brief (in error).
// Either: (a) flip default to 0.5 and update test math accordingly,
// or (b) keep 1.0 here and update architecture + QA strategy to match.
// Tests in this folder currently assume 1.0; do not flip default without also
// updating the test expectations.
const DEFAULT_DRAFT_SAFETY_MARGIN_FT = 1.0;

const MIN_OVERRIDE_JUSTIFICATION_CHARS = 20;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate that `vessel` physically fits in `slip` along all three
 * dimensions. Returns either `{ ok: true }` or `{ ok: false, reasons: [...] }`
 * with every failing dimension enumerated.
 *
 * Comparison semantics (architecture §6.1):
 *   - LOA   fails when `vessel.loa_ft > slip.loa_limit_ft`
 *   - Beam  fails when `vessel.beam_ft > slip.beam_limit_ft`
 *   - Draft fails when `vessel.draft_ft + safetyMargin > slip.min_depth_at_mlw_ft`
 *     (strict `>`, so the equality boundary passes — see test case `boundary draft`).
 */
export function validateSlipFit(
  vessel: Vessel,
  slip: Slip,
  options: ValidateOptions = {},
): ValidationResult {
  const margin = options.draftSafetyMarginFt ?? DEFAULT_DRAFT_SAFETY_MARGIN_FT;
  validateNumericInputs(vessel, slip, margin);

  const reasons: FailureDimension[] = [];

  if (vessel.loa_ft > slip.loa_limit_ft) {
    reasons.push("loa");
  }
  if (vessel.beam_ft > slip.beam_limit_ft) {
    reasons.push("beam");
  }
  if (vessel.draft_ft + margin > slip.min_depth_at_mlw_ft) {
    reasons.push("draft");
  }

  if (reasons.length === 0) return { ok: true };

  return {
    ok: false,
    reasons,
    suggestions: buildSuggestion(reasons, vessel, slip, margin),
  };
}

/**
 * Apply an admin override to a failed validation. Justification must be at
 * least 20 chars (architecture §6.2 governance rule). The caller is
 * responsible for checking the actor's role allows override before calling
 * this; this function only handles the data shape.
 *
 * If the input result is already `ok: true`, no override is needed — we
 * return `{ error }` to surface the misuse rather than silently no-op.
 */
export function applyOverride(
  result: ValidationResult,
  justification: string,
): OverrideResult {
  if (result.ok === true) {
    return { error: "Cannot override a passing validation — no failure to bypass" };
  }
  const trimmed = justification.trim();
  if (trimmed.length < MIN_OVERRIDE_JUSTIFICATION_CHARS) {
    return {
      error: `Override justification must be at least ${MIN_OVERRIDE_JUSTIFICATION_CHARS} characters (got ${trimmed.length})`,
    };
  }
  return { ok: true, overrideReason: trimmed };
}

export class SlipFitInputError extends Error {
  override readonly name = "SlipFitInputError";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateNumericInputs(vessel: Vessel, slip: Slip, margin: number): void {
  const fields: Array<[string, number]> = [
    ["vessel.loa_ft", vessel.loa_ft],
    ["vessel.beam_ft", vessel.beam_ft],
    ["vessel.draft_ft", vessel.draft_ft],
    ["slip.loa_limit_ft", slip.loa_limit_ft],
    ["slip.beam_limit_ft", slip.beam_limit_ft],
    ["slip.min_depth_at_mlw_ft", slip.min_depth_at_mlw_ft],
    ["draftSafetyMarginFt", margin],
  ];
  for (const [name, n] of fields) {
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) {
      throw new SlipFitInputError(`${name} must be a non-negative finite number, got ${String(n)}`);
    }
  }
}

function buildSuggestion(
  reasons: FailureDimension[],
  vessel: Vessel,
  slip: Slip,
  margin: number,
): string {
  const parts: string[] = [];
  if (reasons.includes("loa")) {
    parts.push(`LOA ${vessel.loa_ft}ft exceeds limit ${slip.loa_limit_ft}ft`);
  }
  if (reasons.includes("beam")) {
    parts.push(`beam ${vessel.beam_ft}ft exceeds limit ${slip.beam_limit_ft}ft`);
  }
  if (reasons.includes("draft")) {
    parts.push(
      `draft ${vessel.draft_ft}ft + ${margin}ft margin exceeds slip min depth ${slip.min_depth_at_mlw_ft}ft`,
    );
  }
  return parts.join("; ");
}
