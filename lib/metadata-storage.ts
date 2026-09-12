import { PinataSDK } from "pinata";

export type TokenMetadataInput = {
  name: string;
  symbol: string;
  description: string;
  image?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
};

function getPinata() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT is not configured; production launches require real metadata storage");

  const gateway = process.env.PINATA_GATEWAY?.trim();
  return new PinataSDK({
    pinataJwt: jwt,
    ...(gateway ? { pinataGateway: gateway } : {}),
  });
}

export async function uploadTokenMetadata(input: TokenMetadataInput): Promise<string> {
  const pinata = getPinata();
  const content: Record<string, unknown> = {
    name: input.name.trim(),
    symbol: input.symbol.trim().toUpperCase(),
    description: input.description.trim(),
  };
  if (input.image?.trim()) content.image = input.image.trim();
  if (input.website?.trim()) content.external_url = input.website.trim();

  const properties: Record<string, unknown> = {};
  if (input.twitter?.trim()) properties.twitter = input.twitter.trim();
  if (input.telegram?.trim()) properties.telegram = input.telegram.trim();
  if (Object.keys(properties).length) content.properties = properties;

  const upload = await pinata.upload.public.json({ content }).name(`${input.symbol.trim().toUpperCase()}-metadata.json`);
  if (!upload.cid) throw new Error("Pinata returned no metadata CID");

  const gatewayBase = (gatewayUrl(process.env.PINATA_GATEWAY) ?? "https://gateway.pinata.cloud").replace(/\/$/, "");
  return `${gatewayBase}/ipfs/${upload.cid}`;
}

function gatewayUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().replace(/\/$/, "");
  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
}
