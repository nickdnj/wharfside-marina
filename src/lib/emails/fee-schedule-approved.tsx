import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS } from "./_layout";

export type Props = {
  adminName: string;
  scheduleName: string;
  /** Approval source: email subject, minutes link, or note. */
  approvalReference: string;
  approvedBy: string;
  detailUrl: string;
};

export const subject = (p: Props) =>
  `Fee schedule approved: ${p.scheduleName}`;

export default function FeeScheduleApproved(p: Props) {
  return (
    <EmailShell
      title="A fee schedule has been approved"
      preview="The schedule is approved and ready to be promoted to Active."
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {p.adminName},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        The fee schedule <strong>{p.scheduleName}</strong> has been marked
        Approved in the system by {p.approvedBy}.
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
        Approval reference: <strong>{p.approvalReference}</strong>
      </Text>
      <Text style={{ margin: "0 0 14px" }}>
        Approved schedules don’t drive billing on their own — someone with admin
        access still needs to promote it to Active, which will archive the
        current Active schedule and begin issuing the new charges.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={p.detailUrl} style={buttonStyle}>
          Review and promote to Active
        </Button>
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14, color: COLORS.slate }}>
        The state-machine audit trail captures every transition with actor,
        timestamp, and approval reference.
      </Text>
    </EmailShell>
  );
}
