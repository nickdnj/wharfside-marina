export function QuickInfo() {
  return (
    <section
      aria-labelledby="quick-info"
      className="mt-12 rounded-xl border border-slate-100 bg-white p-6 sm:p-8"
    >
      <h2 id="quick-info" className="text-2xl font-semibold">
        Quick info
      </h2>
      <dl className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div>
          <dt className="text-sm font-medium text-slate-500">VHF hailing</dt>
          <dd className="mt-1 font-serif text-xl font-semibold text-navy">
            Channel 9
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">
            Office &middot; ECI
          </dt>
          <dd className="mt-1 font-serif text-xl font-semibold text-navy">
            <a className="hover:text-gold" href="tel:+17327511991">
              732-751-1991
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">
            After-hours emergency
          </dt>
          <dd className="mt-1 font-serif text-xl font-semibold text-navy">
            <a className="hover:text-gold" href="tel:+17329706886">
              732-970-6886
            </a>
          </dd>
        </div>
      </dl>
    </section>
  );
}
