import type { OrderReceivedProps as Props } from "@emach/email/templates/order-received";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClientOrderDetail, sendEmail, logError, loadCompanyAddress } =
	vi.hoisted(() => ({
		getClientOrderDetail: vi.fn(),
		sendEmail: vi.fn(),
		logError: vi.fn(),
		loadCompanyAddress: vi.fn(),
	}));

vi.mock("@/lib/orders/queries", () => ({ getClientOrderDetail }));
vi.mock("@emach/email/send", () => ({ sendEmail }));
vi.mock("@emach/email/company-address", () => ({ loadCompanyAddress }));
vi.mock("@emach/db", () => ({ db: {} }));
vi.mock("@/lib/evlog", () => ({ log: { error: logError } }));
vi.mock("@emach/env/web", () => ({
	env: { NEXT_PUBLIC_SITE_URL: "https://loja.example.com.br" },
}));

import { sendOrderReceivedEmail } from "./order-received-email";

const DETAIL = {
	order: {
		id: "o1",
		number: "2026-000123",
		subtotalAmount: "1827.90",
		discountAmount: "50.00",
		shippingAmount: "42.10",
		totalAmount: "1820.00",
		shippingMethod: "Correios — PAC",
		shippingAddress: {
			recipient: "Ana Souza",
			street: "Rua das Obras",
			number: "100",
			complement: "Apto 2",
			neighborhood: "Centro",
			city: "Campinas",
			state: "SP",
			zipCode: "13010-000",
			country: "BR",
		},
	},
	items: [
		{
			id: "i1",
			name: "Furadeira",
			voltage: "220V",
			quantity: 2,
			lineTotal: "1798.00",
		},
	],
	history: [],
	reviewedToolIds: [],
};

const ARGS = {
	clientId: "c1",
	orderId: "o1",
	to: "ana@example.com",
	name: "Ana Souza",
};

const COMPANY_ADDRESS = [
	"Rua Pascoal Moreira Cabral Leme, 64, Loja Pinheiro, Nova Esperança",
	"Balneário Camboriú/SC, CEP 88336-310",
];

const LINE_TOTAL = /1\.798,00/;
const ORDER_TOTAL = /1\.820,00/;

describe("sendOrderReceivedEmail", () => {
	beforeEach(() => {
		getClientOrderDetail.mockReset();
		sendEmail.mockReset();
		logError.mockReset();
		loadCompanyAddress.mockReset();
		getClientOrderDetail.mockResolvedValue(DETAIL);
		loadCompanyAddress.mockResolvedValue(COMPANY_ADDRESS);
	});

	it("envia ao cliente o pedido lido do banco, com link para pagar", async () => {
		sendEmail.mockResolvedValue({ id: "email-1" });

		await sendOrderReceivedEmail(ARGS);

		expect(getClientOrderDetail).toHaveBeenCalledWith("c1", "o1");
		expect(sendEmail).toHaveBeenCalledTimes(1);
		const [{ to, subject, react }] = sendEmail.mock.calls[0] as [
			{ to: string; subject: string; react: { props: Props } },
		];
		expect(to).toBe("ana@example.com");
		expect(subject).toContain("2026-000123");
		const p = react.props;
		expect(p.orderNumber).toBe("2026-000123");
		expect(p.orderUrl).toBe("https://loja.example.com.br/dashboard/pedidos/o1");
		expect(p.items[0]).toMatchObject({ name: "Furadeira", detail: "220V" });
		expect(p.items[0]?.lineTotal).toMatch(LINE_TOTAL);
		expect(p.total).toMatch(ORDER_TOTAL);
		expect(p.summary.map((r) => r.label)).toEqual([
			"Subtotal",
			"Desconto do cupom",
			"Frete (Correios — PAC)",
		]);
		expect(p.addressLines).toEqual([
			"Ana Souza",
			"Rua das Obras, 100 — Apto 2",
			"Centro, Campinas — SP",
			"CEP 13010-000",
		]);
		expect(p.companyAddress).toEqual(COMPANY_ADDRESS);
		expect(logError).not.toHaveBeenCalled();
	});

	it("omite a linha de desconto quando não há cupom", async () => {
		getClientOrderDetail.mockResolvedValue({
			...DETAIL,
			order: { ...DETAIL.order, discountAmount: "0.00", shippingMethod: null },
		});
		sendEmail.mockResolvedValue({ id: "email-1" });

		await sendOrderReceivedEmail(ARGS);

		const [{ react }] = sendEmail.mock.calls[0] as [
			{ react: { props: Props } },
		];
		expect(react.props.summary.map((r) => r.label)).toEqual([
			"Subtotal",
			"Frete",
		]);
	});

	it("sem endereço da loja o e-mail sai mesmo assim", async () => {
		loadCompanyAddress.mockResolvedValue(null);
		sendEmail.mockResolvedValue({ id: "email-1" });

		await sendOrderReceivedEmail(ARGS);

		const [{ react }] = sendEmail.mock.calls[0] as [
			{ react: { props: Props } },
		];
		expect(react.props.companyAddress).toBeNull();
		expect(react.props.orderNumber).toBe("2026-000123");
	});

	it("falha do Resend vai para o log e não lança", async () => {
		sendEmail.mockRejectedValue(new Error("Resend send failed: 500"));

		await expect(sendOrderReceivedEmail(ARGS)).resolves.toBeUndefined();

		expect(logError).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "order_received_email_failed",
				orderId: "o1",
			})
		);
	});

	it("pedido não encontrado vai para o log sem enviar", async () => {
		getClientOrderDetail.mockResolvedValue(null);

		await expect(sendOrderReceivedEmail(ARGS)).resolves.toBeUndefined();

		expect(sendEmail).not.toHaveBeenCalled();
		expect(logError).toHaveBeenCalledWith(
			expect.objectContaining({ action: "order_received_email_failed" })
		);
	});
});
