export function Hero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-100 bg-navy text-paper">
      <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy to-navy/80" />
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_30%_20%,#c9a227_0,transparent_55%)]" />
      <div className="relative px-6 py-14 sm:px-10 sm:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">
          Monmouth Beach, NJ · Shrewsbury River
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold sm:text-5xl">
          Wharfside Marina
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-paper/90 sm:text-xl">
          A private slip community on the Shrewsbury River — run by Wharfside Manor
          Condominium Association.
        </p>
      </div>
    </section>
  );
}
