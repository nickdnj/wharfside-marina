/**
 * NOAA tide info card for the nearest standard station to the
 * Shrewsbury River entrance — Sandy Hook (station 8531680).
 *
 * NOAA does not publish an X-Frame-friendly iframe widget. We render
 * a server-rendered card with a deep link to the live NOAA tide
 * predictions page; an `<img>` falls back gracefully if NOAA changes
 * the plot URL. This satisfies STORY-11's "loads async, doesn't block
 * page" since `<img>` is non-blocking and the card itself is SSG.
 */
export function TideEmbed() {
  const station = "8531680";
  const stationName = "Sandy Hook, NJ";
  const liveUrl = `https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=${station}`;
  const plotUrl = `https://tidesandcurrents.noaa.gov/images/plots/${station}.gif`;

  return (
    <section
      aria-labelledby="tides"
      className="mt-12 rounded-xl border border-slate-100 bg-white p-6 sm:p-8"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="tides" className="text-2xl font-semibold">
            Tides &amp; weather
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            NOAA station <span className="font-mono">{station}</span> &mdash;{" "}
            {stationName} (nearest standard station to the Shrewsbury River
            entrance).
          </p>
        </div>
        <a
          href={liveUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-9 items-center self-start rounded-md border border-navy px-3 text-sm font-semibold text-navy hover:bg-navy hover:text-white sm:self-auto"
        >
          Open on NOAA &rarr;
        </a>
      </div>
      <div className="mt-6 overflow-hidden rounded-lg border border-slate-100 bg-paper">
        <img
          src={plotUrl}
          alt={`Today's tide prediction chart for Sandy Hook, NJ (NOAA station ${station}).`}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </div>
    </section>
  );
}
