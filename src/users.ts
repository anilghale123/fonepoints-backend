/**
 * The portal's user, as the portal's login page describes themselves.
 *
 * There is no Fonepoints identity provider to talk to here, so the login takes whatever it is
 * given and checks nothing: any name and email signs in, and nothing is looked up. What matters
 * for the OMS handoff is the one field a real session would also have to carry: `merchantId`, the
 * id Providhy knows this merchant by. That is what the token request is made with, so it decides
 * whose orders the merchant sees.
 *
 * Replacing this with the real portal identity means changing `routes/auth.ts` and this file, and
 * nothing downstream: everything past that point only reads `merchantId`.
 */

export interface PortalUser {
	name: string;
	email: string;
	role: string;
	/** The merchant's id in Providhy (Sales `merchant_detail.id`), e.g. `M-1029`. */
	merchantId: string;
}

/** The merchant the development Sales service has orders for; used when none is typed. */
export const DEFAULT_MERCHANT_ID = "M-1029";

/** Fields end up in the session cookie, so they are kept short. */
const MAX_LENGTH = 100;

function text(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_LENGTH) : fallback;
}

/** Builds the user from a login body. Never fails: anything missing gets a default. */
export function userFromLogin(body: unknown): PortalUser {
	const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
	const email = text(input.email, "");
	return {
		name: text(input.name, email.split("@")[0] || "Merchant"),
		email,
		role: "Merchant",
		merchantId: text(input.merchantId, DEFAULT_MERCHANT_ID),
	};
}
