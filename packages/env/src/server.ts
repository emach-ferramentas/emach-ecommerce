import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { serverSchema } from "./schemas";

const currentDir = dirname(fileURLToPath(import.meta.url));

const dotenvPaths = [
	resolve(process.cwd(), ".env"),
	resolve(process.cwd(), "apps/web/.env"),
	resolve(currentDir, "../../../apps/web/.env"),
];

for (const dotenvPath of new Set(dotenvPaths)) {
	if (existsSync(dotenvPath)) {
		dotenv.config({ path: dotenvPath, quiet: true });
	}
}

export const env = createEnv({
	server: serverSchema,
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
