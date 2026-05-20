// Minimal local UI primitives. The spec says "assume shadcn/ui is installed"
// — these match shadcn's API surface (Button, Card, Input, etc.) so they're
// drop-in replaceable once shadcn is wired up, but they compile standalone.
//
// All components are intentionally thin Tailwind wrappers. No icons, no
// animations. The point of this file is to give the Modeler something to
// render before shadcn is plumbed.

"use client";

import * as React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

/* ===== Button ===== */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", ...rest }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
    const sizes: Record<ButtonSize, string> = {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-11 px-6 text-base",
    };
    const variants: Record<ButtonVariant, string> = {
      primary: "bg-navy-500 text-white hover:bg-navy-700",
      secondary:
        "bg-white text-navy-900 border border-navy-100 hover:bg-navy-50",
      ghost: "text-navy-900 hover:bg-navy-50",
      danger: "bg-red-600 text-white hover:bg-red-700",
    };
    return (
      <button
        ref={ref}
        className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
        {...rest}
      />
    );
  },
);
Button.displayName = "Button";

/* ===== Card ===== */

export function Card({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`rounded-lg border border-navy-100 bg-white shadow-sm ${className}`}
      {...rest}
    />
  );
}

export function CardHeader({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`flex flex-col gap-1 p-4 border-b border-navy-100 ${className}`}
      {...rest}
    />
  );
}

export function CardTitle({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-lg font-semibold text-navy-900 ${className}`}
      {...rest}
    />
  );
}

export function CardContent({ className = "", ...rest }: DivProps) {
  return <div className={`p-4 ${className}`} {...rest} />;
}

/* ===== Input / Label ===== */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...rest }, ref) => (
  <input
    ref={ref}
    className={`h-9 w-full rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${className}`}
    {...rest}
  />
));
Input.displayName = "Input";

export function Label({
  className = "",
  ...rest
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`text-sm font-medium text-navy-900 ${className}`}
      {...rest}
    />
  );
}

/* ===== Badge ===== */

type BadgeVariant = "gray" | "blue" | "green" | "gold" | "slate" | "red";

export function Badge({
  variant = "gray",
  className = "",
  ...rest
}: { variant?: BadgeVariant } & React.HTMLAttributes<HTMLSpanElement>) {
  const variants: Record<BadgeVariant, string> = {
    gray: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    gold: "bg-gold-100 text-gold-700",
    slate: "bg-slate-200 text-slate-800",
    red: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
