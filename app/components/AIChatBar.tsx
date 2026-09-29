"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const agents = [
  { id: "forge", name: "FORGE AI", hint: "General" },
  { id: "market", name: "Market Agent", hint: "Markets" },
  { id: "risk", name: "Risk Agent", hint: "Safety" },
  { id: "launch", name: "Launch Agent", hint: "Tokens" },
];

export function AIChatBar() {
  const [open, setOpen] = useState(false);
  const [agent, setAgent] = useState("forge");
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    window.location.href = `/ai?agent=${encodeURIComponent(agent)}&prompt=${encodeURIComponent(text)}`;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-2 pb-2 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-3xl">
        {open && (
          <div className="mb-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/98 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {agents.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAgent(item.id)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left transition ${agent === item.id
                    ? "border-[var(--brand-yellow)]/50 bg-[var(--brand-green)]/25"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
                >
                  <span className="block text-xs font-bold text-white">{item.name}</span>
                  <span className="mt-0.5 block text-[10px] text-white/40">{item.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={submit}
          className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--header)]/98 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <button
            type="button"
            aria-label="Choose AI agent"
            onClick={() => setOpen((value) => !value)}
            className="hidden shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 sm:flex"
          >
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--brand-green)] text-xs font-black text-white">AI</span>
            <span className="max-w-28 truncate text-xs font-bold text-white/80">
              {agents.find((item) => item.id === agent)?.name}
            </span>
            <span className="text-[10px] text-white/35">▾</span>
          </button>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-green)] text-xs font-black text-white sm:hidden"
            aria-label="Choose AI agent"
          >
            AI
          </button>

          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Chat with FORGE AI agents..."
            className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/30"
            aria-label="Message FORGE AI"
          />

          <Link
            href="/ai"
            className="hidden shrink-0 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold text-white/55 transition hover:border-white/20 hover:text-white md:inline-flex"
          >
            Full AI
          </Link>

          <button
            type="submit"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-yellow)] text-sm font-black text-black transition hover:bg-[#ffd15c] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!message.trim()}
            aria-label="Send message"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
