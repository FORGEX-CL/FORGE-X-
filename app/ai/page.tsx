"use client";

import { useState } from "react";
import { Shell, SectionTitle, Card } from "../components/Shell";

const prompts = [
  "Check this token for obvious risk signals",
  "Explain this market in simple terms",
  "What should I verify before launching?",
];

export default function ForgeAI() {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");

  function analyze() {
    if (!prompt.trim()) return;
    setAnswer("FORGE AI is ready for the analysis layer. Connect a supported AI provider and token-data sources to turn this workspace into live research, risk and market intelligence.");
  }

  return <Shell>
    <main className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
      <SectionTitle eyebrow="FORGE AI" title="Your on-chain copilot." text="A focused intelligence workspace for market research, token checks and launch decisions. It is deliberately separated from execution so analysis never pretends to be a transaction." />
      <Card>
        <div className="rounded-xl border border-[#f5c542]/15 bg-[#f5c542]/5 p-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#f5c542]">Ask FORGE</div>
          <p className="mt-2 text-sm text-white/45">Choose a starting question or write your own.</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">{prompts.map((item) => <button key={item} onClick={() => setPrompt(item)} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/55 hover:border-white/20 hover:text-white">{item}</button>)}</div>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask about a token, market, launch setup or risk..." className="mt-5 min-h-32 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-4 text-sm outline-none placeholder:text-white/25 focus:border-[#f5c542]/40" />
        <button onClick={analyze} className="mt-4 rounded-xl bg-[#f5c542] px-6 py-3 text-sm font-bold text-black hover:bg-[#ffd75e]">Analyze</button>
        {answer && <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-white/65">{answer}</div>}
      </Card>
    </main>
  </Shell>;
}
