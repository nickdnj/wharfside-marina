import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS, formatDate } from "./_layout";

export type Props = {
  holderName: string;
  docLabel: string;
  vesselName?: string;
  /** ISO date string — when it expired. */
  expirationDate: string;
  uploadUrl: string;
};

export const subject = (p: Props) =>
  `Expired: ${p.docLabel}${p.vesselName ? ` for ${p.vesselName}` : ""}`;

export default function DocExpired(p: Props) {
  return (
    <EmailShell
      title="A document has expired"
      preview={`Your ${p.docLabel} expired ${formatDate(p.expirationDate)}.`}
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.holderName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        Your <strong>{p.docLabel}</strong>
        {p.vesselName ? <> for <em>{p.vesselName}</em></> : null}{" "}
        expired on <strong>{formatDate(p.expirationDate)}</strong>. Marina
        rules require this document to be current — please upload a renewed
        copy at your earliest convenience.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.uploadUrl} style={buttonStyle}>
          Upload the renewed document
        </Button>
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        If you’re actively working on the renewal, reply to this email and let
        Kathy know the expected date — we’ll note it on your record. Questions?
        Call ECI at 732-751-1991.
      </Text>
    </EmailShell>
  );
}
