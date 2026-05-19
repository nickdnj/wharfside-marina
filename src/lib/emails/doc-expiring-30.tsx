import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS, formatDate } from "./_layout";
import type { Props } from "./doc-expiring-60";

export const subject = (p: Props) =>
  `Reminder: ${p.docLabel}${p.vesselName ? ` for ${p.vesselName}` : ""} expires in 30 days`;

export default function DocExpiring30(p: Props) {
  return (
    <EmailShell
      title="A document expires in 30 days"
      preview={`Your ${p.docLabel} expires ${formatDate(p.expirationDate)}.`}
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.holderName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        A quick reminder that your <strong>{p.docLabel}</strong>
        {p.vesselName ? <> for <em>{p.vesselName}</em></> : null}{" "}
        expires on <strong>{formatDate(p.expirationDate)}</strong> — about 30
        days from now. Please upload the renewed document when you have it so
        we don’t need to chase you closer to the date.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.uploadUrl} style={buttonStyle}>
          Upload my renewed {p.docLabel.toLowerCase()}
        </Button>
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        Already uploaded? Thanks — once it’s approved you’ll stop hearing from
        us about it. Need help? Reply to this email or call 732-751-1991.
      </Text>
    </EmailShell>
  );
}
