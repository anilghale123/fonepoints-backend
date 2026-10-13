/**
 * Entry point. Node runs this file as TypeScript directly — no build step, no bundler — so what
 * runs is what is on disk.
 */

import { createApp } from "./app.ts";
import { IAM_API_KEY, IAM_URL, PORT, PORTAL_ORIGIN } from "./config.ts";

// Without the key every token request would fail with a confusing IAM error. Refusing to start is
// louder than a log line nobody reads on a VPS.
if (!IAM_API_KEY) {
	console.error("IAM_API_KEY is not set. Put the Providhy API key in .env and restart.");
	process.exit(1);
}

createApp().listen(PORT, () => {
	console.log(`fonepoints-backend  http://localhost:${PORT}`);
	console.log(`  portal origin     ${PORTAL_ORIGIN}`);
	console.log(`  providhy iam      ${IAM_URL}`);
});
