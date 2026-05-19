"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/rules", label: "Rules" },
  { href: "/map", label: "Map" },
  { href: "/forms", label: "Forms" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-[52px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-serif text-lg font-semibold text-navy"
          aria-label="Wharfside Marina home"
        >
          <span aria-hidden="true" className="inline-block h-6 w-6 rounded-sm bg-navy" />
          Wharfside Marina
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-900 hover:bg-sand-100 hover:text-navy"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden md:block">
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md border border-navy px-3 text-sm font-semibold text-navy hover:bg-navy hover:text-white"
          >
            Login
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-100 text-navy md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true" className="text-xl leading-none">
            {open ? "✕" : "☰"}
          </span>
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-slate-100 bg-paper md:hidden">
          <nav aria-label="Mobile" className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-3 text-base font-medium text-slate-900 hover:bg-sand-100 hover:text-navy"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="mt-1 block rounded-md border border-navy px-3 py-3 text-center text-base font-semibold text-navy hover:bg-navy hover:text-white"
                >
                  Login
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
