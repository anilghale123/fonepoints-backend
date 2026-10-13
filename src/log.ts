/**
 * Trace logging for the OMS token handoff, for testing it end to end and for an operator reading
 * `pm2 logs`.
 *
 * One line per thing that happens, prefixed `[FP-backend:<scope>]` and tagged with the step number
 * from the flow document (`OMS-Fonepoints-Flow.docx`) wherever there is one, so a run reads against
 * the flowchart next to the portal's `[Portal:…]` and OMS's `[OMS:…]` lines.
 *
 * **It never prints a credential.** Not the Providhy API key, not the token IAM returns, not a
 * session id, cookie or header: call sites log outcomes, lengths and the merchant id. Anything
 * passed as `data` under a key that looks like a secret is replaced before it is printed.
 *
 * Always on: this is a server, and these lines are what an operator needs. Set `LOG_QUIET=1` to
 * silence everything except warnings.
 */

export type LogScope = "http" | "auth" | "oms" | "iam";

const SECRET_KEY = /token|authorization|api[-_]?key|password|secret|cookie|session[-_]?id/i;
const quiet = process.env.LOG_QUIET === "1";

function redact(value: unknown, depth = 0): unknown {
	if (depth > 4 || value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
			key,
			SECRET_KEY.test(key)
				? typeof entry === "string"
					? `<redacted, ${entry.length} chars>`
					: "<redacted>"
				: redact(entry, depth + 1),
		]),
	);
}

function line(scope: LogScope, message: string): string {
	return `[FP-backend:${scope}] ${new Date().toISOString().slice(11, 23)} ${message}`;
}

export function log(scope: LogScope, message: string, data?: unknown): void {
	if (quiet) return;
	if (data === undefined) console.log(line(scope, message));
	else console.log(line(scope, message), redact(data));
}

/** Prints even with `LOG_QUIET=1`: a refused request, or IAM refusing us. */
export function warn(scope: LogScope, message: string, data?: unknown): void {
	if (data === undefined) console.warn(line(scope, message));
	else console.warn(line(scope, message), redact(data));
}
