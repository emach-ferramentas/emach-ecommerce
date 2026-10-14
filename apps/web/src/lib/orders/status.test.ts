import { describe, expect, it } from "vitest";
import {
	countByTab,
	isTerminalNegative,
	ORDER_STATUS_BADGE,
	orderStepDisplayState,
	statusToTab,
	stepStateFor,
} from "./status";

describe("statusToTab", () => {
	it("agrupa pagamento pendente e falho em 'a_pagar'", () => {
		expect(statusToTab("pending_payment")).toBe("a_pagar");
		expect(statusToTab("payment_failed")).toBe("a_pagar");
	});
	it("agrupa paid e preparing em 'em_preparacao'", () => {
		expect(statusToTab("paid")).toBe("em_preparacao");
		expect(statusToTab("preparing")).toBe("em_preparacao");
	});
	it("shipped -> a_caminho, delivered -> concluidos", () => {
		expect(statusToTab("shipped")).toBe("a_caminho");
		expect(statusToTab("delivered")).toBe("concluidos");
	});
	it("cancelados/devolvidos não têm tab própria (só 'all')", () => {
		expect(statusToTab("canceled")).toBe(null);
		expect(statusToTab("refunded")).toBe(null);
		expect(statusToTab("returned")).toBe(null);
	});
});

describe("ORDER_STATUS_BADGE", () => {
	it("cobre os 9 status com label e tone", () => {
		for (const s of [
			"pending_payment",
			"paid",
			"preparing",
			"shipped",
			"delivered",
			"canceled",
			"refunded",
			"payment_failed",
			"returned",
		] as const) {
			expect(ORDER_STATUS_BADGE[s].label).toBeTruthy();
			expect(ORDER_STATUS_BADGE[s].tone).toBeTruthy();
		}
	});
	it("payment_failed usa tone 'danger'", () => {
		expect(ORDER_STATUS_BADGE.payment_failed.tone).toBe("danger");
	});
});

describe("countByTab", () => {
	it("conta 'all' como total e agrupa por tab", () => {
		const counts = countByTab([
			"pending_payment",
			"paid",
			"shipped",
			"delivered",
			"canceled",
		]);

		expect(counts.all).toBe(5);
		expect(counts.a_pagar).toBe(1);
		expect(counts.em_preparacao).toBe(1);
		expect(counts.a_caminho).toBe(1);
		expect(counts.concluidos).toBe(1);
	});
});

describe("stepStateFor", () => {
	it("aguardando pagamento: todas as fases 'upcoming'", () => {
		for (const phase of [
			"paid",
			"preparing",
			"shipped",
			"delivered",
		] as const) {
			expect(stepStateFor("pending_payment", phase)).toBe("upcoming");
		}
	});
	it("shipped: paid/preparing 'done', shipped 'current', delivered 'upcoming'", () => {
		expect(stepStateFor("shipped", "paid")).toBe("done");
		expect(stepStateFor("shipped", "preparing")).toBe("done");
		expect(stepStateFor("shipped", "shipped")).toBe("current");
		expect(stepStateFor("shipped", "delivered")).toBe("upcoming");
	});
	it("delivered: todas as fases 'done' (delivered é a última, vira 'current')", () => {
		expect(stepStateFor("delivered", "paid")).toBe("done");
		expect(stepStateFor("delivered", "shipped")).toBe("done");
		expect(stepStateFor("delivered", "delivered")).toBe("current");
	});
	it("terminal negativo: todas as fases 'upcoming'", () => {
		for (const phase of [
			"paid",
			"preparing",
			"shipped",
			"delivered",
		] as const) {
			expect(stepStateFor("canceled", phase)).toBe("upcoming");
		}
	});
});

describe("isTerminalNegative", () => {
	it("true para canceled/refunded/returned, false para o resto", () => {
		expect(isTerminalNegative("canceled")).toBe(true);
		expect(isTerminalNegative("refunded")).toBe(true);
		expect(isTerminalNegative("returned")).toBe(true);
		expect(isTerminalNegative("delivered")).toBe(false);
		expect(isTerminalNegative("pending_payment")).toBe(false);
	});
});

describe("orderStepDisplayState", () => {
	it("pending_payment marca a fase 'paid' (Pagamento) como current", () => {
		expect(orderStepDisplayState("pending_payment", "paid")).toBe("current");
		expect(orderStepDisplayState("pending_payment", "preparing")).toBe(
			"upcoming"
		);
	});

	it("payment_failed também marca 'paid' como current", () => {
		expect(orderStepDisplayState("payment_failed", "paid")).toBe("current");
	});

	it("demais status delegam a stepStateFor", () => {
		expect(orderStepDisplayState("shipped", "paid")).toBe("done");
		expect(orderStepDisplayState("shipped", "preparing")).toBe("done");
		expect(orderStepDisplayState("shipped", "shipped")).toBe("current");
		expect(orderStepDisplayState("shipped", "delivered")).toBe("upcoming");
	});
});
