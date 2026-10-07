/**
 * Entry point. Node runs this file as TypeScript directly — no build step, no bundler — so what
 * runs is what is on disk.
 */

import { createApp } from "./app.ts";
import { OMS_BASE_URL, PORT, PORTAL_ORIGIN, USING_PLACEHOLDER_API_KEY } from "./config.ts";

// A deployed service must not run on the shared development key: anyone who has read the repo
// knows it. Refusing to start is louder than a log line nobody reads on a VPS.
if (process.env.NODE_ENV === "production" && USING_PLACEHOLDER_API_KEY) {
	console.error("OMS_API_KEY is still the development placeholder. Set a real key and restart.");
	process.exit(1);
}

createApp().listen(PORT, () => {
	console.log(`fonepoints-backend  http://localhost:${PORT}`);
	console.log(`  portal origin     ${PORTAL_ORIGIN}`);
	console.log(`  oms backend       ${OMS_BASE_URL}`);
	if (USING_PLACEHOLDER_API_KEY) {
		console.log("  oms api key       placeholder — set OMS_API_KEY to match oms-backend");
	}
});
