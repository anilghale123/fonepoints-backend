/**
 * The only place the Providhy API key is used.
 *
 * Every call out to Providhy IAM goes through here, which is what makes "the key never leaves the
 * backend" a property you can check by reading one file rather than auditing a codebase.
 *
 * Errors are deliberately flattened: whatever IAM said, the portal frontend is told only that the
 * request failed and why in one sentence. A merchant cannot act on "invalid API key", and the
 * distinction between a bad key and an unknown merchant is an operator's problem — it is logged
 * here, where an operator can see it. The key itself is never logged.
 */

import { IAM_API_KEY, IAM_URL } from "./config.ts";
import { log, warn } from "./log.ts";

/** IAM is a network hop on every first open of OMS; a hung call must not hang the portal. */
const TIMEOUT_MS = 15_000;

export class IamError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(message: string, status: number, code: string) {
		super(message);
		this.name = "IamError";
		this.status = status;
		this.code = code;
	}
}

/**
 * Asks Providhy IAM for an OMS access token for one merchant.
 *
 * `POST {IAM_URL}api/external/oms/merchant-token/mint/` with the company key in `X-API-Key` and
 * the merchant in the body. IAM answers `{ "token": "<JWT>" }`. The token does not expire, so it is
 * returned to the caller and **not stored** here: the portal posts it into the OMS iframe and OMS
 * keeps it in its own HttpOnly cookie. A copy here would be one more place a never-expiring
 * credential could leak from, to save a call that only happens when OMS has no cookie.
 */
export async function mintMerchantToken(merchantId: string): Promise<string> {
	const path = "api/external/oms/merchant-token/mint/";
	const startedAt = Date.now();
	log("iam", `step 11 · POST ${IAM_URL}${path} for merchant ${merchantId} (X-API-Key attached, not logged)`);
	let res: Response;
	try {
		res = await fetch(`${IAM_URL}${path}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				// The company credential. Server to server, over this process's own network call.
				"x-api-key": IAM_API_KEY,
			},
			body: JSON.stringify({ merchant_id: merchantId }),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch (cause) {
		warn("iam", `✖ step 12 · ${path} unreachable after ${Date.now() - startedAt} ms`, {
			reason: cause instanceof Error ? cause.message : String(cause),
		});
		throw new IamError("Providhy IAM is unreachable", 502, "iam_unreachable");
	}

	const body: unknown = await res.json().catch(() => null);

	if (!res.ok) {
		// Logged for the operator; the portal gets one plain sentence.
		warn("iam", `✖ step 12 · IAM refused the request for merchant ${merchantId}: HTTP ${res.status} (${Date.now() - startedAt} ms)`, {
			body,
		});
		throw new IamError(
			"Providhy IAM refused the token request",
			502,
			res.status === 401 || res.status === 403 ? "iam_unauthorized" : "iam_error",
		);
	}

	const token =
		body && typeof body === "object" && "token" in body
			? (body as { token: unknown }).token
			: null;
	if (typeof token !== "string" || !token) {
		warn("iam", `✖ step 13 · IAM answered HTTP ${res.status} but with no token for merchant ${merchantId}`);
		throw new IamError("Providhy IAM sent no token", 502, "iam_no_token");
	}
	log("iam", `✔ step 13 · IAM issued a token for merchant ${merchantId} (${token.length} chars, ${Date.now() - startedAt} ms)`);
	return token;
}
