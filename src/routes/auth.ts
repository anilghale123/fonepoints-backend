/**
 * The portal's own sign-in. Free by design — no password, nothing is validated, any name and
 * email signs in.
 *
 * It is here because the OMS handoff needs something to answer "who is asking": the token route
 * refuses without a session, so the API key cannot be spent by anyone who merely knows the
 * portal's URL. Replacing this with the real Fonepoints identity provider is a change to this file
 * and `../users.ts`, and to nothing downstream.
 */

import { Router } from "express";
import { log } from "../log.ts";
import { endSession, readSession, startSession } from "../session.ts";
import { userFromLogin } from "../users.ts";

export const authRouter = Router();

/**
 * Signs in whoever asks: `{ name?, email?, merchantId? }`, all optional and none checked. The
 * merchant id is the one thing that matters downstream (it names whose orders OMS shows), so it
 * defaults to the development merchant.
 */
authRouter.post("/login", (req, res) => {
	const user = userFromLogin(req.body);
	startSession(res, user);
	// The email is a person's address, so the log names the merchant instead.
	log("auth", `sign-in: portal session started for merchant ${user.merchantId}`);
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
