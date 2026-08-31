"use client";

export function TransactionStatus({ status, signature }: { status: "idle" | "signing" | "confirmed" | "failed"; signature?: string }) {
  if (status === "idle") return null;
  const labels = { signing: "Waiting for wallet signature…", confirmed: "Transaction confirmed", failed: "Transaction failed" };
  return <div className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm"><div className="font-semibold">{labels[status]}</div>{signature && <div className="mt-2 break-all text-xs text-white/35">Signature: {signature}</div>}</div>;
}
