import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS } from "./_layout";

export type Props = {
  holderName: string;
  seasonYear: number;
  /** Slip number(s) covered by this charge bundle. */
  slipNumber: string;
  lineItems: Array<{
    chargeType: string;
    description: string;
    amount: number;
  }>;
  total: number;
  portalUrl: string;
};

export const subject = (p: Props) =>
  `${p.seasonYear} Wharfside slip charges — Slip ${p.slipNumber}`;

const dollar = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);

export default function SeasonChargeIssued(p: Props) {
  return (
    <EmailShell
      title={`Your ${p.seasonYear} slip charges`}
      preview={`Total ${dollar(p.total)} — billed through AppFolio.`}
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.holderName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        Your slip charges for the {p.seasonYear} season have been issued to
        AppFolio for billing. The line items below should appear on your next
        AppFolio statement — payment is handled there as usual.
      </Text>
      <Text style={{ margin: "0 0 6px", fontSize: 14, color: COLORS.slate }}>
        Slip {p.slipNumber}
      </Text>
      <div
        style={{
          margin: "0 0 16px",
          padding: "12px 14px",
          backgroundColor: "#f4f1ea",
          borderRadius: 8,
          fontSize: 15,
        }}
      >
        {p.lineItems.map((item) => (
          <Text
            key={`${item.chargeType}-${item.description}`}
            style={{ margin: "0 0 6px" }}
          >
            <span style={{ display: "inline-block", minWidth: 220 }}>
              {item.description}
            </span>{" "}
            <strong>{dollar(item.amount)}</strong>
          </Text>
        ))}
        <Text style={{ margin: "8px 0 0", fontSize: 16 }}>
          Total: <strong>{dollar(p.total)}</strong>
        </Text>
      </div>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.portalUrl} style={buttonStyle}>
          View in my portal
        </Button>
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        Questions about a line item? Reply to this email and we’ll walk you
        through it. Questions about payment timing or methods are best handled
        through your AppFolio account.
      </Text>
    </EmailShell>
  );
}
