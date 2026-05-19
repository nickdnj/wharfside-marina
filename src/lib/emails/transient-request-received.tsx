import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell, COLORS, formatDate } from "./_layout";

export type Props = {
  requesterName: string;
  vesselName: string;
  requestedStart: string;
  requestedEnd: string;
};

export const subject = "We received your transient slip request";

export default function TransientRequestReceived(p: Props) {
  return (
    <EmailShell
      title="Thanks — we have your request"
      preview="We received your Wharfside transient request. We’ll be in touch within 24 hours."
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.requesterName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        Thanks for reaching out — we have your request for a transient slip at
        Wharfside Marina:
      </Text>
      <Text
        style={{
          margin: "0 0 14px",
          padding: "12px 14px",
          backgroundColor: "#f4f1ea",
          borderRadius: 8,
          fontSize: 15,
        }}
      >
        Vessel: <strong>{p.vesselName}</strong>
        <br />
        Dates: <strong>{formatDate(p.requestedStart)}</strong> through{" "}
        <strong>{formatDate(p.requestedEnd)}</strong>
      </Text>
      <Text style={{ margin: "0 0 14px" }}>
        Our dockmaster will review availability and respond within 24 hours. If
        we can fit you in, we’ll send a confirmation with a link to upload your
        certificate of insurance and vessel registration — you’ll have 48 hours
        to complete that step before arrival.
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        Questions? Reply to this email or call ECI at 732-751-1991. For
        weekend / after-hours questions, dock office: 732-970-6886.
      </Text>
    </EmailShell>
  );
}
