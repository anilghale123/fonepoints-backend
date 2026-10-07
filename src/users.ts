/**
 * The portal's users — dummy data, like everything else in this phase.
 *
 * There is no real Fonepoints identity provider to talk to, so a sign-in is an email lookup. What
 * matters for the OMS handoff is the one field a real session would also have to carry:
 * `omsMerchantRef`, the name OMS knows this merchant by. That is what the token request is made
 * with, so it decides whose orders the merchant sees.
 *
 * Replacing this with the real portal session is the whole change on this side: everything
 * downstream only reads `omsMerchantRef`.
 */

export interface PortalUser {
	email: string;
	name: string;
	role: string;
	/** `externalRef` of the merchant in `oms-backend`'s registration. */
	omsMerchantRef: string;
}

export const PORTAL_USERS: readonly PortalUser[] = [
	{
		email: "merchant@fonepoints.local",
		name: "Merchant User",
		role: "Merchant",
		omsMerchantRef: "fp-hamro-mobile",
	},
	{
		email: "gadget@fonepoints.local",
		name: "Gadget Ghar Owner",
		role: "Owner",
		omsMerchantRef: "fp-gadget-ghar",
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
