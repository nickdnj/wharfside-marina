// Strict-mode banker's rounding (half-to-even / IEEE 754).
// Locked 2026-05-19 per FIXTURES.md §E1. JavaScript's Math.round is
// half-away-from-zero, which is wrong for currency. Use these helpers
// for any monetary value that will be persisted or exported.

export class RoundingError extends Error {
  override readonly name = "RoundingError";
}

/**
 * Banker's rounding (half-to-even) at an arbitrary number of decimal places.
 *
 * Behaviour:
 *   - When the trailing portion to be dropped is < 0.5 → round toward zero
 *   - When it is > 0.5 → round away from zero
 *   - When it is exactly .5 → round to the nearest EVEN integer at the target precision
 *
 * Symmetric for negative numbers: `roundHalfEven(-0.5, 0) === 0` and
 * `roundHalfEven(-1.5, 0) === -2`.
 *
 * Implementation: to dodge IEEE-754 representation drift (1.005 is actually
 * stored as 1.00499999999999...), we render the value to one extra decimal
 * via `toFixed`, then inspect the trailing digit and trailing rest digit
 * to classify <0.5 / =0.5 / >0.5 deterministically. `toFixed` itself is
 * implemented as half-away-from-zero by the spec, but we apply it at
 * `decimals + N` where N is large enough that we are *under* the IEEE
 * boundary, then read the digits as a string — we never use toFixed's
 * own rounding for the final answer.
 */
export function roundHalfEven(value: number, decimals: number = 2): number {
  if (!Number.isFinite(value)) {
    throw new RoundingError(`roundHalfEven received non-finite value: ${String(value)}`);
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 20) {
    throw new RoundingError(`roundHalfEven decimals must be an integer in [0,20], got ${decimals}`);
  }

  if (value === 0) return 0;

  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);

  // Render the absolute value at high precision (decimals + 4 extra digits)
  // so that we can read the cut-point and the digits after it as a string,
  // avoiding direct float arithmetic for the rounding decision.
  //
  // Using decimals + 4: the 4 extra digits are enough to distinguish a true
  // half (..5000) from a not-quite-half (..49999 or ..50001) even after
  // float drift, for any value that fits comfortably in a double.
  const extra = 4;
  // toFixed always emits at least decimals+extra fractional digits.
  // It rounds the (decimals+extra+1)th digit away from zero — fine for our
  // purposes since we have 4 digits of slack.
  const high = abs.toFixed(decimals + extra);

  // Split integer / fractional parts.
  const dotIdx = high.indexOf(".");
  const intStr = dotIdx === -1 ? high : high.slice(0, dotIdx);
  const fracStr = dotIdx === -1 ? "" : high.slice(dotIdx + 1);

  // The digit at position `decimals` (0-indexed) is the first dropped digit.
  // Everything from `decimals + 1` onward is the rest.
  const droppedDigit = fracStr[decimals] ?? "0";
  const droppedRest = fracStr.slice(decimals + 1);

  // Build the integer value at the target scale (decimals).
  const kept = (intStr + fracStr.slice(0, decimals)).replace(/^0+(?=\d)/, "");
  // BigInt to avoid float drift on the integer step for very large values.
  const keptInt = BigInt(kept === "" ? "0" : kept);
  const factor = Math.pow(10, decimals);

  const droppedDigitNum = Number(droppedDigit);
  const restIsAllZero = /^0*$/.test(droppedRest);

  let resultBig: bigint;
  if (droppedDigitNum < 5) {
    resultBig = keptInt;
  } else if (droppedDigitNum > 5) {
    resultBig = keptInt + 1n;
  } else {
    // droppedDigit is exactly 5.
    if (!restIsAllZero) {
      // Something beyond .5 — round up.
      resultBig = keptInt + 1n;
    } else {
      // Exactly .5 — round to even.
      resultBig = keptInt % 2n === 0n ? keptInt : keptInt + 1n;
    }
  }

  // Convert back to number. For values within Number.MAX_SAFE_INTEGER this
  // is exact; beyond that, the value already had precision loss before we
  // started, so we don't make things worse.
  return (Number(resultBig) / factor) * sign;
}

/**
 * Round to 2 decimal places using banker's rounding. Convenience wrapper
 * for the currency-pricing common case.
 */
export function roundToCents(value: number): number {
  return roundHalfEven(value, 2);
}

/**
 * Format a number as a 2-decimal currency string with banker's rounding
 * applied. Used by the AppFolio CSV exporter where `4331.25` must never
 * render as `4331.250` or `4331`.
 *
 * Normalizes negative zero to `"0.00"`.
 */
export function formatCents(value: number): string {
  const rounded = roundToCents(value);
  // Defensive against -0.
  const normalized = rounded === 0 ? 0 : rounded;
  return normalized.toFixed(2);
}
