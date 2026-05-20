"use client";

// The Scenario Editor — Linda's main workbench.
//
// Wires the RateMatrixEditor (left) to the ProjectionPanel (right) with
// live recalc:
//
//   1. User edits a rate
//   2. Local state updates immediately (controlled inputs)
//   3. Debounced 300ms → fire `projectScenarioById` server action for the
//      canonical projection (we don't compute client-side to avoid drift)
//   4. Autosave debounced 2s → fire `updateScenarioConfig` to persist
//   5. State-machine actions (Submit, Approve, Activate, Archive) are
//      explicit button clicks with confirmation where required.
//
// Editor is read-only when scenario.status is not draft/under_review or
// when fee_schedule.state != draft. We render an explicit lock banner.

import * as React from "react";
import { useRouter } from "next/navigation";

import { RateMatrixEditor } from "./RateMatrixEditor";
import { ProjectionPanel } from "./ProjectionPanel";
import { ScenarioStatusBadge } from "./ScenarioStatusBadge";
import { FeeScheduleStateMachine } from "./FeeScheduleStateMachine";
import { Button, Card, CardContent } from "@/components/ui/primitives";
import type { FeeBaseConfig } from "@/lib/zod/schemas";
import type {
  CompareResult,
  ProjectionResult,
} from "@/lib/modeler/projection";
import {
  updateScenarioConfig,
  projectScenarioById,
  transitionScenario,
  transitionFeeSchedule,
} from "@/app/admin/modeler/actions";

export interface ScenarioEditorProps {
  scenarioId: string;
  scenarioName: string;
  scenarioStatus:
    | "draft"
    | "under_review"
    | "submitted"
    | "approved_superseded"
    | "archived";
  feeScheduleId: string;
  feeScheduleState: "draft" | "submitted" | "approved" | "active" | "archived";
  initialBaseConfig: FeeBaseConfig;
  initialProjection: ProjectionResult | null;
  initialCompare: CompareResult | null;
}

const PROJECT_DEBOUNCE_MS = 300;
const AUTOSAVE_DEBOUNCE_MS = 2000;

