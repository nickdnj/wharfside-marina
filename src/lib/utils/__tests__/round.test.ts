import { describe, it, expect } from "vitest";
import { roundHalfEven, roundToCents, formatCents, RoundingError } from "../round";

describe("roundHalfEven — basic rounding", () => {
  it("rounds 0.49 to 0.49 (no change at 2dp)", () => {
    expect(roundHalfEven(0.49, 2)).toBe(0.49);
  });

  it("rounds 0.51 to 0.51 (no change at 2dp)", () => {
    expect(roundHalfEven(0.51, 2)).toBe(0.51);
  });

  it("rounds 0.494 down to 0.49", () => {
    expect(roundHalfEven(0.494, 2)).toBe(0.49);
  });

  it("rounds 0.496 up to 0.50", () => {
    expect(roundHalfEven(0.496, 2)).toBe(0.5);
  });

  it("rounds the FIXTURES E1 case 1551.890625 → 1551.89 (third decimal is 0, then 625 — drops down)", () => {
    // From FIXTURES.md §E1: total = 1551.890625, banker's at 2dp = 1551.89
    // Reasoning: at 2dp we look at the 3rd-decimal digit which is 0; since
    // anything after a 0-then-625 means < 0.5 at the boundary, round down.
    expect(roundHalfEven(1551.890625, 2)).toBe(1551.89);
  });
});

describe("roundHalfEven — exact .5 half-to-even cases (LOCKED behaviour)", () => {
  it("rounds 100.005 → 100.00 (third decimal is 5; floor 10000 is even → stays)", () => {
    expect(roundHalfEven(100.005, 2)).toBe(100.0);
  });

  it("rounds 100.015 → 100.02 (third decimal is 5; floor 10001 is odd → up to 10002)", () => {
    expect(roundHalfEven(100.015, 2)).toBe(100.02);
  });

  it("rounds 2.5 → 2 at 0 decimals (floor 2 even → stays)", () => {
    expect(roundHalfEven(2.5, 0)).toBe(2);
  });

  it("rounds 3.5 → 4 at 0 decimals (floor 3 odd → up)", () => {
    expect(roundHalfEven(3.5, 0)).toBe(4);
  });

  it("rounds 0.5 → 0 (floor 0 even → stays)", () => {
    expect(roundHalfEven(0.5, 0)).toBe(0);
  });

  it("rounds 1.5 → 2 (floor 1 odd → up)", () => {
    expect(roundHalfEven(1.5, 0)).toBe(2);
  });
});

describe("roundHalfEven — negative numbers (symmetric)", () => {
  it("rounds -0.49 → -0.49", () => {
    expect(roundHalfEven(-0.49, 2)).toBe(-0.49);
  });

  it("rounds -0.51 → -0.51", () => {
    expect(roundHalfEven(-0.51, 2)).toBe(-0.51);
  });

  it("rounds -2.5 → -2 (magnitude floor 2 even → stays)", () => {
    expect(roundHalfEven(-2.5, 0)).toBe(-2);
  });

  it("rounds -3.5 → -4 (magnitude floor 3 odd → away)", () => {
    expect(roundHalfEven(-3.5, 0)).toBe(-4);
  });

  it("rounds -100.005 → -100.00", () => {
    expect(roundHalfEven(-100.005, 2)).toBe(-100.0);
  });

  it("rounds -100.015 → -100.02", () => {
    expect(roundHalfEven(-100.015, 2)).toBe(-100.02);
  });
});

describe("roundHalfEven — edge cases", () => {
  it("zero is zero", () => {
    expect(roundHalfEven(0, 2)).toBe(0);
    expect(roundHalfEven(-0, 2)).toBe(0);
  });

  it("handles large numbers correctly", () => {
    expect(roundHalfEven(1234567.894, 2)).toBe(1234567.89);
    expect(roundHalfEven(1234567.895, 2)).toBe(1234567.9); // floor 123456789 odd → 123456790
  });

  it("handles very small fractions", () => {
    expect(roundHalfEven(0.00001, 2)).toBe(0);
    expect(roundHalfEven(0.0049, 2)).toBe(0);
    expect(roundHalfEven(0.0051, 2)).toBe(0.01);
  });

  it("respects requested decimal precision", () => {
    expect(roundHalfEven(1.23456, 4)).toBe(1.2346); // .56 → up
    expect(roundHalfEven(1.23455, 4)).toBe(1.2346); // exact .5; floor 12345 odd → up
    expect(roundHalfEven(1.23445, 4)).toBe(1.2344); // exact .5; floor 12344 even → stays
  });

  it("0 decimals returns whole integer (as number)", () => {
    expect(roundHalfEven(4.5, 0)).toBe(4);
    expect(roundHalfEven(5.5, 0)).toBe(6);
  });

  it("throws on non-finite input", () => {
    expect(() => roundHalfEven(NaN, 2)).toThrow(RoundingError);
    expect(() => roundHalfEven(Infinity, 2)).toThrow(RoundingError);
    expect(() => roundHalfEven(-Infinity, 2)).toThrow(RoundingError);
  });

  it("throws on invalid decimals argument", () => {
    expect(() => roundHalfEven(1, -1)).toThrow(RoundingError);
    expect(() => roundHalfEven(1, 1.5)).toThrow(RoundingError);
    expect(() => roundHalfEven(1, 21)).toThrow(RoundingError);
  });
});

describe("roundToCents (convenience wrapper)", () => {
  it("rounds to 2 decimals", () => {
    expect(roundToCents(1.234)).toBe(1.23);
    expect(roundToCents(1.235)).toBe(1.24); // floor 123 odd → up
    expect(roundToCents(1.245)).toBe(1.24); // floor 124 even → stays
  });
});

describe("formatCents (returns string with 2 decimals)", () => {
  it("always emits exactly 2 decimal places", () => {
    expect(formatCents(4331.25)).toBe("4331.25");
    expect(formatCents(4331)).toBe("4331.00");
    expect(formatCents(4331.2)).toBe("4331.20");
    expect(formatCents(4331.255)).toBe("4331.26"); // floor 433125 odd → up
    expect(formatCents(4331.245)).toBe("4331.24"); // floor 433124 even → stays
  });

  it("emits negative format correctly", () => {
    expect(formatCents(-4331.25)).toBe("-4331.25");
    expect(formatCents(-0.005)).toBe("0.00"); // banker's: -0 normalized to 0
  });
});
