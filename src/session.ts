/**
 * The portal session: a signed value in an httpOnly cookie that carries the user with it.
 *
 * Nothing is stored on the server. The cookie holds the user and an expiry, signed with an HMAC
 * so it cannot be edited — a merchant cannot change their own `merchantId` to ask for someone
 * else's token. Because no server-side table exists, **a restart no longer signs anyone out**
 * (the old in-memory map did, on every `npm run dev` file edit and every `pm2 restart`).
 *
 * The signing secret is derived from the Providhy API key, which this process already has and
 * which never leaves it, so there is nothing new to configure. Rotating the key signs everyone out.
 * The trade for being stateless: sign-out clears the cookie but cannot revoke a copy of it before
 * it expires (12 hours). Fine for this demo sign-in; the real portal identity replaces this file.
 *
 * The cookie is httpOnly because the portal frontend has no reason to read it: it proves who is
 * asking when the frontend requests an OMS token, and nothing else.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { IAM_API_KEY, SESSION_SAMESITE, SESSION_SECURE } from "./config.ts";
import type { PortalUser } from "./users.ts";

export const SESSION_COOKIE = "fp_session";

const MAX_AGE_MS = 12 * 60 * 60 * 1000;

const SECRET = createHmac("sha256", IAM_API_KEY || "fonepoints-dev")
	.update("fonepoints-portal-session-v1")
	.digest();

function sign(payload: string): string {
	return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

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
		maxAge: MAX_AGE_MS,
	};
}

export function startSession(res: Response, user: PortalUser): void {
	const payload = Buffer.from(JSON.stringify({ user, exp: Date.now() + MAX_AGE_MS })).toString(
		"base64url",
	);
	res.cookie(SESSION_COOKIE, `${payload}.${sign(payload)}`, cookieOptions());
}

export function readSession(req: Request): PortalUser | null {
	const value = req.cookies?.[SESSION_COOKIE];
	if (typeof value !== "string") return null;

	const [payload, signature] = value.split(".");
	if (!payload || !signature) return null;

	const expected = Buffer.from(sign(payload));
	const given = Buffer.from(signature);
	if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

	try {
		const { user, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
			user?: Partial<PortalUser>;
			exp?: number;
		};
		if (typeof exp !== "number" || exp < Date.now()) return null;
		if (typeof user?.merchantId !== "string" || !user.merchantId) return null;
		return {
			name: String(user.name ?? ""),
			email: String(user.email ?? ""),
			role: String(user.role ?? "Merchant"),
			merchantId: user.merchantId,
		};
	} catch {
		return null;
	}
}

export function endSession(_req: Request, res: Response): void {
	res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
}
