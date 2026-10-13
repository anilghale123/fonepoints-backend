/**
 * The portal's users — dummy data, standing in for the real Fonepoints identity provider.
 *
 * There is no real Fonepoints sign-in to talk to here, so a sign-in is an email lookup. What
 * matters for the OMS handoff is the one field a real session would also have to carry:
 * `merchantId`, the id Providhy knows this merchant by. That is what the token request is made
 * with, so it decides whose orders the merchant sees.
 *
 * Replacing this with the real portal session is the whole change on this side: everything
 * downstream only reads `merchantId`.
 */

export interface PortalUser {
	email: string;
	name: string;
	role: string;
	/** The merchant's id in Providhy (Sales `merchant_detail.id`), e.g. `M-1029`. */
	merchantId: string;
}

export const PORTAL_USERS: readonly PortalUser[] = [
	{
		email: "merchant@fonepoints.local",
		name: "Merchant User",
		role: "Merchant",
		// The merchant the dev Sales service has orders for.
		merchantId: "M-1029",
	},
];

/**
 * Looks a user up by email, case-insensitively.
 *
 * An unknown email signs in as the first user rather than failing. This is a demo sign-in with no
 * password, so refusing would only make the flow harder to walk through; a real one replaces this
 * function outright.
 */
export function findUser(email: string): PortalUser {
	const match = PORTAL_USERS.find(
		(user) => user.email.toLowerCase() === email.trim().toLowerCase(),
	);
	return match ?? PORTAL_USERS[0]!;
}
