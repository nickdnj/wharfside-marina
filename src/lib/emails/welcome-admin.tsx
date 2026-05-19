import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS } from "./_layout";

export type Props = {
  name: string;
  /** Sign-in URL — lands on the TOTP enrollment page. */
  signInUrl: string;
  role: "super_admin" | "eci_admin" | "board";
  /** True when this email is sent as part of a TOTP reset. */
  isTotpReset?: boolean;
};

const ROLE_LABEL: Record<Props["role"], string> = {
  super_admin: "Super-Admin",
  eci_admin: "ECI Admin",
  board: "Board Member",
};

export const subject = "Your Wharfside admin account is ready";

export default function WelcomeAdmin({ name, signInUrl, role, isTotpReset }: Props) {
  return (
    <EmailShell
      title={isTotpReset ? "Set up two-factor again" : "Welcome to the Wharfside admin app"}
      preview={
        isTotpReset
          ? "Your TOTP has been reset. Re-enroll your authenticator."
          : "Your Wharfside admin account has been created."
      }
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {name},</Text>
      {isTotpReset ? (
        <Text style={{ margin: "0 0 14px" }}>
          Your two-factor (TOTP) authenticator has been reset on your Wharfside
          admin account. Use the link below to sign in and re-enroll your
          authenticator app before performing any admin actions.
        </Text>
      ) : (
        <Text style={{ margin: "0 0 14px" }}>
          Your Wharfside admin account has been created with the role
          {" "}<strong>{ROLE_LABEL[role]}</strong>. On your first sign-in
          we’ll ask you to set a password and enroll an authenticator app
          (Google Authenticator, 1Password, or any TOTP-compatible app) — this
          is required for admin access.
        </Text>
      )}

      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={signInUrl} style={buttonStyle}>
          {isTotpReset ? "Re-enroll TOTP" : "Set up my admin account"}
        </Button>
      </Text>

      <Text style={{ margin: "20px 0 8px", fontSize: 14, color: COLORS.slate }}>
        A few things worth knowing:
      </Text>
      <Text style={{ margin: "0 0 6px", fontSize: 14 }}>
        • Magic-link sign-in isn’t available for admin accounts — you’ll use
        email + password + a 6-digit code each time.
      </Text>
      <Text style={{ margin: "0 0 6px", fontSize: 14 }}>
        • Save the recovery codes you’ll see after enrollment — they’re your
        only way back into the account if you lose your phone.
      </Text>
      <Text style={{ margin: "0 0 6px", fontSize: 14 }}>
        • All admin actions are recorded in the audit log with your name and
        a timestamp.
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14 }}>
        Trouble signing in? Reply to this email or call ECI at 732-751-1991.
      </Text>
    </EmailShell>
  );
}
