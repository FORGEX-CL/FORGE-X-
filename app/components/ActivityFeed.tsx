const activity = [
  ["Pool created", "SOL / FORGE", "2m ago"],
  ["Large swap", "18.4 SOL → NOVA", "5m ago"],
  ["Token launched", "$FLUX", "8m ago"],
  ["Liquidity added", "SOL / USDC", "12m ago"],
];

export function ActivityFeed() {
  return <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><div className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Network pulse</p><h3 className="mt-2 text-2xl font-black">Recent activity</h3></div><span className="flex items-center gap-2 text-xs text-emerald-400"><i className="h-2 w-2 rounded-full bg-current" />Live</span></div><div className="divide-y divide-white/10">{activity.map(([type, detail, time]) => <div key={time} className="flex items-center justify-between gap-4 py-4"><div><div className="font-medium">{type}</div><div className="text-xs text-white/35">{detail}</div></div><span className="text-xs text-white/30">{time}</span></div>)}</div></div></section>;
}
