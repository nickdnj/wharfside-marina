import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS, formatDate } from "./_layout";

export type Props = {
  requesterName: string;
  vesselName: string;
  slipNumber: string;
  startDate: string;
  endDate: string;
  /** Total nights × per-foot rate (just the headline, breakdown lives on the request page). */
  estimatedTotal: number;
  uploadUrl: string;
  /** When the 48-hour upload window closes — ISO timestamp. */
  uploadExpiresAt: string;
  vhfChannel?: string;
};

export const subject = "Your Wharfside transient slip is approved";

export default function TransientRequestApproved(p: Props) {
  const total = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(p.estimatedTotal);

  const expires = new Date(p.uploadExpiresAt).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <EmailShell
      title="You’re booked — welcome to Wharfside"
      preview="Your transient slip is approved. Please upload your COI and registration within 48 hours."
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.requesterName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        Good news — we’ve approved your request and reserved a slip for you:
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
        Slip: <strong>{p.slipNumber}</strong>
        <br />
        Dates: <strong>{formatDate(p.startDate)}</strong> through{" "}
        <strong>{formatDate(p.endDate)}</strong>
        <br />
        Estimated charges: <strong>{total}</strong> (billed via AppFolio after
        your stay)
      </Text>
      <Text style={{ margin: "0 0 14px" }}>
        Before you arrive, we need two documents on file: your{" "}
        <strong>certificate of insurance</strong> and your{" "}
        <strong>vessel registration</strong>. Use the link below to upload
        both — it’s valid until <strong>{expires}</strong>.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.uploadUrl} style={buttonStyle}>
          Upload COI &amp; registration
        </Button>
      </Text>
      <Text style={{ margin: "20px 0 8px", fontSize: 14 }}>
        On arrival: hail us on VHF channel {p.vhfChannel ?? "9"} as you approach
        the marina. After hours, the dock phone is 732-970-6886.
      </Text>
      <Text style={{ margin: "12px 0 0", fontSize: 14, color: COLORS.slate }}>
        Questions? Reply to this email or call ECI at 732-751-1991.
      </Text>
    </EmailShell>
  );
}
