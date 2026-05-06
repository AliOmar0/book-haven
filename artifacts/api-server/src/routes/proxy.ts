import { Router, type IRouter } from "express";

const router: IRouter = Router();

const ALLOWED_HOSTS = new Set([
  "www.gutenberg.org",
  "gutenberg.org",
]);

router.get("/proxy/epub", async (req, res) => {
  const url = typeof req.query["url"] === "string" ? req.query["url"] : "";
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

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
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
      const resp: Response = await fetch(current.toString(), {
        redirect: "manual",
        headers: { "User-Agent": "BookHaven/1.0" },
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
        if (next.protocol !== "https:" || !ALLOWED_HOSTS.has(next.hostname)) {
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
    const len = upstream.headers.get("content-length");
    if (len) res.setHeader("Content-Length", len);
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
