/**
 * The portal session: a random id in an httpOnly cookie, and a map from it to a user.
 *
 * In memory, so every session ends when this process restarts. That is the right trade for a demo
 * backend, and it keeps the thing this service exists for — holding the OMS API key — the only
 * state worth taking seriously.
 *
 * The cookie is httpOnly because the portal frontend has no reason to read it: it proves who is
 * asking when the frontend requests an OMS token, and nothing else.
 */

import { randomBytes } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { SESSION_SAMESITE, SESSION_SECURE } from "./config.ts";
import type { PortalUser } from "./users.ts";

export const SESSION_COOKIE = "fp_session";

const sessions = new Map<string, PortalUser>();

function cookieOptions(): CookieOptions {
	return {
		httpOnly: true,
		sameSite: SESSION_SAMESITE,
		secure: SESSION_SECURE,
		// When the portal and this API are on different sites the cookie is third-party, and
		// browsers that block those (incognito, Safari-style defaults) drop it. `Partitioned`
		// (CHIPS) opts into a jar keyed to the portal's site instead, which is the right semantics:
		// the session belongs to the portal, not to anything else that calls this API.
		partitioned: SESSION_SAMESITE === "none",
		path: "/",
		maxAge: 12 * 60 * 60 * 1000,
	};
}

export function startSession(res: Response, user: PortalUser): void {
	const id = randomBytes(24).toString("base64url");
	sessions.set(id, user);
	res.cookie(SESSION_COOKIE, id, cookieOptions());
}

export function readSession(req: Request): PortalUser | null {
	const id = req.cookies?.[SESSION_COOKIE];
	if (typeof id !== "string" || !id) return null;
	return sessions.get(id) ?? null;
}

export function endSession(req: Request, res: Response): void {
	const id = req.cookies?.[SESSION_COOKIE];
	if (typeof id === "string") sessions.delete(id);
	res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
}
