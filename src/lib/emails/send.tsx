/**
 * Wharfside Marina — typed Resend wrapper.
 *
 * Usage:
 *   await sendEmail({
 *     to: "joe@example.com",
 *     template: "magic-link",
 *     props: { url: "https://...", expiresInMinutes: 15 },
 *   });
 *
 * The discriminated union enforces that `template` and `props` match.
 * Adding a new template:
 *   1. Add a `.tsx` file in this directory exporting a default React
 *      component and a `subject` string constant.
 *   2. Add the new `{ template, props }` member to `EmailMessage` below.
 *   3. Add the routing case in `renderEmail()`.
 */

import { Resend } from "resend";
import { render } from "@react-email/render";
import React from "react";

import MagicLink, {
  subject as magicLinkSubject,
  type Props as MagicLinkProps,
} from "./magic-link";
import WelcomeHolder, {
  subject as welcomeHolderSubject,
  type Props as WelcomeHolderProps,
} from "./welcome-holder";
import WelcomeAdmin, {
  subject as welcomeAdminSubject,
  type Props as WelcomeAdminProps,
} from "./welcome-admin";
import PasswordReset, {
  subject as passwordResetSubject,
  type Props as PasswordResetProps,
} from "./password-reset";
import DocExpiring60, {
  subject as docExpiring60Subject,
  type Props as DocExpiringProps,
} from "./doc-expiring-60";
import DocExpiring30, {
  subject as docExpiring30Subject,
} from "./doc-expiring-30";
import DocExpiring7, {
  subject as docExpiring7Subject,
} from "./doc-expiring-7";
import DocExpired, {
  subject as docExpiredSubject,
  type Props as DocExpiredProps,
} from "./doc-expired";
import DocApproved, {
  subject as docApprovedSubject,
  type Props as DocApprovedProps,
} from "./doc-approved";
import DocRejected, {
  subject as docRejectedSubject,
  type Props as DocRejectedProps,
} from "./doc-rejected";
import TransientRequestReceived, {
  subject as transientReceivedSubject,
  type Props as TransientReceivedProps,
} from "./transient-request-received";
import TransientRequestApproved, {
  subject as transientApprovedSubject,
  type Props as TransientApprovedProps,
} from "./transient-request-approved";
import TransientRequestDenied, {
  subject as transientDeniedSubject,
  type Props as TransientDeniedProps,
} from "./transient-request-denied";
import TransientRequestNeedsInfo, {
  subject as transientNeedsInfoSubject,
  type Props as TransientNeedsInfoProps,
} from "./transient-request-needs-info";
import TransientUploadReminder, {
  subject as transientUploadReminderSubject,
  type Props as TransientUploadReminderProps,
} from "./transient-upload-reminder";
import FeeScheduleSubmitted, {
  subject as feeSubmittedSubject,
  type Props as FeeSubmittedProps,
} from "./fee-schedule-submitted";
import FeeScheduleApproved, {
  subject as feeApprovedSubject,
  type Props as FeeApprovedProps,
} from "./fee-schedule-approved";
import FeeScheduleActivated, {
  subject as feeActivatedSubject,
  type Props as FeeActivatedProps,
} from "./fee-schedule-activated";
import AssignmentConfirmed, {
  subject as assignmentConfirmedSubject,
  type Props as AssignmentConfirmedProps,
} from "./assignment-confirmed";
import AssignmentCancelled, {
  subject as assignmentCancelledSubject,
  type Props as AssignmentCancelledProps,
} from "./assignment-cancelled";
import SeasonChargeIssued, {
  subject as seasonChargeIssuedSubject,
  type Props as SeasonChargeIssuedProps,
} from "./season-charge-issued";

/* ============================================================
 * Discriminated union — adding a template? Add it here.
 * ============================================================ */

export type EmailMessage =
  | { template: "magic-link"; props: MagicLinkProps }
  | { template: "welcome-holder"; props: WelcomeHolderProps }
  | { template: "welcome-admin"; props: WelcomeAdminProps }
  | { template: "password-reset"; props: PasswordResetProps }
  | { template: "doc-expiring-60"; props: DocExpiringProps }
  | { template: "doc-expiring-30"; props: DocExpiringProps }
  | { template: "doc-expiring-7"; props: DocExpiringProps }
  | { template: "doc-expired"; props: DocExpiredProps }
  | { template: "doc-approved"; props: DocApprovedProps }
  | { template: "doc-rejected"; props: DocRejectedProps }
  | { template: "transient-request-received"; props: TransientReceivedProps }
  | { template: "transient-request-approved"; props: TransientApprovedProps }
  | { template: "transient-request-denied"; props: TransientDeniedProps }
  | { template: "transient-request-needs-info"; props: TransientNeedsInfoProps }
  | { template: "transient-upload-reminder"; props: TransientUploadReminderProps }
  | { template: "fee-schedule-submitted"; props: FeeSubmittedProps }
  | { template: "fee-schedule-approved"; props: FeeApprovedProps }
  | { template: "fee-schedule-activated"; props: FeeActivatedProps }
  | { template: "assignment-confirmed"; props: AssignmentConfirmedProps }
  | { template: "assignment-cancelled"; props: AssignmentCancelledProps }
  | { template: "season-charge-issued"; props: SeasonChargeIssuedProps };

