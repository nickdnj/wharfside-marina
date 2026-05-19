import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailShell, buttonStyle, COLORS } from "./_layout";

export type Props = {
  /** Full magic-link URL (already signed; do not append). */
  url: string;
  /** Token lifetime, in minutes — for the body copy. Default 15. */
  expiresInMinutes?: number;
  /** Optional name for personalization. */
  name?: string;
};

export const subject = "Sign in to Wharfside Marina";

export default function MagicLink({ url, expiresInMinutes = 15, name }: Props) {
  return (
    <EmailShell title="Sign in to your Wharfside account" preview="Your single-use sign-in link is ready.">
      <Text style={{ margin: "0 0 14px" }}>
        {name ? `Hi ${name},` : "Hi,"}
      </Text>
      <Text style={{ margin: "0 0 14px" }}>
        Tap the button below to sign in to your Wharfside slip-holder portal. The link
        works once and expires in about {expiresInMinutes} minutes.
      </Text>
      <Text style={{ margin: "16px 0 8px" }}>
        <Button href={url} style={buttonStyle}>
          Sign in to Wharfside
        </Button>
      </Text>
      <Text style={{ margin: "20px 0 8px", fontSize: 13, color: COLORS.slate }}>
        If the button doesn’t work, paste this link into your browser:
      </Text>
      <Text style={{ margin: "0 0 14px", fontSize: 13, wordBreak: "break-all" }}>
        <a href={url} style={{ color: COLORS.navy }}>{url}</a>
      </Text>
      <Text style={{ margin: "16px 0 0", fontSize: 13, color: COLORS.slate }}>
        Didn’t request this? You can safely ignore this email — no one can sign in
        without clicking the link.
      </Text>
    </EmailShell>
  );
}
