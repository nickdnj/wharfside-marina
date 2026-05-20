"use client";

// RateMatrixEditor — controlled editor for the fee_schedule.base_config.
//
// Receives the current config + onChange callback; renders:
//   • base_rates_by_tier × lease type → 3×3 grid (the matrix)
//   • Holder multipliers (resident, non_resident_owner, non_resident)
//   • Lease-type multipliers
//   • Transient $/ft/night
//   • Amenity fee (annual + waived_for_resident + half_season_proration)
//   • Buy-in (amount + applies_to multi-select)
//   • premium_surcharge_uses_slip_fee_modifier toggle
//
// All inputs are number inputs. Validation lives upstream (Zod in the
// server action). The parent ScenarioEditor debounces the resulting
// onChange and triggers the live recalc.

import * as React from "react";
import type { FeeBaseConfig } from "@/lib/zod/schemas";
import { Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui/primitives";

export interface RateMatrixEditorProps {
  value: FeeBaseConfig;
  onChange: (next: FeeBaseConfig) => void;
  readOnly?: boolean;
}

type Tier = "Premium" | "Standard" | "Restricted";
const TIERS: readonly Tier[] = ["Premium", "Standard", "Restricted"];

export function RateMatrixEditor({
  value,
  onChange,
  readOnly = false,
}: RateMatrixEditorProps) {
  // The "Excel-style" keyboard nav (Enter = down, Tab = right, Esc = cancel)
  // is handled by native browser tabbing + onKeyDown handlers below. We
  // don't attempt to reimplement focus management beyond Enter→next-row.
  const grid = React.useRef<HTMLDivElement>(null);

  function patch<T extends keyof FeeBaseConfig>(key: T, partial: Partial<FeeBaseConfig[T]>) {
    onChange({
      ...value,
      [key]: { ...(value[key] as object), ...(partial as object) },
    } as FeeBaseConfig);
  }

  function setBaseRate(tier: Tier, val: number) {
    patch("base_rates_by_tier", {
      [tier]: { annual: val },
    } as Partial<FeeBaseConfig["base_rates_by_tier"]>);
  }

  function setHolderMultiplier(
    key: "resident" | "non_resident_owner" | "non_resident",
    val: number,
  ) {
    patch("holder_multipliers", { [key]: val } as Partial<
      FeeBaseConfig["holder_multipliers"]
    >);
  }

  function setLeaseMultiplier(
    key: "FULL_SEASON" | "HALF_SEASON_1" | "HALF_SEASON_2",
    val: number,
  ) {
    patch("lease_type_multipliers", { [key]: val } as Partial<
      FeeBaseConfig["lease_type_multipliers"]
    >);
  }

  function handleGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Enter on a cell input → focus the next row's same column.
    if (e.key !== "Enter") return;
    const target = e.target as HTMLInputElement;
    if (target.tagName !== "INPUT") return;
    e.preventDefault();
    const col = target.dataset.col;
    const row = target.dataset.row;
    if (col == null || row == null) return;
    const nextRow = (Number(row) + 1) % TIERS.length;
    const next = grid.current?.querySelector<HTMLInputElement>(
      `input[data-col="${col}"][data-row="${nextRow}"]`,
    );
    next?.focus();
    next?.select();
  }

  return (
    <div className="space-y-6">
      {/* Base rate matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Base Rates by Tier (annual $)</CardTitle>
          <p className="text-xs text-slate-500">
            Excel-style: Enter moves down, Tab moves right, Esc cancels. Live
            recalc fires ~300ms after you stop typing.
          </p>
        </CardHeader>
        <CardContent>
          <div
            ref={grid}
            onKeyDown={handleGridKeyDown}
            className="grid grid-cols-[120px_1fr_1fr_1fr] gap-2"
            role="grid"
          >
            <div className="text-xs font-semibold text-slate-500 self-end pb-1">Tier</div>
            <div className="text-xs font-semibold text-slate-500 self-end pb-1">Annual ($)</div>
            <div className="text-xs font-semibold text-slate-500 self-end pb-1">Half-1 mult</div>
            <div className="text-xs font-semibold text-slate-500 self-end pb-1">Half-2 mult</div>
            {TIERS.map((tier, idx) => (
              <React.Fragment key={tier}>
                <div className="self-center font-medium text-navy-900">{tier}</div>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  data-col="annual"
                  data-row={idx}
                  disabled={readOnly}
                  value={value.base_rates_by_tier[tier].annual}
                  onChange={(e) => setBaseRate(tier, Number(e.target.value))}
                  className="font-mono"
                  aria-label={`${tier} annual base rate`}
                />
                {idx === 0 ? (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={readOnly}
                    value={value.lease_type_multipliers.HALF_SEASON_1}
                    onChange={(e) => setLeaseMultiplier("HALF_SEASON_1", Number(e.target.value))}
                    className="font-mono"
                    aria-label="Half-1 multiplier"
                  />
                ) : (
                  <div className="text-xs text-slate-400 self-center">
                    (shared)
                  </div>
                )}
                {idx === 0 ? (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={readOnly}
                    value={value.lease_type_multipliers.HALF_SEASON_2}
                    onChange={(e) => setLeaseMultiplier("HALF_SEASON_2", Number(e.target.value))}
                    className="font-mono"
                    aria-label="Half-2 multiplier"
                  />
                ) : (
                  <div className="text-xs text-slate-400 self-center">
                    (shared)
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Holder multipliers */}
      <Card>
        <CardHeader>
          <CardTitle>Holder Multipliers</CardTitle>
          <p className="text-xs text-slate-500">
            Applied to base rate before fees. Residents typically &lt; 1.0.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Resident">
            <Input
              type="number"
              step="0.01"
              disabled={readOnly}
              value={value.holder_multipliers.resident as number}
              onChange={(e) => setHolderMultiplier("resident", Number(e.target.value))}
              className="font-mono"
            />
          </Field>
          <Field label="Non-resident owner">
            <Input
              type="number"
              step="0.01"
              disabled={readOnly}
              value={value.holder_multipliers.non_resident_owner as number}
              onChange={(e) => setHolderMultiplier("non_resident_owner", Number(e.target.value))}
              className="font-mono"
            />
          </Field>
          <Field label="Non-resident">
            <Input
              type="number"
              step="0.01"
              disabled={readOnly}
              value={value.holder_multipliers.non_resident as number}
              onChange={(e) => setHolderMultiplier("non_resident", Number(e.target.value))}
              className="font-mono"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Transient + slip-fee-modifier toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Transient & Slip Modifier</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Transient $/ft/night">
            <Input
              type="number"
              step="0.05"
              disabled={readOnly}
              value={value.transient_per_foot_per_night}
              onChange={(e) =>
                onChange({
                  ...value,
                  transient_per_foot_per_night: Number(e.target.value),
                })
              }
              className="font-mono"
            />
          </Field>
          <Field label="Apply per-slip fee_modifier?">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={value.premium_surcharge_uses_slip_fee_modifier}
                onChange={(e) =>
                  onChange({
                    ...value,
                    premium_surcharge_uses_slip_fee_modifier: e.target.checked,
                  })
                }
              />
              Multiply base by slip.fee_modifier
            </label>
          </Field>
        </CardContent>
      </Card>

      {/* Amenity fee */}
      <Card>
        <CardHeader>
          <CardTitle>Amenity Fee</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Annual ($)">
            <Input
              type="number"
              step="1"
              disabled={readOnly}
              value={value.amenity_fee.annual}
              onChange={(e) =>
                patch("amenity_fee", { annual: Number(e.target.value) })
              }
              className="font-mono"
            />
          </Field>
          <Field label="Half-season proration ×">
            <Input
              type="number"
              step="0.05"
              disabled={readOnly}
              value={value.amenity_fee.half_season_proration ?? 0.5}
              onChange={(e) =>
                patch("amenity_fee", {
                  half_season_proration: Number(e.target.value),
                })
              }
              className="font-mono"
            />
          </Field>
          <Field label="Waived for residents?">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={value.amenity_fee.waived_for_resident}
                onChange={(e) =>
                  patch("amenity_fee", {
                    waived_for_resident: e.target.checked,
                  })
                }
              />
              Residents pay $0 amenity
            </label>
          </Field>
        </CardContent>
      </Card>

      {/* Buy-in */}
      <Card>
        <CardHeader>
          <CardTitle>Buy-In (one-time)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount ($)">
            <Input
              type="number"
              step="1"
              disabled={readOnly}
              value={value.buy_in.amount}
              onChange={(e) => patch("buy_in", { amount: Number(e.target.value) })}
              className="font-mono"
            />
          </Field>
          <Field label="Applies to">
            <div className="flex flex-col gap-1 text-sm">
              {(["resident", "non_resident_owner", "non_resident"] as const).map(
                (bucket) => {
                  const applied = value.buy_in.applies_to.includes(bucket);
                  return (
                    <label key={bucket} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={applied}
                        onChange={(e) => {
                          const set = new Set(value.buy_in.applies_to);
                          if (e.target.checked) set.add(bucket);
                          else set.delete(bucket);
                          patch("buy_in", {
                            applies_to: Array.from(set) as FeeBaseConfig["buy_in"]["applies_to"],
                          });
                        }}
                      />
                      {bucket}
                    </label>
                  );
                },
              )}
            </div>
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
