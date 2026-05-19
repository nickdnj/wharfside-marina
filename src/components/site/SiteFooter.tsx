import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/rules", label: "Rules" },
  { href: "/forms", label: "Forms" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-slate-100 bg-navy text-paper">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-serif text-lg font-semibold">Wharfside Marina</p>
            <p className="mt-1 text-sm text-paper/80">
              Wharfside Manor Condominium Association · Highlands, NJ
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-paper hover:text-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-8 text-xs text-paper/70">
          © {year} Wharfside Manor Condominium Association. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
