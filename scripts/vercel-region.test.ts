import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const VERCEL_JSON = resolve(import.meta.dir, "../apps/web/vercel.json");

const MOTIVO =
	"As funções da Vercel precisam rodar em gru1 porque o banco Supabase fica em sa-east-1. " +
	"No dashboard, fora de gru1 cada query pagou ~140 ms de ida e volta e a navegação RSC chegou a 1,9 s (emach-dashboard#356).";

test("as funções da Vercel ficam fixadas em gru1 no apps/web/vercel.json", () => {
	expect(
		existsSync(VERCEL_JSON),
		`apps/web/vercel.json não existe. ${MOTIVO}`
	).toBe(true);

	const { regions } = z
		.object({ regions: z.array(z.string()) })
		.parse(JSON.parse(readFileSync(VERCEL_JSON, "utf8")));

	expect(regions, MOTIVO).toEqual(["gru1"]);
});
