import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS } from "./_layout";

export type Props = {
  holderName: string;
  docLabel: string;
  vesselName?: string;
  /** ≥20 chars — comes from the admin reject modal. */
  reason: string;
  uploadUrl: string;
  reviewerName?: string;
};

export const subject = (p: Props) =>
  `Action needed: ${p.docLabel}${p.vesselName ? ` for ${p.vesselName}` : ""}`;

export default function DocRejected(p: Props) {
  return (
    <EmailShell
      title="We need a different copy of that document"
      preview="Please re-upload — see notes inside."
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.holderName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        We weren’t able to approve the <strong>{p.docLabel}</strong>
        {p.vesselName ? <> you uploaded for <em>{p.vesselName}</em></> : null}.
        {p.reviewerName ? ` ${p.reviewerName} left a note:` : " Here’s what we noticed:"}
      </Text>
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
        Once you’ve sorted it out, upload the updated document using the button
        below and we’ll review it again right away.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.uploadUrl} style={buttonStyle}>
          Upload a corrected document
        </Button>
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        Not sure what we’re asking for? Reply to this email or call
        732-751-1991 and Kathy can walk you through it.
      </Text>
    </EmailShell>
  );
}
