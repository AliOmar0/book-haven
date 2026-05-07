import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      deviceId: string;
    }
  }
}

const COOKIE_NAME = "bh_device";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// When the API is on a different origin than the frontend (e.g. API on
// Railway, frontend on GitHub Pages), the device cookie must be set with
// `SameSite=None; Secure` or the browser silently drops it on every cross-
// origin request — breaking favorites and reviews. Set CROSS_SITE_COOKIES=1
// (or NODE_ENV=production with a public hosting URL) to opt in.
const CROSS_SITE = process.env.CROSS_SITE_COOKIES === "1";

export function deviceId(req: Request, res: Response, next: NextFunction) {
  let id = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!id) {
    id = randomUUID();
    res.cookie(COOKIE_NAME, id, {
      httpOnly: true,
      sameSite: CROSS_SITE ? "none" : "lax",
      secure: CROSS_SITE,
      maxAge: ONE_YEAR_SECONDS * 1000,
      path: "/",
    });
  }
  req.deviceId = id;
  next();
}
