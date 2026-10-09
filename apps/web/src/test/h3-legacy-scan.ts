import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface LegacyHit {
	file: string;
	line: number;
	token: string;
}

const SRC_ROOT = resolve(import.meta.dirname, "..");

export const LEGACY_PATTERNS: ReadonlyArray<{ re: RegExp; token: string }> = [
	{ token: "near-black", re: /near-black/ },
	{ token: "gray-(10|20|50|55|60)", re: /\bgray-(10|20|50|55|60)\b/ },
	{ token: "cinema-", re: /cinema-/ },
	{ token: "image-bg", re: /image-bg/ },
	{ token: "white/<n>", re: /\bwhite\/[\d[]/ },
	{
		token: "<cor>-on-dark",
		re: /\b(emach-red|success|amber|info)-on-dark\b/,
	},
	{ token: "tracking-[0.", re: /tracking-\[0\./ },
	{ token: "rounded-none", re: /\brounded-none\b/ },
	{ token: "bg-emach-red/", re: /bg-emach-red\// },
	{ token: "border-emach-red", re: /\bborder-emach-red\b/ },
	{ token: "border-<lado>-emach-red", re: /\bborder-[lrtbxy]-emach-red\b/ },
	{
		token: "régua border-<lado>-2 border-ink",
		re: /^(?=.*\bborder-[tbxy]-(?:2|\[[2-9]px\])(?!\S))(?=.*(?<![:\w-])border-ink\b)/,
	},
	{ token: "Breadcrumb", re: /\bBreadcrumb\b/ },
	{ token: "SectionLabel", re: /\bSectionLabel\b/ },
	{ token: "AccountHero", re: /\bAccountHero\b/ },
	{ token: "AccountSection", re: /\bAccountSection\b/ },
	{ token: "AccountBadge", re: /\bAccountBadge\b/ },
	{ token: "QuantityPicker", re: /\bQuantityPicker\b/ },
	{ token: "emach-ghost-btn", re: /emach-ghost-btn/ },
	{ token: "text-success", re: /\btext-success\b/ },
	{ token: "text-destructive", re: /\btext-destructive\b/ },
	{ token: "emach-bg-placeholder", re: /emach-bg-placeholder/ },
];

export function scanSource(source: string, file: string): LegacyHit[] {
	const hits: LegacyHit[] = [];
	const lines = source.split("\n");
	for (const [index, text] of lines.entries()) {
		for (const { re, token } of LEGACY_PATTERNS) {
			if (re.test(text)) {
				hits.push({ file, line: index + 1, token });
			}
		}
	}
	return hits;
}

export function scanForLegacyTokens(files: readonly string[]): LegacyHit[] {
	return files.flatMap((file) =>
		scanSource(readFileSync(join(SRC_ROOT, file), "utf8"), file)
	);
}

const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;

export function filesUnder(dir: string): string[] {
	return readdirSync(join(SRC_ROOT, dir), { encoding: "utf8", recursive: true })
		.filter((path) => SOURCE_FILE.test(path) && !TEST_FILE.test(path))
		.map((path) => join(dir, path))
		.sort();
}
