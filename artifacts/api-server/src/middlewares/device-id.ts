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

export function deviceId(req: Request, res: Response, next: NextFunction) {
  let id = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!id) {
    id = randomUUID();
    res.cookie(COOKIE_NAME, id, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: ONE_YEAR_SECONDS * 1000,
      path: "/",
    });
  }
  req.deviceId = id;
  next();
}