export function ScenarioEditor(props: ScenarioEditorProps) {
  const router = useRouter();
  const [baseConfig, setBaseConfig] = React.useState<FeeBaseConfig>(
    props.initialBaseConfig,
  );
  const [projection, setProjection] = React.useState<ProjectionResult | null>(
    props.initialProjection,
  );
  const [compare, setCompare] = React.useState<CompareResult | null>(
    props.initialCompare,
  );
  const [isProjecting, startProjectTransition] = React.useTransition();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);

  const editable =
    (props.scenarioStatus === "draft" || props.scenarioStatus === "under_review") &&
    props.feeScheduleState === "draft";

  const projectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = React.useRef(false);

  /* ============================================================
   * Debounced live recalc + autosave
   * ============================================================ */
  React.useEffect(() => {
    if (!dirtyRef.current) return;
    // Schedule debounced projection.
    if (projectTimer.current) clearTimeout(projectTimer.current);
    projectTimer.current = setTimeout(() => {
      startProjectTransition(async () => {
        try {
          const res = await projectScenarioById({ id: props.scenarioId });
          setProjection(res.projection);
        } catch (err) {
          // Non-fatal — show last-known projection. Errors land in the save flow.
          console.error("projectScenarioById failed", err);
        }
      });
    }, PROJECT_DEBOUNCE_MS);

    // Schedule debounced autosave.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveNow();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (projectTimer.current) clearTimeout(projectTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // saveNow is stable via closure — re-run only on config change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseConfig]);

  async function saveNow() {
    if (!dirtyRef.current) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await updateScenarioConfig({
        id: props.scenarioId,
        baseConfig,
      });
      setProjection(res.projection);
      setLastSavedAt(new Date());
      dirtyRef.current = false;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  function handleConfigChange(next: FeeBaseConfig) {
    setBaseConfig(next);
    dirtyRef.current = true;
  }

  /* ============================================================
   * State-machine actions
   * ============================================================ */

  async function handleSubmitForApproval() {
    if (!confirm("Submit this scenario for board approval? Editing will lock.")) return;
    try {
      await transitionScenario({ id: props.scenarioId, to: "submitted" });
      await transitionFeeSchedule({
        feeScheduleId: props.feeScheduleId,
        to: "submitted",
      });
      router.refresh();
    } catch (err) {
      alert(`Submit failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  async function handleMarkApproved() {
    const ref = window.prompt(
      "Approval reference (email subject, minutes link, etc.):",
    );
    if (!ref) return;
    try {
      await transitionFeeSchedule({
        feeScheduleId: props.feeScheduleId,
        to: "approved",
        approvalReference: ref,
      });
      router.refresh();
    } catch (err) {
      alert(`Approve failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  async function handlePromoteToActive() {
    const phrase = window.prompt(
      'Type "APPROVED" to promote this schedule to Active. The current Active schedule will be archived.',
    );
    if (phrase !== "APPROVED") return;
    const effectiveStart = window.prompt(
      "Effective start date (YYYY-MM-DD):",
      new Date().toISOString().slice(0, 10),
    );
    if (!effectiveStart) return;
    try {
      await transitionFeeSchedule({
        feeScheduleId: props.feeScheduleId,
        to: "active",
        confirmationPhrase: "APPROVED",
        effectiveStart,
      });
      router.refresh();
    } catch (err) {
      alert(`Activate failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  async function handleArchive() {
    const reason = window.prompt("Archive reason (optional):") ?? undefined;
    try {
      await transitionFeeSchedule({
        feeScheduleId: props.feeScheduleId,
        to: "archived",
        reason,
      });
      await transitionScenario({
        id: props.scenarioId,
        to: "archived",
        note: reason,
      });
      router.refresh();
    } catch (err) {
      alert(`Archive failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  /* ============================================================
   * Render
   * ============================================================ */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-navy-900">
            {props.scenarioName}
          </h1>
          <ScenarioStatusBadge status={props.scenarioStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void saveNow()}
            disabled={!editable || isSaving}
          >
            {isSaving ? "Saving…" : "Save draft"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmitForApproval}
            disabled={!editable}
          >
            Submit for approval
          </Button>
          {props.feeScheduleState === "submitted" ? (
            <Button variant="primary" size="sm" onClick={handleMarkApproved}>
              Mark approved
            </Button>
          ) : null}
          {props.feeScheduleState === "approved" ? (
            <Button variant="primary" size="sm" onClick={handlePromoteToActive}>
              Promote to active
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/admin/modeler/scenarios/${props.scenarioId}/compare`)}
          >
            Compare
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              window.open(`/api/exports/scenario/${props.scenarioId}?format=pdf`, "_blank")
            }
          >
            Export PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              window.open(`/api/exports/scenario/${props.scenarioId}?format=csv`, "_blank")
            }
          >
            Export CSV
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleArchive}
            disabled={props.feeScheduleState === "archived"}
          >
            Archive
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <FeeScheduleStateMachine current={props.feeScheduleState} />
        </CardContent>
      </Card>

      {!editable ? (
        <Card>
          <CardContent>
            <p className="text-sm text-amber-700">
              This scenario is <strong>{props.scenarioStatus}</strong> and its
              underlying schedule is <strong>{props.feeScheduleState}</strong>.
              Editing is locked. Clone it to a new draft to modify.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Two-column layout (collapses to stack on mobile) */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div>
          <RateMatrixEditor
            value={baseConfig}
            onChange={handleConfigChange}
            readOnly={!editable}
          />
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <ProjectionPanel
            projection={projection}
            compare={compare}
            isStale={isProjecting}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-lg border border-navy-100 bg-white p-3 text-xs text-slate-500 shadow-sm">
        <span>
          {isSaving
            ? "Saving…"
            : lastSavedAt
              ? `Saved ${timeAgo(lastSavedAt)}`
              : dirtyRef.current
                ? "Unsaved changes"
                : "All changes saved"}
        </span>
        {saveError ? (
          <span className="text-red-700">Couldn’t save — {saveError}</span>
        ) : null}
      </div>

      {/* Acknowledge compare prop so React doesn't complain about unused. */}
      {compare ? null : null}
    </div>
  );
}

function timeAgo(date: Date): string {
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.round(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toISOString().slice(0, 10);
}
