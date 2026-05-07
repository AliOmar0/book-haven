import { Router, type IRouter } from "express";

const router: IRouter = Router();

const ALLOWED_HOSTS = new Set([
  "www.gutenberg.org",
  "gutenberg.org",
  "archive.org",
  "www.archive.org",
  "standardebooks.org",
]);

// Internet Archive download URLs redirect to dynamically-named storage
// servers (e.g. ia801505.us.archive.org). Allow any *.archive.org subdomain.
function hostAllowed(hostname: string): boolean {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  if (hostname.endsWith(".archive.org")) return true;
  return false;
}

// Allow callers to request a specific Accept header upstream (e.g. Standard
// Ebooks' /feeds/atom/all returns HTML when no Accept is sent, but proper
// Atom XML when Accept: application/atom+xml is sent). Restricted to a small
// set of safe values so this can't be abused for header smuggling.
const ALLOWED_ACCEPT_HEADERS = new Set([
  "application/atom+xml",
  "application/xml",
  "application/json",
  "text/xml",
]);

router.get("/proxy/epub", async (req, res) => {
  const url = typeof req.query["url"] === "string" ? req.query["url"] : "";
  const acceptParam = typeof req.query["accept"] === "string" ? req.query["accept"] : "";
  const accept = ALLOWED_ACCEPT_HEADERS.has(acceptParam) ? acceptParam : "";
  if (!url) {
    res.status(400).json({ error: "Missing url" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid url" });
    return;
  }

  if (parsed.protocol !== "https:" || !hostAllowed(parsed.hostname)) {
    res.status(403).json({ error: "Host not allowed" });
    return;
  }

  try {
    // Manually follow redirects so each hop is validated against the
    // allowlist — `redirect: "follow"` would let a Gutenberg URL bounce
    // us to an arbitrary external/internal host (SSRF).
    let current: URL = parsed;
    let upstream: Response | null = null;
    for (let hop = 0; hop < 5; hop++) {
      const headers: Record<string, string> = { "User-Agent": "BookHaven/1.0" };
      if (accept) headers["Accept"] = accept;
      const resp: Response = await fetch(current.toString(), {
        redirect: "manual",
        headers,
      });
      if (resp.status >= 300 && resp.status < 400) {
        const loc = resp.headers.get("location");
        if (!loc) {
          res.status(502).end();
          return;
        }
        let next: URL;
        try {
          next = new URL(loc, current);
        } catch {
          res.status(502).end();
          return;
        }
        if (next.protocol !== "https:" || !hostAllowed(next.hostname)) {
          req.log.warn({ from: current.toString(), to: next.toString() }, "epub proxy redirect blocked");
          res.status(403).json({ error: "Redirect target not allowed" });
          return;
        }
        current = next;
        continue;
      }
      upstream = resp;
      break;
    }
    if (!upstream) {
      res.status(508).end();
      return;
    }
    if (!upstream.ok || !upstream.body) {
      res.status(upstream.status || 502).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/epub+zip",
    );
    // Only forward Content-Length when upstream wasn't compressed. Node's
    // fetch transparently decodes gzip/br responses, so the upstream
    // Content-Length (which describes the compressed payload) would no
    // longer match what we actually write. If we forwarded it the browser
    // would stop reading after the compressed-byte count and truncate the
    // response (this manifested as Standard Ebooks' /feeds/atom/all coming
    // back with only 2-3 entries instead of the full result set).
    const upstreamEncoding = upstream.headers.get("content-encoding");
    const len = upstream.headers.get("content-length");
    if (len && !upstreamEncoding) res.setHeader("Content-Length", len);
    res.setHeader("Cache-Control", "public, max-age=86400");

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    req.log.error({ err }, "epub proxy failed");
    if (!res.headersSent) res.status(502).end();
  }
});

export default router;
