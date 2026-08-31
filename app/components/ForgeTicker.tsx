"use client";

import { useEffect, useState } from "react";

export function ForgeTicker() {
  const [time, setTime] = useState("");
  useEffect(() => { const update = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })); update(); const id = setInterval(update, 1000); return () => clearInterval(id); }, []);
  return <div className="border-y border-white/10 bg-white/[0.02] px-5 py-2 text-center text-[11px] text-white/40">FORGE X LIVE · SOLANA · <span className="text-[#f5c542]">● ONLINE</span> · {time || "--:--:--"}</div>;
}
