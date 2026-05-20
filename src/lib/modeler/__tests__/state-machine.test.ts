import { describe, it, expect } from "vitest";

import {
  assertFeeScheduleTransition,
  assertScenarioTransition,
  isFeeScheduleEditable,
  isScenarioEditable,
  isLegalFeeScheduleTransition,
  isLegalScenarioTransition,
  FEE_SCHEDULE_FLOW,
  SCENARIO_FLOW,
} from "../state-machine";
import { ScenarioError } from "../errors";

describe("fee_schedule state machine", () => {
  it("permits draft → submitted → approved → active → archived", () => {
    expect(isLegalFeeScheduleTransition("draft", "submitted")).toBe(true);
    expect(isLegalFeeScheduleTransition("submitted", "approved")).toBe(true);
    expect(isLegalFeeScheduleTransition("approved", "active")).toBe(true);
    expect(isLegalFeeScheduleTransition("active", "archived")).toBe(true);
  });

  it("permits archive from any non-archived state", () => {
    expect(isLegalFeeScheduleTransition("draft", "archived")).toBe(true);
    expect(isLegalFeeScheduleTransition("submitted", "archived")).toBe(true);
    expect(isLegalFeeScheduleTransition("approved", "archived")).toBe(true);
    expect(isLegalFeeScheduleTransition("active", "archived")).toBe(true);
  });

  it("blocks reverse transitions", () => {
    expect(isLegalFeeScheduleTransition("submitted", "draft")).toBe(false);
    expect(isLegalFeeScheduleTransition("approved", "submitted")).toBe(false);
    expect(isLegalFeeScheduleTransition("active", "approved")).toBe(false);
  });

  it("blocks skipping states (e.g., draft → active)", () => {
    expect(isLegalFeeScheduleTransition("draft", "active")).toBe(false);
    expect(isLegalFeeScheduleTransition("draft", "approved")).toBe(false);
    expect(isLegalFeeScheduleTransition("submitted", "active")).toBe(false);
  });

  it("archived is terminal", () => {
    expect(isLegalFeeScheduleTransition("archived", "draft")).toBe(false);
    expect(isLegalFeeScheduleTransition("archived", "active")).toBe(false);
    expect(isLegalFeeScheduleTransition("archived", "archived")).toBe(false);
  });

  it("assertFeeScheduleTransition throws ScenarioError on illegal", () => {
    expect(() => assertFeeScheduleTransition("draft", "active")).toThrow(ScenarioError);
    try {
      assertFeeScheduleTransition("draft", "active");
    } catch (err) {
      expect((err as ScenarioError).code).toBe("INVALID_TRANSITION");
    }
  });

  it("isFeeScheduleEditable: only draft is editable", () => {
    expect(isFeeScheduleEditable("draft")).toBe(true);
    expect(isFeeScheduleEditable("submitted")).toBe(false);
    expect(isFeeScheduleEditable("approved")).toBe(false);
    expect(isFeeScheduleEditable("active")).toBe(false);
    expect(isFeeScheduleEditable("archived")).toBe(false);
  });

  it("FEE_SCHEDULE_FLOW contains all 5 states in order", () => {
    expect(FEE_SCHEDULE_FLOW).toEqual([
      "draft",
      "submitted",
      "approved",
      "active",
      "archived",
    ]);
  });
});

describe("scenario state machine", () => {
  it("permits draft → under_review → submitted → approved_superseded → archived", () => {
    expect(isLegalScenarioTransition("draft", "under_review")).toBe(true);
    expect(isLegalScenarioTransition("under_review", "submitted")).toBe(true);
    expect(isLegalScenarioTransition("submitted", "approved_superseded")).toBe(true);
    expect(isLegalScenarioTransition("approved_superseded", "archived")).toBe(true);
  });

  it("permits under_review → draft (reopening for edits)", () => {
    expect(isLegalScenarioTransition("under_review", "draft")).toBe(true);
  });

  it("blocks skipping (e.g., draft → submitted)", () => {
    expect(isLegalScenarioTransition("draft", "submitted")).toBe(false);
    expect(isLegalScenarioTransition("draft", "approved_superseded")).toBe(false);
  });

  it("isScenarioEditable: only draft and under_review", () => {
    expect(isScenarioEditable("draft")).toBe(true);
    expect(isScenarioEditable("under_review")).toBe(true);
    expect(isScenarioEditable("submitted")).toBe(false);
    expect(isScenarioEditable("approved_superseded")).toBe(false);
    expect(isScenarioEditable("archived")).toBe(false);
  });

  it("assertScenarioTransition throws ScenarioError on illegal", () => {
    expect(() => assertScenarioTransition("draft", "submitted")).toThrow(ScenarioError);
  });

  it("SCENARIO_FLOW contains all 5 states", () => {
    expect(SCENARIO_FLOW).toContain("draft");
    expect(SCENARIO_FLOW).toContain("under_review");
    expect(SCENARIO_FLOW).toContain("submitted");
    expect(SCENARIO_FLOW).toContain("approved_superseded");
    expect(SCENARIO_FLOW).toContain("archived");
  });
});
