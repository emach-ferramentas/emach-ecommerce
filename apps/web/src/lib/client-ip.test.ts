import { describe, expect, it } from "vitest";

import { getClientIp } from "./client-ip";

describe("getClientIp", () => {
	it("prefere x-real-ip quando presente", () => {
		const h = new Headers({
			"x-real-ip": "203.0.113.5",
			"x-forwarded-for": "1.2.3.4",
		});

		expect(getClientIp(h)).toBe("203.0.113.5");
	});

	it("usa o ÚLTIMO hop de x-forwarded-for (primeiro é spoofável)", () => {
		const h = new Headers({ "x-forwarded-for": "1.2.3.4, 9.9.9.9" });
		expect(getClientIp(h)).toBe("9.9.9.9");
	});

	it("um X-Forwarded-For forjado no início não altera o resultado", () => {
		const h = new Headers({ "x-forwarded-for": "66.66.66.66, 203.0.113.5" });
		expect(getClientIp(h)).toBe("203.0.113.5");
	});

	it("retorna o único elemento em dev (sem proxy)", () => {
		const h = new Headers({ "x-forwarded-for": "127.0.0.1" });
		expect(getClientIp(h)).toBe("127.0.0.1");
	});

	it("retorna null quando nenhum header está presente", () => {
		expect(getClientIp(new Headers())).toBeNull();
	});
});
