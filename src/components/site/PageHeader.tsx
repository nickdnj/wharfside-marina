type Props = {
  eyebrow?: string;
  title: string;
  lede?: string;
};

export function PageHeader({ eyebrow, title, lede }: Props) {
  return (
    <header className="border-b border-slate-100 pb-6">
      {eyebrow && (
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-2 text-4xl font-bold">{title}</h1>
      {lede && <p className="mt-3 max-w-2xl text-base text-slate-500">{lede}</p>}
    </header>
  );
}
