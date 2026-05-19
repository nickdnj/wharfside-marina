/**
 * Shared layout primitives for Wharfside email templates.
 *
 * Brand:
 *   navy:   #1a3a5c
 *   gold:   #c9a227
 *   sand:   #e8dcc4
 *   paper:  #fafaf7
 *
 * Templates compose <EmailShell title="..." preview="...">...</EmailShell>.
 */

import * as React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export const COLORS = {
  navy: "#1a3a5c",
  gold: "#c9a227",
  sand: "#e8dcc4",
  paper: "#fafaf7",
  slate: "#475569",
  red: "#b91c1c",
  green: "#15803d",
  amber: "#d97706",
};

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wharfsidemarina.com";
export const ECI_PHONE = "732-751-1991";
export const ECI_EMAIL = "kathy.vanecek@idealmgt.com";
export const ECI_AFTER_HOURS = "732-970-6886";

const bodyStyle: React.CSSProperties = {
  backgroundColor: COLORS.paper,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
  color: COLORS.slate,
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  maxWidth: "560px",
  margin: "32px auto",
  backgroundColor: "#ffffff",
  border: `1px solid ${COLORS.sand}`,
  borderRadius: 12,
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  backgroundColor: COLORS.navy,
  padding: "20px 28px",
};

const headerTitleStyle: React.CSSProperties = {
  fontFamily: "'Source Serif Pro', Georgia, serif",
  fontSize: 20,
  color: "#ffffff",
  margin: 0,
  letterSpacing: 0.3,
};

const headerSubStyle: React.CSSProperties = {
  fontSize: 13,
  color: COLORS.sand,
  margin: "4px 0 0",
};

const contentStyle: React.CSSProperties = {
  padding: "28px 28px 8px",
  fontSize: 16,
  lineHeight: 1.55,
  color: COLORS.slate,
};

const footerStyle: React.CSSProperties = {
  padding: "12px 28px 24px",
  fontSize: 12,
  color: "#94a3b8",
  textAlign: "center" as const,
};

const goldAccent: React.CSSProperties = {
  height: 3,
  backgroundColor: COLORS.gold,
};

export function EmailShell(props: {
  title: string;
  preview: string;
  /** Set true for marketing / non-transactional only — adds unsubscribe footer. */
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={headerTitleStyle}>Wharfside Marina</Text>
            <Text style={headerSubStyle}>Monmouth Beach, NJ — on the Shrewsbury River</Text>
          </Section>
          <div style={goldAccent} />

          <Section style={contentStyle}>
            <Text
              style={{
                fontFamily: "'Source Serif Pro', Georgia, serif",
                fontSize: 22,
                color: COLORS.navy,
                margin: "0 0 16px",
              }}
            >
              {props.title}
            </Text>
            {props.children}
          </Section>

          <Hr style={{ borderColor: COLORS.sand, margin: "12px 0" }} />

          <Section style={footerStyle}>
            <Text style={{ margin: "0 0 6px" }}>
              East Coast – Ideal Management · {ECI_PHONE} · {ECI_EMAIL}
            </Text>
            <Text style={{ margin: "0 0 6px" }}>
              After-hours emergency: {ECI_AFTER_HOURS}
            </Text>
            {props.showUnsubscribe && props.unsubscribeUrl ? (
              <Text style={{ margin: "8px 0 0" }}>
                <a href={props.unsubscribeUrl} style={{ color: "#94a3b8" }}>
                  Unsubscribe
                </a>
                {" · "}
                <a href={`${APP_URL}/privacy`} style={{ color: "#94a3b8" }}>
                  Privacy
                </a>
              </Text>
            ) : (
              <Text style={{ margin: "8px 0 0" }}>
                This is a transactional message about your Wharfside slip-holder account.
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: COLORS.navy,
  color: "#ffffff",
  textDecoration: "none",
  padding: "12px 24px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 15,
};

export const buttonGoldStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: COLORS.gold,
  color: COLORS.navy,
};

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
