import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS, formatDate } from "./_layout";

export type Props = {
  holderName: string;
  vesselName: string;
  slipNumber: string;
  leaseType: "FULL_SEASON" | "HALF_SEASON_1" | "HALF_SEASON_2" | "TRANSIENT";
  startDate: string;
  endDate: string;
  seasonYear: number;
  /** Total fee for this assignment (annual leases). Omit for transient. */
  estimatedTotal?: number;
  portalUrl: string;
};

const LEASE_LABEL: Record<Props["leaseType"], string> = {
  FULL_SEASON: "Full season",
  HALF_SEASON_1: "First half-season",
  HALF_SEASON_2: "Second half-season",
  TRANSIENT: "Transient",
};

export const subject = (p: Props) =>
  `Confirmed: Slip ${p.slipNumber} for ${p.seasonYear}`;

const dollar = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);

export default function AssignmentConfirmed(p: Props) {
  return (
    <EmailShell
      title="Your slip is confirmed"
      preview={`Slip ${p.slipNumber} confirmed for the ${p.seasonYear} season.`}
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.holderName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        Your slip assignment is confirmed for the {p.seasonYear} season. Here
        are the details we have on file:
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
        Term: <strong>{LEASE_LABEL[p.leaseType]}</strong> —{" "}
        <strong>{formatDate(p.startDate)}</strong> through{" "}
        <strong>{formatDate(p.endDate)}</strong>
        {p.estimatedTotal !== undefined ? (
          <>
            <br />
            Fee: <strong>{dollar(p.estimatedTotal)}</strong> (billed through
            AppFolio)
          </>
        ) : null}
      </Text>
      <Text style={{ margin: "0 0 14px" }}>
        If anything looks wrong — vessel mismatch, dates, slip number — please
        reply to this email and Kathy will take a look right away.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.portalUrl} style={buttonStyle}>
          View in my portal
        </Button>
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        Remember: your COI, registration, and indemnification must be current
        before the season starts. We’ll send reminders ahead of any expirations.
      </Text>
    </EmailShell>
  );
}
