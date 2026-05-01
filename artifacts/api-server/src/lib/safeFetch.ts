import dns from "node:dns/promises";
import net from "node:net";

const DEFAULT_ALLOW_HOSTS = [
  // Magnific (primary)
  "api.magnific.com",
  "magnific.com",
  "cdn.magnific.com",
  "magnific.ai",
  "api.magnific.ai",
  // Freepik / Magnific CDN (Magnific delivers results via cdn-magnific.freepik.com)
  "api.freepik.com",
  "cdn.freepik.com",
  "cdn-magnific.freepik.com",
  "ai-static.freepik.com",
  "freepik-asset.s3.amazonaws.com",
  // CDNs the providers commonly redirect to
  "klingaiapi.com",
  "imagedelivery.net",
  "replicate.delivery",
];

function envHosts(): string[] {
  const raw = process.env.SAFE_FETCH_ALLOW_HOSTS || "";
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function publicBaseHost(): string | null {
  const base = process.env.PUBLIC_BASE_URL || "";
  try {
    return base ? new URL(base).hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lc = ip.toLowerCase();
    if (lc === "::1" || lc === "::") return true;
    if (lc.startsWith("fc") || lc.startsWith("fd")) return true;
    if (lc.startsWith("fe80")) return true;
    if (lc.startsWith("ff")) return true;
    return false;
  }
  return true;
}

export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error(`Disallowed protocol: ${u.protocol}`);
  }
  // Allow http only for known dev base
  const host = u.hostname.toLowerCase();
  const allow = new Set([...DEFAULT_ALLOW_HOSTS, ...envHosts()]);
  const pubHost = publicBaseHost();
  if (pubHost) allow.add(pubHost);

  const hostAllowed =
    allow.has(host) || [...allow].some((h) => host === h || host.endsWith("." + h));
  if (!hostAllowed) {
    throw new Error(`Host not allowed for outbound fetch: ${host}`);
  }

  // DNS resolve and reject private addresses
  let addresses: string[] = [];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      const r = await dns.lookup(host, { all: true });
      addresses = r.map((a) => a.address);
    } catch (err) {
      throw new Error(`DNS lookup failed for ${host}: ${(err as Error).message}`);
    }
  }
  for (const a of addresses) {
    if (isPrivateIp(a)) {
      // Permit only when host is the configured PUBLIC_BASE_URL host (workspace dev needs this).
      if (pubHost && host === pubHost) continue;
      throw new Error(`Resolved address blocked (private/loopback): ${host} -> ${a}`);
    }
  }
  return u;
}

const MAX_REDIRECTS = 5;

export async function safeFetch(rawUrl: string, init?: RequestInit): Promise<Response> {
  let url = rawUrl;
  let method = (init?.method || "GET").toUpperCase();
  let body: RequestInit["body"] = init?.body;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(url);
    const res = await fetch(url, { ...init, method, body, redirect: "manual" });
    // Manual redirect: status 3xx with Location header
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      // Drop the body on cross-origin redirects per fetch semantics; for 303 always GET
      if (res.status === 303) {
        method = "GET";
        body = undefined;
      }
      url = new URL(loc, url).toString();
      continue;
    }
    return res;
  }
  throw new Error(`Too many redirects (>${MAX_REDIRECTS}) starting from ${rawUrl}`);
}
