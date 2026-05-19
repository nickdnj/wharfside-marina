import { describe, it, expect } from "vitest";
import {
  validateSlipFit,
  applyOverride,
  SlipFitInputError,
  type Vessel,
  type Slip,
} from "../validate";

// Convenience constructors so each test is one line of intent + one line of data.
function vessel(loa: number, beam: number, draft: number): Vessel {
  return { loa_ft: loa, beam_ft: beam, draft_ft: draft };
}
function slip(loa: number, beam: number, minDepth: number): Slip {
  return { loa_limit_ft: loa, beam_limit_ft: beam, min_depth_at_mlw_ft: minDepth };
}

describe("validateSlipFit — happy path", () => {
  it("ok when vessel fits comfortably on all three dimensions (default margin 1.0)", () => {
    // vessel: 30/12/3.5 — slip: 35/14/6 — margin 1 → 4.5 < 6, fits
    const result = validateSlipFit(vessel(30, 12, 3.5), slip(35, 14, 6));
    expect(result).toEqual({ ok: true });
  });

  it("ok when vessel matches slip exactly on LOA + beam, and draft + margin == min_depth (boundary passes)", () => {
    // Architecture §6.1: comparison is strict >, so equality at the boundary passes.
    // vessel draft 4.0 + margin 1.0 = 5.0 == slip min_depth 5.0 → passes (NOT strictly greater).
    const result = validateSlipFit(vessel(35, 14, 4), slip(35, 14, 5));
    expect(result).toEqual({ ok: true });
  });

  it("ok with explicit 0.5ft safety margin (the architecture §6.1 example), draft 5.5 in 6.0 slip", () => {
    // QA-STRATEGY §3.4.8 boundary case: draft=5.5, min_depth=6.0, margin=0.5 → equal → passes
    const result = validateSlipFit(vessel(30, 10, 5.5), slip(35, 14, 6), { draftSafetyMarginFt: 0.5 });
    expect(result).toEqual({ ok: true });
  });
});

describe("validateSlipFit — single-dimension failures", () => {
  it("LOA exceeded → reasons: ['loa']", () => {
    const result = validateSlipFit(vessel(38, 12, 3), slip(35, 14, 6));
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reasons).toEqual(["loa"]);
      expect(result.suggestions).toContain("LOA");
    }
  });

  it("Beam exceeded → reasons: ['beam']", () => {
    const result = validateSlipFit(vessel(30, 15, 3), slip(35, 14, 6));
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reasons).toEqual(["beam"]);
  });

  it("Draft exceeded with default margin 1.0 → reasons: ['draft']", () => {
    // draft 5.6 + 1.0 = 6.6 > 6 → fails
    const result = validateSlipFit(vessel(30, 10, 5.6), slip(35, 14, 6));
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reasons).toEqual(["draft"]);
      expect(result.suggestions).toContain("draft");
    }
  });

  it("Draft within margin → ok (vessel 4.0ft, slip 5.0ft min_depth, default margin 1.0 → exactly equal → passes)", () => {
    // From the agent brief: 4.0ft draft, 5.0ft min_depth → ok (boundary equal, not strictly greater)
    const result = validateSlipFit(vessel(20, 8, 4), slip(35, 14, 5));
    expect(result).toEqual({ ok: true });
  });

  it("Draft just over the margin → fail (vessel 4.1ft, slip 5.0ft, default margin 1.0 → 5.1 > 5.0)", () => {
    const result = validateSlipFit(vessel(20, 8, 4.1), slip(35, 14, 5));
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reasons).toEqual(["draft"]);
  });
});

describe("validateSlipFit — multi-dimension failures", () => {
  it("All three exceeded → reasons in canonical order ['loa','beam','draft']", () => {
    const result = validateSlipFit(vessel(38, 15, 6), slip(35, 14, 6));
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reasons).toEqual(["loa", "beam", "draft"]);
      expect(result.suggestions).toMatch(/LOA/);
      expect(result.suggestions).toMatch(/beam/);
      expect(result.suggestions).toMatch(/draft/);
    }
  });

  it("LOA + beam fail, draft ok → reasons: ['loa','beam']", () => {
    const result = validateSlipFit(vessel(38, 15, 3), slip(35, 14, 6));
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reasons).toEqual(["loa", "beam"]);
  });

  it("LOA + draft fail, beam ok → reasons: ['loa','draft']", () => {
    const result = validateSlipFit(vessel(38, 12, 6), slip(35, 14, 6));
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reasons).toEqual(["loa", "draft"]);
  });
});

describe("validateSlipFit — input validation", () => {
  it("throws on negative LOA", () => {
    expect(() => validateSlipFit(vessel(-1, 10, 3), slip(35, 14, 6))).toThrow(SlipFitInputError);
  });

  it("throws on NaN draft", () => {
    expect(() => validateSlipFit(vessel(30, 10, NaN), slip(35, 14, 6))).toThrow(SlipFitInputError);
  });

  it("throws on negative safety margin", () => {
    expect(() =>
      validateSlipFit(vessel(30, 10, 3), slip(35, 14, 6), { draftSafetyMarginFt: -0.5 }),
    ).toThrow(SlipFitInputError);
  });
});

describe("applyOverride — admin override flow", () => {
  const failedResult = validateSlipFit(vessel(38, 12, 3), slip(35, 14, 6));

  it("returns ok with overrideReason when justification is ≥ 20 chars", () => {
    const j = "Owner accepts risk per phone call 5/12";
    expect(j.length).toBeGreaterThanOrEqual(20);
    const r = applyOverride(failedResult, j);
    expect(r).toEqual({ ok: true, overrideReason: j });
  });

  it("accepts exactly 20 chars", () => {
    const j = "x".repeat(20);
    const r = applyOverride(failedResult, j);
    expect(r).toEqual({ ok: true, overrideReason: j });
  });

  it("rejects 15-char justification with error message", () => {
    const j = "x".repeat(15);
    const r = applyOverride(failedResult, j);
    expect("error" in r).toBe(true);
    if ("error" in r) {
      expect(r.error).toMatch(/at least 20 characters/i);
      expect(r.error).toContain("15");
    }
  });

  it("rejects whitespace-only justification", () => {
    const r = applyOverride(failedResult, " ".repeat(50));
    expect("error" in r).toBe(true);
  });

  it("trims whitespace before storing", () => {
    const j = "   Valid justification for slip override   ";
    const r = applyOverride(failedResult, j);
    expect(r).toEqual({ ok: true, overrideReason: j.trim() });
  });

  it("refuses to override a passing validation (misuse guard)", () => {
    const okResult = validateSlipFit(vessel(30, 10, 3), slip(35, 14, 6));
    const r = applyOverride(okResult, "x".repeat(30));
    expect("error" in r).toBe(true);
  });
});
