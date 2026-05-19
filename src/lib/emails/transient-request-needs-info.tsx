import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell, COLORS } from "./_layout";

export type Props = {
  requesterName: string;
  vesselName: string;
  /** Admin’s free-text question (≥20 chars). */
  askMessage: string;
  /** Email address to reply to (defaults to no-reply, but transient flows reply directly to Kathy). */
  replyToEmail?: string;
};

export const subject = "We have a quick question about your transient request";

export default function TransientRequestNeedsInfo(p: Props) {
  return (
    <EmailShell
      title="Quick question before we confirm"
      preview="Reply with the details we need and we’ll finalize your request."
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.requesterName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        Thanks for the transient request for <strong>{p.vesselName}</strong>.
        Before we can approve it, we need a bit more information:
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
        {p.askMessage}
      </Text>
      <Text style={{ margin: "0 0 14px" }}>
        Just reply to this email with the details and we’ll get back to you
        with a confirmation as soon as we can.
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        Prefer to talk? Call ECI at 732-751-1991.
      </Text>
    </EmailShell>
  );
}