export type SendEmailInput = {
  to: string | string[];
  replyTo?: string;
  /** Idempotency key — Resend's `headers["Idempotency-Key"]` */
  idempotencyKey?: string;
  /** Categorize for the Resend dashboard. */
  tags?: { name: string; value: string }[];
} & EmailMessage;

const FROM = "Wharfside Marina <no-reply@wharfsidemb.com>";
const REPLY_TO_DEFAULT = "kathy.vanecek@idealmgt.com";

/* ============================================================
 * Render helpers
 * ============================================================ */

function renderEmail(msg: EmailMessage): { subject: string; element: React.ReactElement } {
  switch (msg.template) {
    case "magic-link":
      return { subject: magicLinkSubject, element: <MagicLink {...msg.props} /> };
    case "welcome-holder":
      return { subject: welcomeHolderSubject, element: <WelcomeHolder {...msg.props} /> };
    case "welcome-admin":
      return { subject: welcomeAdminSubject, element: <WelcomeAdmin {...msg.props} /> };
    case "password-reset":
      return { subject: passwordResetSubject, element: <PasswordReset {...msg.props} /> };
    case "doc-expiring-60":
      return { subject: docExpiring60Subject(msg.props), element: <DocExpiring60 {...msg.props} /> };
    case "doc-expiring-30":
      return { subject: docExpiring30Subject(msg.props), element: <DocExpiring30 {...msg.props} /> };
    case "doc-expiring-7":
      return { subject: docExpiring7Subject(msg.props), element: <DocExpiring7 {...msg.props} /> };
    case "doc-expired":
      return { subject: docExpiredSubject(msg.props), element: <DocExpired {...msg.props} /> };
    case "doc-approved":
      return { subject: docApprovedSubject(msg.props), element: <DocApproved {...msg.props} /> };
    case "doc-rejected":
      return { subject: docRejectedSubject(msg.props), element: <DocRejected {...msg.props} /> };
    case "transient-request-received":
      return { subject: transientReceivedSubject, element: <TransientRequestReceived {...msg.props} /> };
    case "transient-request-approved":
      return { subject: transientApprovedSubject, element: <TransientRequestApproved {...msg.props} /> };
    case "transient-request-denied":
      return { subject: transientDeniedSubject, element: <TransientRequestDenied {...msg.props} /> };
    case "transient-request-needs-info":
      return { subject: transientNeedsInfoSubject, element: <TransientRequestNeedsInfo {...msg.props} /> };
    case "transient-upload-reminder":
      return { subject: transientUploadReminderSubject, element: <TransientUploadReminder {...msg.props} /> };
    case "fee-schedule-submitted":
      return { subject: feeSubmittedSubject(msg.props), element: <FeeScheduleSubmitted {...msg.props} /> };
    case "fee-schedule-approved":
      return { subject: feeApprovedSubject(msg.props), element: <FeeScheduleApproved {...msg.props} /> };
    case "fee-schedule-activated":
      return { subject: feeActivatedSubject(msg.props), element: <FeeScheduleActivated {...msg.props} /> };
    case "assignment-confirmed":
      return { subject: assignmentConfirmedSubject(msg.props), element: <AssignmentConfirmed {...msg.props} /> };
    case "assignment-cancelled":
      return { subject: assignmentCancelledSubject(msg.props), element: <AssignmentCancelled {...msg.props} /> };
    case "season-charge-issued":
      return { subject: seasonChargeIssuedSubject(msg.props), element: <SeasonChargeIssued {...msg.props} /> };
  }
}

/* ============================================================
 * Singleton Resend client
 * ============================================================ */

let _client: Resend | null = null;
function client(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY not set");
    _client = new Resend(key);
  }
  return _client;
}

/* ============================================================
 * Public API
 * ============================================================ */

export async function sendEmail(
  input: SendEmailInput,
): Promise<{ id: string }> {
  const { subject, element } = renderEmail(input);
  const html = await render(element, { pretty: false });
  const text = await render(element, { plainText: true });

  const { data, error } = await client().emails.send(
    {
      from: FROM,
      to: input.to,
      replyTo: input.replyTo ?? REPLY_TO_DEFAULT,
      subject,
      html,
      text,
      tags: [
        { name: "template", value: input.template },
        ...(input.tags ?? []),
      ],
      headers: input.idempotencyKey
        ? { "Idempotency-Key": input.idempotencyKey }
        : undefined,
    },
  );

  if (error) {
    throw new Error(`Resend error: ${error.name} — ${error.message}`);
  }
  if (!data) {
    throw new Error("Resend returned no data");
  }
  return { id: data.id };
}
