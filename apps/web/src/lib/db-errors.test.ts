import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./db-errors";

describe("isUniqueViolation", () => {
	it("aceita erro com cause.code 23505", () => {
		const err = new Error("insert failed", { cause: { code: "23505" } });

		expect(isUniqueViolation(err)).toBe(true);
	});

	it("recusa cause com outro código", () => {
		const err = new Error("insert failed", { cause: { code: "23503" } });

		expect(isUniqueViolation(err)).toBe(false);
	});

	it("recusa erro sem cause", () => {
		expect(isUniqueViolation(new Error("boom"))).toBe(false);
	});

	it("com constraint, só aceita a violação daquela constraint", () => {
		const doc = new Error("insert failed", {
			cause: { code: "23505", constraint: "client_document_unique" },
		});

		const email = new Error("insert failed", {
			cause: { code: "23505", constraint: "client_email_unique" },
		});

		expect(isUniqueViolation(doc, "client_document_unique")).toBe(true);
		expect(isUniqueViolation(email, "client_document_unique")).toBe(false);
		expect(isUniqueViolation(email)).toBe(true);
	});

	it("recusa valor que não é objeto", () => {
		expect(isUniqueViolation("23505")).toBe(false);
		expect(isUniqueViolation(null)).toBe(false);
		expect(isUniqueViolation(undefined)).toBe(false);
	});
});
