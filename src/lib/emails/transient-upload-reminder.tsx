import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS } from "./_layout";

export type Props = {
  requesterName: string;
  vesselName: string;
  slipNumber: string;
  uploadUrl: string;
  /** ISO timestamp when the upload window closes. */
  uploadExpiresAt: string;
};

export const subject = "Reminder: please upload your COI and registration";

export default function TransientUploadReminder(p: Props) {
  const expires = new Date(p.uploadExpiresAt).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <EmailShell
      title="Quick reminder — documents needed"
      preview="Your upload window closes soon. Send your COI and registration to lock in your stay."
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.requesterName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        Friendly reminder — we’re holding slip <strong>{p.slipNumber}</strong>{" "}
        for <strong>{p.vesselName}</strong>, but we still need your certificate
        of insurance and vessel registration before your stay can be locked in.
      </Text>
      <Text style={{ margin: "0 0 14px" }}>
        Your upload link expires <strong>{expires}</strong>. After that we may
        need to release the slip — please send the documents over when you can.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.uploadUrl} style={buttonStyle}>
          Upload now
        </Button>
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        Already uploaded? Thanks — disregard this note. Questions? Call ECI at
        732-751-1991 or reply to this email.
      </Text>
    </EmailShell>
  );
}
