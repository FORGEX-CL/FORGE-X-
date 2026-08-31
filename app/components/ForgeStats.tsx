export function ForgeStats() {
  const stats = [
    ["TVL", "$18.4M", "+6.2%"],
    ["24h Volume", "$7.9M", "+14.8%"],
    ["Traders", "12.8K", "+9.1%"],
    ["Pools", "1,284", "+4.7%"],
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[.025] md:grid-cols-4">
        {stats.map(([label, value, change]) => (
          <div key={label} className="border-white/10 p-5 md:border-r last:border-r-0">
            <p className="text-xs text-white/35">{label}</p>
            <div className="mt-2 flex items-end gap-2"><span className="text-xl font-black">{value}</span><span className="text-xs text-emerald-400">{change}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}
