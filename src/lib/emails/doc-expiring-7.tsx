import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS, formatDate } from "./_layout";
import type { Props } from "./doc-expiring-60";

export const subject = (p: Props) =>
  `Important: ${p.docLabel}${p.vesselName ? ` for ${p.vesselName}` : ""} expires in 7 days`;

export default function DocExpiring7(p: Props) {
  return (
    <EmailShell
      title="A document expires in 7 days"
      preview={`Please upload your renewed ${p.docLabel} before ${formatDate(p.expirationDate)}.`}
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.holderName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        Your <strong>{p.docLabel}</strong>
        {p.vesselName ? <> for <em>{p.vesselName}</em></> : null}{" "}
        expires in 7 days, on{" "}
        <strong>{formatDate(p.expirationDate)}</strong>. Please upload the
        renewed document as soon as you can.
      </Text>
      <Text style={{ margin: "0 0 14px" }}>
        If you’re mid-renewal with your carrier (insurance is the usual
        culprit), reply to this email and let Kathy know — we can hold off the
        next reminder while you finish.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.uploadUrl} style={buttonStyle}>
          Upload now
        </Button>
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        Need help? Reply to this email or call ECI at 732-751-1991.
      </Text>
    </EmailShell>
  );
}
