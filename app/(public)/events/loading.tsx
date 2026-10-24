export default function EventsLoading() {
  return (
    <main aria-label="Loading events" className="mx-auto max-w-7xl space-y-8 px-4 pb-14 pt-5 sm:px-6 lg:pt-7">
      <div className="motion-safe:animate-pulse overflow-hidden rounded-2xl bg-[#0a2957] px-6 py-8 sm:px-9 sm:py-10">
        <div className="h-3 w-24 rounded bg-white/30" />
        <div className="mt-4 h-9 max-w-sm rounded bg-white/30" />
        <div className="mt-3 h-4 max-w-xl rounded bg-white/20" />
      </div>
      <div className="motion-safe:animate-pulse h-16 rounded-2xl border border-slate-200 bg-white" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="motion-safe:animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="aspect-[16/9] bg-slate-200" /><div className="space-y-3 p-5"><div className="h-5 w-2/3 rounded bg-slate-200" /><div className="h-4 w-1/2 rounded bg-slate-100" /><div className="h-10 rounded bg-slate-100" /></div></div>)}
      </div>
    </main>
  );
}
