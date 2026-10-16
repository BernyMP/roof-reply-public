export async function matchesSecret(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const encode = (s: string) => new TextEncoder().encode(s);
  const [a,b] = await Promise.all([crypto.subtle.digest("SHA-256", encode(header.slice(7))), crypto.subtle.digest("SHA-256", encode(secret))]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}
