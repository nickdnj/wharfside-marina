"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Resend } from "resend";

import { db } from "@/db";
import { transientRequest } from "@/db/schema";
import { sendEmail } from "@/lib/emails/send";
import { transientFormLimiter } from "@/lib/ratelimit";

const ECI_NOTIFICATION_EMAIL =
  process.env.ECI_NOTIFICATION_EMAIL ?? "kathy.vanecek@idealmgt.com";
const NO_REPLY_FROM = "Wharfside Marina <no-reply@wharfsidemb.com>";

/* Lightweight numeric coercion for FormData strings. Empty → null. */
const numOrNull = z
  .preprocess((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : null;
  }, z.number().positive().max(99.99).nullable());

const createTransientRequestSchema = z
  .object({
    requesterName: z.string().min(1, "Name is required").max(200),
    requesterEmail: z.string().email("Enter a valid email").max(254),
    requesterPhone: z
      .string()
      .max(40)
      .transform((v) => (v.trim().length ? v.trim() : null))
      .nullable(),
    vesselName: z
      .string()
      .max(120)
      .transform((v) => (v.trim().length ? v.trim() : null))
      .nullable(),
    vesselLoaFt: numOrNull,
    vesselBeamFt: numOrNull,
    vesselDraftFt: numOrNull,
    requestedStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an arrival date"),
    requestedEnd: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a departure date"),
    purpose: z
      .string()
      .max(2000)
      .transform((v) => (v.trim().length ? v.trim() : null))
      .nullable(),
    rulesAcknowledged: z.literal("on", {
      errorMap: () => ({ message: "Please acknowledge the marina rules" }),
    }),
  })
  .refine((d) => d.requestedEnd >= d.requestedStart, {
    path: ["requestedEnd"],
    message: "Departure must be on or after arrival",
  });

export type TransientFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "ok" };

function clientIp(): string {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

async function notifyEci(args: {
  requesterName: string;
  requesterEmail: string;
  vesselName: string | null;
  requestedStart: string;
  requestedEnd: string;
  purpose: string | null;
  requestId: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; /* dev / sandbox: skip */
  const resend = new Resend(key);
  const html = `
    <p><strong>New transient slip request</strong></p>
    <ul>
      <li>Requester: ${args.requesterName} &lt;${args.requesterEmail}&gt;</li>
      <li>Vessel: ${args.vesselName ?? "—"}</li>
      <li>Dates: ${args.requestedStart} → ${args.requestedEnd}</li>
      <li>Purpose: ${args.purpose ?? "—"}</li>
      <li>Request id: ${args.requestId}</li>
    </ul>
    <p>Review in the admin queue.</p>
  `.trim();
  await resend.emails.send({
    from: NO_REPLY_FROM,
    to: ECI_NOTIFICATION_EMAIL,
    subject: `New transient request — ${args.requesterName}`,
    html,
    tags: [{ name: "kind", value: "transient-eci-notification" }],
  });
}

export async function submitTransientRequest(
  _prev: TransientFormState,
  formData: FormData,
): Promise<TransientFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createTransientRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors,
    };
  }
  const data = parsed.data;

  /* Rate limit by IP — 5 / hour. No-ops in dev without Upstash creds. */
  const ip = clientIp();
  const gate = await transientFormLimiter().check(`ip:${ip}`);
  if (!gate.success) {
    return {
      status: "error",
      message: `You've submitted too many requests recently. Try again in about ${Math.ceil(
        gate.retryAfterSeconds / 60,
      )} minute(s), or call ECI at 732-751-1991.`,
    };
  }

  /* Persist. */
  let requestId: string;
  try {
    const [row] = await db
      .insert(transientRequest)
      .values({
        requesterName: data.requesterName,
        requesterEmail: data.requesterEmail.toLowerCase(),
        requesterPhone: data.requesterPhone,
        vesselName: data.vesselName,
        vesselLoaFt: data.vesselLoaFt?.toString() ?? null,
        vesselBeamFt: data.vesselBeamFt?.toString() ?? null,
        vesselDraftFt: data.vesselDraftFt?.toString() ?? null,
        requestedStart: data.requestedStart,
        requestedEnd: data.requestedEnd,
        purpose: data.purpose,
        status: "pending",
      })
      .returning({ id: transientRequest.id });
    requestId = String(row.id);
  } catch (err) {
    console.error("transient_request insert failed", err);
    return {
      status: "error",
      message:
        "We couldn't save your request. Please try again, or call ECI at 732-751-1991.",
    };
  }

  /* Confirmation email to requester. Failures here are non-fatal — the
     row is already saved, and Kathy can reach out manually. */
  try {
    await sendEmail({
      to: data.requesterEmail,
      template: "transient-request-received",
      props: {
        requesterName: data.requesterName,
        vesselName: data.vesselName ?? "your vessel",
        requestedStart: data.requestedStart,
        requestedEnd: data.requestedEnd,
      },
      tags: [{ name: "transient_request_id", value: requestId }],
      idempotencyKey: `transient:${requestId}:requester`,
    });
  } catch (err) {
    console.error("transient confirmation email failed", err);
  }

  try {
    await notifyEci({
      requesterName: data.requesterName,
      requesterEmail: data.requesterEmail,
      vesselName: data.vesselName,
      requestedStart: data.requestedStart,
      requestedEnd: data.requestedEnd,
      purpose: data.purpose,
      requestId,
    });
  } catch (err) {
    console.error("ECI notification email failed", err);
  }

  redirect("/transient/thanks");
}
