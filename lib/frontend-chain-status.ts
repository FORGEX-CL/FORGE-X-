export type ChainStatus = "idle" | "preparing" | "awaiting_signature" | "submitted" | "confirmed" | "failed";

export type FrontendChainState = {
  status: ChainStatus;
  signature?: string;
  error?: string;
};

export function chainState(status: ChainStatus, details: Omit<FrontendChainState, "status"> = {}): FrontendChainState {
  if (status === "confirmed" && !details.signature) throw new Error("A confirmed transaction requires a signature");
  if (status === "failed" && !details.error) throw new Error("A failed transaction requires an error");
  return { status, ...details };
}

export function canShowSuccess(state: FrontendChainState): boolean {
  return state.status === "confirmed" && Boolean(state.signature);
}
