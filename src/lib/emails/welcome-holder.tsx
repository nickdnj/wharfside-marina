import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS } from "./_layout";

export type Props = {
  /** Holder's legal name for greeting. */
  name: string;
  /** Magic-link URL (already signed). */
  signInUrl: string;
  /** Days the welcome link remains valid (default 7). */
  signInValidDays?: number;
  /** Their slip number, if assigned. */
  slipNumber?: string;
};

export const subject = "Welcome to the Wharfside slip-holder portal";

export default function WelcomeHolder({
  name,
  signInUrl,
  signInValidDays = 7,
  slipNumber,
}: Props) {
  return (
    <EmailShell
      title="Welcome aboard."
      preview="Your Wharfside slip-holder portal is ready — set up your account."
    >
      <Text style={{ margin: "0 0 14px" }}>Hi {name},</Text>
      <Text style={{ margin: "0 0 14px" }}>
        Kathy at ECI just set you up with an account on the new Wharfside Marina
        slip-holder portal. From here you’ll be able to view your slip
        {slipNumber ? ` (Slip ${slipNumber})` : ""}, upload your insurance and
        registration, and update your contact information — all in one place.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={signInUrl} style={buttonStyle}>
          Set up my account
        </Button>
      </Text>
      <Text style={{ margin: "16px 0 14px", fontSize: 14, color: COLORS.slate }}>
        This first-time sign-in link is good for {signInValidDays} days. After
        that, you can request a fresh link any time from the sign-in page — we
        use magic links, so there’s no password to remember.
      </Text>
      <Text style={{ margin: "20px 0 0", fontSize: 14 }}>
        Questions? Reply to this email and Kathy will get back to you, or call
        ECI directly at 732-751-1991.
      </Text>
    </EmailShell>
  );
}
