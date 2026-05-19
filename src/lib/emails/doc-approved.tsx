import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS, formatDate } from "./_layout";

export type Props = {
  holderName: string;
  docLabel: string;
  vesselName?: string;
  /** ISO date string. */
  expirationDate?: string;
  portalUrl: string;
  reviewerName?: string;
};

export const subject = (p: Props) =>
  `Approved: ${p.docLabel}${p.vesselName ? ` for ${p.vesselName}` : ""}`;

export default function DocApproved(p: Props) {
  return (
    <EmailShell
      title="Approved — you’re all set"
      preview={`Your ${p.docLabel} has been approved.`}
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.holderName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        Good news — your <strong>{p.docLabel}</strong>
        {p.vesselName ? <> for <em>{p.vesselName}</em></> : null}{" "}
        has been approved
        {p.reviewerName ? ` by ${p.reviewerName}` : ""}.
        {p.expirationDate ? (
          <> The next renewal will be due around{" "}
            <strong>{formatDate(p.expirationDate)}</strong>.</>
        ) : null}
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.portalUrl} style={buttonStyle}>
          View my documents
        </Button>
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        Thanks for keeping your file current.
      </Text>
    </EmailShell>
  );
}
