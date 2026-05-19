import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell, COLORS, formatDate } from "./_layout";

export type Props = {
  holderName: string;
  vesselName: string;
  slipNumber: string;
  startDate: string;
  endDate: string;
  seasonYear: number;
  /** ≥20 chars — provided by admin. */
  reason: string;
};

export const subject = (p: Props) =>
  `Your Wharfside slip assignment for ${p.seasonYear} has been cancelled`;

export default function AssignmentCancelled(p: Props) {
  return (
    <EmailShell
      title="A slip assignment has been cancelled"
      preview="An assignment on your account was cancelled."
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.holderName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        We’re writing to let you know that the following slip assignment has
        been cancelled:
      </Text>
      <Text
        style={{
          margin: "0 0 14px",
          padding: "12px 14px",
          backgroundColor: "#f4f1ea",
          borderRadius: 8,
          fontSize: 15,
        }}
      >
        Slip: <strong>{p.slipNumber}</strong>
        <br />
        Vessel: <strong>{p.vesselName}</strong>
        <br />
        Term: <strong>{formatDate(p.startDate)}</strong> through{" "}
        <strong>{formatDate(p.endDate)}</strong>
        <br />
        Season: <strong>{p.seasonYear}</strong>
      </Text>
      <Text style={{ margin: "0 0 14px" }}>Reason recorded by ECI:</Text>
      <Text
        style={{
          margin: "0 0 14px",
          padding: "12px 14px",
          borderLeft: `3px solid ${COLORS.gold}`,
          backgroundColor: "#fcf6e8",
          fontSize: 15,
        }}
      >
        {p.reason}
      </Text>
      <Text style={{ margin: "0 0 14px" }}>
        Any billing related to this assignment will be reconciled in AppFolio
        on your next statement. If you have questions or this was unexpected,
        please reply to this email or call ECI at 732-751-1991.
      </Text>
    </EmailShell>
  );
}
