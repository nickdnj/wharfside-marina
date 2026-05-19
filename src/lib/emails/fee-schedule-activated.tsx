import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS, formatDate } from "./_layout";

export type Props = {
  adminName: string;
  scheduleName: string;
  effectiveStart: string;
  effectiveEnd?: string;
  /** The schedule we just archived (name + id). */
  previousActive?: { name: string; id: string };
  activatedBy: string;
  /** Headline of season charges queued for issuance (count + total). */
  chargesQueued: { count: number; totalAmount: number };
  detailUrl: string;
  csvExportUrl: string;
};

export const subject = (p: Props) =>
  `Now Active: ${p.scheduleName}`;

const dollar = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export default function FeeScheduleActivated(p: Props) {
  return (
    <EmailShell
      title="Fee schedule is now Active"
      preview="Season charges will start exporting to AppFolio with the new rates."
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.adminName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        <strong>{p.scheduleName}</strong> is now the Active fee schedule, as of{" "}
        <strong>{formatDate(p.effectiveStart)}</strong>
        {p.effectiveEnd ? <> through <strong>{formatDate(p.effectiveEnd)}</strong></> : null}.
        It was promoted by {p.activatedBy}.
      </Text>
      {p.previousActive ? (
        <Text style={{ margin: "0 0 14px" }}>
          The previous Active schedule (<em>{p.previousActive.name}</em>) has
          been archived. It’s still available for reference, but no longer
          drives billing.
        </Text>
      ) : null}
      <Text
        style={{
          margin: "0 0 14px",
          padding: "12px 14px",
          backgroundColor: "#f4f1ea",
          borderRadius: 8,
          fontSize: 15,
        }}
      >
        Season charges queued: <strong>{p.chargesQueued.count}</strong>
        <br />
        Total: <strong>{dollar(p.chargesQueued.totalAmount)}</strong>
      </Text>
      <Text style={{ margin: "0 0 14px" }}>
        Holders with confirmed assignments for the new season will receive a
        line-item notice as their charges are issued. The AppFolio CSV is
        ready to download for the next billing run.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.csvExportUrl} style={buttonStyle}>
          Download AppFolio CSV
        </Button>
      </Text>
      <Text style={{ margin: "12px 0 0", fontSize: 14 }}>
        Or view the schedule details:{" "}
        <a href={p.detailUrl} style={{ color: COLORS.navy }}>
          {p.scheduleName}
        </a>
      </Text>
    </EmailShell>
  );
}
