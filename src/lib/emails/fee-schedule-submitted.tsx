import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS } from "./_layout";

export type Props = {
  reviewerName: string;
  scheduleName: string;
  /** Headline projected revenue (already formatted as currency by caller, or leave numeric). */
  projectedRevenue: number;
  /** vs Active delta, signed. */
  deltaVsActive: number;
  submitterName: string;
  pdfUrl: string;
  reviewUrl: string;
};

export const subject = (p: Props) =>
  `Board review: ${p.scheduleName}`;

const dollar = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export default function FeeScheduleSubmitted(p: Props) {
  const sign = p.deltaVsActive >= 0 ? "+" : "−";
  return (
    <EmailShell
      title="A fee schedule has been submitted for review"
      preview={`${p.scheduleName} — ${dollar(p.projectedRevenue)} projected`}
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.reviewerName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        {p.submitterName} has submitted the following fee schedule for board
        review:
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
        <strong>{p.scheduleName}</strong>
        <br />
        Projected revenue: <strong>{dollar(p.projectedRevenue)}</strong>
        <br />
        vs. current Active: <strong>{sign}{dollar(Math.abs(p.deltaVsActive))}</strong>
      </Text>
      <Text style={{ margin: "0 0 14px" }}>
        The full breakdown — including per-component contributions and a
        per-holder impact roll-up — is in the attached PDF and in the app.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.reviewUrl} style={buttonStyle}>
          Open the schedule in the app
        </Button>
      </Text>
      <Text style={{ margin: "12px 0 0", fontSize: 14 }}>
        Or download the board-ready PDF:{" "}
        <a href={p.pdfUrl} style={{ color: COLORS.navy }}>
          {p.scheduleName}.pdf
        </a>
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        This schedule is frozen at submission — no further edits can be made
        without first archiving and starting a new draft. Approval is recorded
        out-of-band (email or minutes) and then logged in the app.
      </Text>
    </EmailShell>
  );
}
