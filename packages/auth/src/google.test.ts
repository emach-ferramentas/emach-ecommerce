import { describe, expect, test } from "bun:test";
import { createGoogleProviderConfig } from "./google";

describe("createGoogleProviderConfig", () => {
	test("maps Google OAuth env vars to Better Auth provider config", () => {
		const config = createGoogleProviderConfig({
			clientId: "google-client-id",
			clientSecret: "google-client-secret",
		});

		expect(config).toEqual({
			clientId: "google-client-id",
			clientSecret: "google-client-secret",
			prompt: "select_account",
		});
	});
});
