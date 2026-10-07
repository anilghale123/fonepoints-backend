/**
 * The only place the OMS API key is used.
 *
 * Every call out to OMS goes through here, which is what makes "the key never leaves the backend"
 * a property you can check by reading one file rather than auditing a codebase.
 *
 * Errors are deliberately flattened: whatever OMS said, the portal frontend is told only that the
 * exchange failed and why in one sentence. A merchant cannot act on "invalid API key", and the
 * distinction between a bad key and an unregistered merchant is an operator's problem — it is
 * logged here, where an operator can see it.
 */

import { OMS_API_KEY, OMS_BASE_URL } from "./config.ts";

export interface OmsMerchant {
	merchantId: string;
	companyName: string;
	location: string;
	logoUrl: string;
}

export interface OmsTokenGrant {
	accessToken: string;
	tokenType: string;
	issuedAt: string;
	merchant: OmsMerchant;
}

export class OmsError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(message: string, status: number, code: string) {
		super(message);
		this.name = "OmsError";
		this.status = status;
		this.code = code;
	}
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${OMS_BASE_URL}${path}`, {
			...init,
			headers: {
				"content-type": "application/json",
				// The company credential. Server to server, over this process's own network call.
				"x-api-key": OMS_API_KEY,
				...init.headers,
			},
		});
	} catch (cause) {
		console.error(`[oms] ${path} unreachable:`, cause);
		throw new OmsError("OMS is unreachable", 502, "oms_unreachable");
	}

	const body: unknown = await res.json().catch(() => null);

	if (!res.ok) {
		const error =
			body && typeof body === "object" && "error" in body
				? (body as { error: { code?: string; message?: string } }).error
				: null;
		console.error(`[oms] ${path} failed: ${res.status}`, error ?? body);
		throw new OmsError(
			error?.message || "OMS rejected the request",
			res.status === 401 || res.status === 403 ? 502 : res.status,
			error?.code || "oms_error",
		);
	}

	return body as T;
}

/**
 * Asks OMS for an access token for one merchant.
 *
 * This is step two of the handoff: the portal frontend asked us, and we ask OMS with the key. The
 * token that comes back is a merchant credential with no expiry, so it is returned to the caller
 * and never stored here — this service holds the key, not the sessions it opens.
 */
export function requestOmsAccessToken(input: {
	merchantRef: string;
	user: { name: string; email: string };
}): Promise<OmsTokenGrant> {
	return call<OmsTokenGrant>("/api/v1/auth/token", {
		method: "POST",
		body: JSON.stringify({ merchantRef: input.merchantRef, user: input.user }),
	});
}

/** Pushes a new order into OMS — the other thing the company key authorises. */
export function createOmsOrder(order: Record<string, unknown>): Promise<unknown> {
	return call<unknown>("/api/v1/orders", { method: "POST", body: JSON.stringify(order) });
}

/** Unauthenticated liveness, so the portal can say "OMS is down" rather than "sign-in failed". */
export async function omsHealth(): Promise<unknown> {
	const res = await fetch(`${OMS_BASE_URL}/api/v1/health`).catch(() => null);
	if (!res) throw new OmsError("OMS is unreachable", 502, "oms_unreachable");
	return res.json();
}
