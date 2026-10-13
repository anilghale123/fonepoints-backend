/**
 * The portal's own sign-in. Dummy by design — there is no password, and any email signs in.
 *
 * It is here because the OMS handoff needs something to answer "who is asking": the token route
 * refuses without a session, so the API key cannot be spent by anyone who merely knows the
 * portal's URL. Replacing this with the real Fonepoints identity provider is a change to this file
 * and `../users.ts`, and to nothing downstream.
 */

import { Router } from "express";
import { log } from "../log.ts";
import { endSession, readSession, startSession } from "../session.ts";
import { PORTAL_USERS, findUser } from "../users.ts";

export const authRouter = Router();

/** The accounts a demo can sign in as, so the portal can offer them rather than guess. */
authRouter.get("/users", (_req, res) => {
	res.json({
		users: PORTAL_USERS.map(({ email, name, role }) => ({ email, name, role })),
	});
});

authRouter.post("/login", (req, res) => {
	const email = typeof req.body?.email === "string" ? req.body.email : "";
	if (!email.trim()) {
		res.status(400).json({ error: { code: "invalid_body", message: "An email is required" } });
		return;
	}

	const user = findUser(email);
	startSession(res, user);
	// The email is a person's address, so the log names the merchant it mapped to instead.
	log("auth", `demo sign-in: portal session started for merchant ${user.merchantId}`);
	res.json({ user: publicUser(user) });
});

authRouter.get("/session", (req, res) => {
	const user = readSession(req);
	if (!user) {
		log("auth", "session check: not signed in");
		res.status(401).json({ error: { code: "unauthorized", message: "Not signed in" } });
		return;
	}
	log("auth", `session check: signed in as merchant ${user.merchantId}`);
	res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (req, res) => {
	endSession(req, res);
	log("auth", "portal session ended");
	res.json({ ok: true });
});

/**
 * What the portal frontend is told about its own user.
 *
 * `merchantId` is included: the portal shows which merchant it is about to open OMS as, and it
 * is not a secret — it names a merchant, and holding it authorises nothing without the API key.
 */
function publicUser(user: {
	email: string;
	name: string;
	role: string;
	merchantId: string;
}) {
	return {
		email: user.email,
		name: user.name,
		role: user.role,
		merchantId: user.merchantId,
	};
}
