"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  submitTransientRequest,
  type TransientFormState,
} from "./actions";

const INITIAL: TransientFormState = { status: "idle" };

export function TransientForm() {
  const [state, action] = useFormState(submitTransientRequest, INITIAL);
  const errs = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} noValidate className="mt-8 space-y-8" aria-describedby="form-summary">
      {state.status === "error" && (
        <div
          id="form-summary"
          role="alert"
          className="rounded-lg border border-danger bg-white p-4 text-sm text-danger"
        >
          {state.message}
        </div>
      )}

      <Fieldset legend="About you">
        <Field
          name="requesterName"
          label="Your name"
          required
          autoComplete="name"
          error={errs.requesterName}
        />
        <Field
          name="requesterEmail"
          type="email"
          label="Email"
          required
          autoComplete="email"
          inputMode="email"
          error={errs.requesterEmail}
        />
        <Field
          name="requesterPhone"
          type="tel"
          label="Phone"
          autoComplete="tel"
          inputMode="tel"
          error={errs.requesterPhone}
        />
      </Fieldset>

      <Fieldset legend="Your vessel">
        <Field name="vesselName" label="Vessel name" error={errs.vesselName} />
        <Field
          name="vesselLoaFt"
          type="number"
          step="0.1"
          min="0"
          label="LOA (ft)"
          error={errs.vesselLoaFt}
        />
        <Field
          name="vesselBeamFt"
          type="number"
          step="0.1"
          min="0"
          label="Beam (ft)"
          error={errs.vesselBeamFt}
        />
        <Field
          name="vesselDraftFt"
          type="number"
          step="0.1"
          min="0"
          label="Draft (ft)"
          error={errs.vesselDraftFt}
        />
      </Fieldset>

      <Fieldset legend="Your stay">
        <Field
          name="requestedStart"
          type="date"
          label="Arrival"
          required
          error={errs.requestedStart}
        />
        <Field
          name="requestedEnd"
          type="date"
          label="Departure"
          required
          error={errs.requestedEnd}
        />
        <TextArea
          name="purpose"
          label="Purpose of visit (optional)"
          rows={3}
          placeholder="Stopping for dinner, weekend cruise, weather hold, etc."
          error={errs.purpose}
        />
      </Fieldset>

      <div className="rounded-lg border border-slate-100 bg-white p-5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="rulesAcknowledged"
            required
            className="mt-1 h-5 w-5 rounded border-slate-500 text-navy focus:ring-navy"
          />
          <span>
            I have read and agree to follow the{" "}
            <a
              href="/rules"
              className="font-semibold text-navy underline hover:text-gold"
            >
              Wharfside Marina rules
            </a>
            , including no-wake speed, VHF channel 9 hailing, and required
            insurance coverage.
          </span>
        </label>
        {errs.rulesAcknowledged && (
          <p className="mt-2 text-sm text-danger">{errs.rulesAcknowledged}</p>
        )}
      </div>

      <SubmitButton />

      <p className="text-xs text-slate-500">
        We&apos;ll respond within 24 hours. Approved requests get an email
        with a secure link to upload your COI and registration (48-hour
        window).
      </p>
    </form>
  );
}

function Fieldset({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border border-slate-100 bg-white p-6">
      <legend className="px-2 font-serif text-base font-semibold text-navy">
        {legend}
      </legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  step?: string;
  min?: string;
  error?: string;
};

function Field({
  name,
  label,
  type = "text",
  required,
  autoComplete,
  inputMode,
  step,
  min,
  error,
}: FieldProps) {
  const id = `f-${name}`;
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-900">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        step={step}
        min={min}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className="mt-1 h-10 w-full rounded-md border border-slate-500/40 bg-paper px-3 text-base text-slate-900 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy"
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function TextArea({
  name,
  label,
  rows = 3,
  placeholder,
  error,
}: {
  name: string;
  label: string;
  rows?: number;
  placeholder?: string;
  error?: string;
}) {
  const id = `f-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className="sm:col-span-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-900">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className="mt-1 w-full rounded-md border border-slate-500/40 bg-paper px-3 py-2 text-base text-slate-900 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy"
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center rounded-md bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Submitting…" : "Submit request"}
    </button>
  );
}
