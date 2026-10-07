/**
 * Every environment value this service reads.
 *
 * Node loads `.env` itself (`--env-file-if-exists` in the npm scripts), so there is no dotenv
 * dependency and no import-order trap: the variables exist before this module is evaluated.
 */

export const PORT = Number(process.env.PORT || 4000);

/** The portal's origin, allowed through CORS with credentials so the session cookie travels. */
export const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN?.trim() || "http://localhost:4200";

/** Where the OMS backend answers. Server to server only; a browser never calls it directly. */
export const OMS_BASE_URL = process.env.OMS_BASE_URL?.trim() || "http://localhost:3001";

/**
 * The OMS company API key.
 *
 * This is the secret the whole indirection exists to protect. It stays in this process: the portal
 * frontend asks *us* for an access token, and we are the ones who present the key. A browser must
 * never see it, which is why the Angular app has no equivalent of this constant.
 *
 * Must match `OMS_COMPANY_API_KEY` in `oms-backend`.
 */
export const OMS_API_KEY =
	process.env.OMS_API_KEY?.trim() || "oms_ck_dev_fonepoints_replace_me";

/** True while the key is still the shared development placeholder. */
export const USING_PLACEHOLDER_API_KEY = OMS_API_KEY === "oms_ck_dev_fonepoints_replace_me";

/**
 * `SameSite` for the portal session cookie.
 *
 * `lax` is right whenever the portal and this API are on one site — `localhost:4200` and
 * `localhost:4000` are, since the port is not part of a site, and so are `portal.fonepoints.com`
 * and `api.fonepoints.com`. Split them across registrable domains and this has to become `none`,
 * which then also requires `secure`.
 */
export const SESSION_SAMESITE = (process.env.SESSION_SAMESITE?.trim() || "lax") as
	| "lax"
	| "strict"
	| "none";

/** `Secure` on the session cookie. Required when `SESSION_SAMESITE` is `none`. */
export const SESSION_SECURE =
	(process.env.SESSION_SECURE?.trim() || (SESSION_SAMESITE === "none" ? "1" : "0")) !== "0";
