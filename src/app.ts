/**
 * The Express app: CORS, cookies, JSON, two routers.
 *
 * CORS is `credentials: true` against one configured origin, never `*`. The two go together — a
 * browser refuses to send cookies to a wildcard origin — and a wildcard would let any page call
 * this API with the merchant's session and read the OMS token out of the response.
 */

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { PORTAL_ORIGIN, USING_PLACEHOLDER_API_KEY } from "./config.ts";
import { authRouter } from "./routes/auth.ts";
import { omsRouter } from "./routes/oms.ts";

export function createApp() {
	const app = express();

	app.disable("x-powered-by");
	app.use(cors({ origin: PORTAL_ORIGIN, credentials: true }));
	app.use(cookieParser());
	app.use(express.json({ limit: "256kb" }));

	app.get("/api/health", (_req, res) => {
		res.json({
			status: "ok",
			service: "fonepoints-backend",
			portalOrigin: PORTAL_ORIGIN,
			usingPlaceholderApiKey: USING_PLACEHOLDER_API_KEY,
		});
	});

	app.use("/api/auth", authRouter);
	app.use("/api/oms", omsRouter);

	app.use((_req, res) => {
		res.status(404).json({ error: { code: "not_found", message: "No such route" } });
	});

	return app;
}
