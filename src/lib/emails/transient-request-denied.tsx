import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell, COLORS, formatDate } from "./_layout";

export type Props = {
  requesterName: string;
  vesselName: string;
  requestedStart: string;
  requestedEnd: string;
  /** ≥20 chars — provided by admin. */
  reason: string;
};

export const subject = "Update on your Wharfside transient slip request";

export default function TransientRequestDenied(p: Props) {
  return (
    <EmailShell
      title="Thanks for reaching out"
      preview="Unfortunately we’re unable to accommodate your request."
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.requesterName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        Thanks again for your request for a transient slip at Wharfside for{" "}
        <strong>{p.vesselName}</strong>,{" "}
        <strong>{formatDate(p.requestedStart)}</strong> through{" "}
        <strong>{formatDate(p.requestedEnd)}</strong>. Unfortunately, we’re
        not going to be able to accommodate this one.
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
        If your plans shift or you’d like to try a different week, please send
        a new request through the marina website and we’ll take another look.
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        Wishing you fair winds. Reply to this email if you have questions, or
        call ECI at 732-751-1991.
      </Text>
    </EmailShell>
  );
}
