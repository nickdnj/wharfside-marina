import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS } from "./_layout";

export type Props = {
  name: string;
  resetUrl: string;
  /** Lifetime of the reset link, in minutes. Default 30. */
  expiresInMinutes?: number;
  /** IP address the request came from, for transparency. */
  requestIp?: string;
};

export const subject = "Reset your Wharfside admin password";

export default function PasswordReset({
  name,
  resetUrl,
  expiresInMinutes = 30,
  requestIp,
}: Props) {
  return (
    <EmailShell
      title="Reset your password"
      preview="Reset your Wharfside admin password."
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {name},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        We received a request to reset the password for your Wharfside admin
        account. The link below will let you set a new password and expires in
        about {expiresInMinutes} minutes. Your two-factor (TOTP) is unchanged.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={resetUrl} style={buttonStyle}>
          Set a new password
        </Button>
      </Text>
      {requestIp ? (
        <Text style={{ margin: "20px 0 8px", fontSize: 13, color: COLORS.slate }}>
          This request came from {requestIp}.
        </Text>
      ) : null}
      <Text style={{ margin: "16px 0 0", fontSize: 13, color: COLORS.slate }}>
        Didn’t ask for this? You can safely ignore this email — your password
        won’t change unless you click the link above. If you’re concerned,
        reply to this email so Kathy can review the audit log.
      </Text>
    </EmailShell>
  );
}
