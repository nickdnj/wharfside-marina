import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS, formatDate } from "./_layout";

export type Props = {
  holderName: string;
  /** Plain-English doc label, e.g., "Insurance certificate (COI)". */
  docLabel: string;
  /** Vessel name if the doc is per-vessel; omit for per-holder docs. */
  vesselName?: string;
  /** ISO date string of the expiration. */
  expirationDate: string;
  /** Deep-link to the upload screen with the doc type pre-selected. */
  uploadUrl: string;
};

export const subject = (p: Props) =>
  `Action needed in 60 days: ${p.docLabel}${p.vesselName ? ` for ${p.vesselName}` : ""}`;

export default function DocExpiring60(p: Props) {
  return (
    <EmailShell
      title="Heads-up: a document is coming due"
      preview={`Your ${p.docLabel} expires ${formatDate(p.expirationDate)}.`}
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.holderName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        Your <strong>{p.docLabel}</strong>
        {p.vesselName ? <> for <em>{p.vesselName}</em></> : null}{" "}
        on file with Wharfside expires on{" "}
        <strong>{formatDate(p.expirationDate)}</strong> — about 60 days from
        now. There’s no rush, but it’s a good time to start the renewal so
        you’re not chasing it later in the season.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.uploadUrl} style={buttonStyle}>
          Upload my renewed {p.docLabel.toLowerCase()}
        </Button>
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        Questions or need help? Reply to this email or call ECI at 732-751-1991.
      </Text>
    </EmailShell>
  );
}
