/**
 * `POST /api/oms/token` — the step the whole flow turns on.
 *
 * The merchant presses OMS in the portal. The Angular app asks this route for an access token; it
 * presents the company API key to OMS, and hands back the token OMS issues. Three properties make
 * it worth the extra hop:
 *
 * - The key never reaches a browser. The portal frontend could not ask OMS directly even if it
 *   wanted to; it has no credential OMS would accept.
 * - Which merchant the token is for comes from the **session**, never from the request body. A
 *   signed-in merchant cannot ask for another merchant's token by editing a payload.
 * - OMS decides. This service does not mint, sign or validate anything — it carries a request it
 *   is allowed to make, which is why it can stay this small.
 *
 * The token is returned to the caller and not stored. The portal frontend passes it into the OMS
 * iframe over `postMessage`, and OMS puts it in its own cookie from there.
 */

import { Router } from "express";
import { OmsError, createOmsOrder, omsHealth, requestOmsAccessToken } from "../oms-client.ts";
import { readSession } from "../session.ts";

export const omsRouter = Router();

omsRouter.post("/token", async (req, res) => {
	const user = readSession(req);
	if (!user) {
		res
			.status(401)
			.json({ error: { code: "unauthorized", message: "Sign in to open OMS" } });
		return;
	}

	try {
		const grant = await requestOmsAccessToken({
			merchantRef: user.omsMerchantRef,
			user: { name: user.name, email: user.email },
		});

		// The token goes back to the portal frontend, which posts it into the iframe. It is not
		// written into a cookie here: this origin is the portal's, and OMS needs it on its own.
		res.json({
			accessToken: grant.accessToken,
			tokenType: grant.tokenType,
			issuedAt: grant.issuedAt,
			merchant: grant.merchant,
		});
	} catch (cause) {
		const error =
			cause instanceof OmsError
				? cause
				: new OmsError("Could not open OMS", 500, "server_error");
		res.status(error.status).json({ error: { code: error.code, message: error.message } });
	}
});

/**
 * `POST /api/oms/orders` — push an order into OMS.
 *
 * The other thing the company key authorises, and the reason the key is a company credential
 * rather than a per-merchant one: a redemption in the Fonepoints app becomes an OMS order without
 * any merchant being signed in. Here it is a demo endpoint; in the real system it is called by
 * whatever completes a redemption.
 */
omsRouter.post("/orders", async (req, res) => {
	try {
		const created = await createOmsOrder((req.body ?? {}) as Record<string, unknown>);
		res.status(201).json(created);
	} catch (cause) {
		const error =
			cause instanceof OmsError
				? cause
				: new OmsError("Could not create the order", 500, "server_error");
		res.status(error.status).json({ error: { code: error.code, message: error.message } });
	}
});

/** `GET /api/oms/health` — proxied OMS liveness, so the portal can tell the two failures apart. */
omsRouter.get("/health", async (_req, res) => {
	try {
		res.json(await omsHealth());
	} catch {
		res
			.status(502)
			.json({ error: { code: "oms_unreachable", message: "OMS is unreachable" } });
	}
});
