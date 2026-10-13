/**
 * `POST /api/oms/token` — the step the whole flow turns on.
 *
 * OMS has no session cookie (or Sales refused its token), so it asks the portal for a token with
 * `oms.auth.renew`; the portal asks this route. It presents the company API key to Providhy IAM and
 * hands back the token IAM issues. Three properties make it worth the extra hop:
 *
 * - The key never reaches a browser. The portal frontend could not ask IAM directly even if it
 *   wanted to; it has no credential IAM would accept.
 * - Which merchant the token is for comes from the **session**, never from the request. A
 *   signed-in merchant cannot ask for another merchant's token by editing a payload: the route
 *   reads no body at all.
 * - IAM decides. This service does not mint, sign or validate anything — it carries a request it
 *   is allowed to make, which is why it can stay this small.
 *
 * The token is returned to the caller and not stored, here or in the portal. The portal posts it
 * into the OMS iframe and OMS keeps it in its own HttpOnly cookie from there.
 */

import { Router } from "express";
import { PORTAL_ORIGIN } from "../config.ts";
import { IamError, mintMerchantToken } from "../iam-client.ts";
import { log, warn } from "../log.ts";
import { readSession } from "../session.ts";

export const omsRouter = Router();

omsRouter.post("/token", async (req, res) => {
	// CORS stops other sites reading the answer; this stops them spending the session at all.
	// Browsers always send `Origin` on a cross-site POST, so a missing one means a non-browser
	// caller, which has no session cookie to spend anyway.
	const origin = req.get("origin");
	if (origin && origin !== PORTAL_ORIGIN) {
		warn("oms", "✖ step 9 · POST /api/oms/token refused: the request's Origin is not the portal", {
			origin,
			expected: PORTAL_ORIGIN,
		});
		res.status(403).json({ error: { code: "forbidden", message: "Wrong origin" } });
		return;
	}

	const user = readSession(req);
	if (!user) {
		warn("oms", "✖ step 10 · POST /api/oms/token refused: no portal session (no cookie, or it is unknown)");
		res
			.status(401)
			.json({ error: { code: "unauthorized", message: "Sign in to open OMS" } });
		return;
	}

	log("oms", `step 10–11 · portal session found for merchant ${user.merchantId}; asking IAM for a token`);
	try {
		const accessToken = await mintMerchantToken(user.merchantId);
		log("oms", "✔ step 13–14 · returning { accessToken } to the portal (not stored here)", {
			accessToken,
		});
		// The token goes back to the portal frontend, which posts it into the iframe. It is not
		// written into a cookie here: this origin is the portal's, and OMS needs it on its own.
		res.set("cache-control", "no-store").json({ accessToken });
	} catch (cause) {
		const error =
			cause instanceof IamError
				? cause
				: new IamError("Could not open OMS", 500, "server_error");
		warn("oms", `✖ step 12 · no token for merchant ${user.merchantId}: ${error.code} → HTTP ${error.status}`);
		res.status(error.status).json({ error: { code: error.code, message: error.message } });
	}
});
