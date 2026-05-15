import { mockOrders } from "./mock-orders";
import { mockRefunds } from "./mock-refunds";
import type {
	BuyerSnapshot,
	OrderBreakdown,
	OrderDetail,
	PaymentInfo,
	ShippingAddress,
} from "./types";

const defaultBuyer: BuyerSnapshot = {
	name: "Larissa Alves",
	email: "obsidianlab3d@gmail.com",
	phone: "(11) 9 8765-4321",
	document: "***.***.789-12",
};

const defaultAddress: ShippingAddress = {
	recipient: "Larissa Alves",
	street: "Rua das Oficinas, 1450",
	complement: "Apto 204, Bloco B",
	neighborhood: "Vila Industrial",
	city: "São Paulo",
	state: "SP",
	zip: "04321-080",
	country: "Brasil",
};

interface BreakdownInput {
	discountCents?: number;
	discountLabel?: string;
	shippingCents: number;
	shippingMethod: string;
	subtotalCents: number;
}

function buildBreakdown(input: BreakdownInput): OrderBreakdown {
	const discount = input.discountCents ?? 0;
	return {
		...input,
		totalCents: input.subtotalCents + input.shippingCents - discount,
	};
}

function pixPayment(confirmedAt: Date): PaymentInfo {
	return {
		kind: "pix",
		label: "Pago via Pix",
		detail: `Confirmado em ${confirmedAt.toLocaleDateString("pt-BR")} às ${confirmedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
	};
}

function boletoPayment(label: string): PaymentInfo {
	return {
		kind: "boleto",
		label,
	};
}

function cardPayment(last4: string, confirmedAt: Date): PaymentInfo {
	return {
		kind: "credit_card",
		label: `Pago no cartão final ${last4}`,
		detail: `Aprovado em ${confirmedAt.toLocaleDateString("pt-BR")}`,
		cardLast4: last4,
	};
}

function findOrder(id: string) {
	const order = mockOrders.find((o) => o.id === id);
	if (!order) {
		throw new Error(`mock order ${id} not found`);
	}
	return order;
}

export const mockOrderDetails: Record<string, OrderDetail> = {
	"EMACH-2026-0428-A91C": {
		...findOrder("EMACH-2026-0428-A91C"),
		buyer: defaultBuyer,
		address: defaultAddress,
		breakdown: buildBreakdown({
			subtotalCents: 102_480,
			shippingCents: 1890,
			shippingMethod: "Sedex",
			discountCents: 1480,
			discountLabel: "Cupom OFICINA10",
		}),
		payment: pixPayment(new Date("2026-04-28T14:35:00")),
		paidAt: new Date("2026-04-28T14:35:00"),
		shippedAt: new Date("2026-04-29T09:10:00"),
		tracking: {
			carrier: "Correios",
			service: "Sedex",
			code: "BR123456789BR",
			url: "https://rastreamento.correios.com.br/app/index.php",
			updatedAt: new Date("2026-04-29T09:10:00"),
		},
	},
	"EMACH-2026-0427-D04F": {
		...findOrder("EMACH-2026-0427-D04F"),
		buyer: defaultBuyer,
		address: defaultAddress,
		breakdown: buildBreakdown({
			subtotalCents: 45_800,
			shippingCents: 0,
			shippingMethod: "Frete grátis",
		}),
		payment: boletoPayment("Aguardando pagamento (boleto)"),
	},
	"EMACH-2026-0425-3E12": {
		...findOrder("EMACH-2026-0425-3E12"),
		buyer: defaultBuyer,
		address: defaultAddress,
		breakdown: buildBreakdown({
			subtotalCents: 36_790,
			shippingCents: 1490,
			shippingMethod: "PAC",
		}),
		payment: pixPayment(new Date("2026-04-25T17:02:00")),
		paidAt: new Date("2026-04-25T17:02:00"),
	},
	"EMACH-2026-0422-7B22": {
		...findOrder("EMACH-2026-0422-7B22"),
		buyer: defaultBuyer,
		address: defaultAddress,
		breakdown: buildBreakdown({
			subtotalCents: 24_900,
			shippingCents: 0,
			shippingMethod: "Frete grátis",
		}),
		payment: cardPayment("4321", new Date("2026-04-22T11:05:00")),
		paidAt: new Date("2026-04-22T11:05:00"),
	},
	"EMACH-2026-0418-F88A": {
		...findOrder("EMACH-2026-0418-F88A"),
		buyer: defaultBuyer,
		address: defaultAddress,
		breakdown: buildBreakdown({
			subtotalCents: 71_800,
			shippingCents: 2490,
			shippingMethod: "Sedex",
		}),
		payment: pixPayment(new Date("2026-04-18T13:25:00")),
		paidAt: new Date("2026-04-18T13:25:00"),
		shippedAt: new Date("2026-04-19T10:00:00"),
		tracking: {
			carrier: "Jadlog",
			service: "Expresso",
			code: "JLG998877665BR",
			updatedAt: new Date("2026-04-19T10:00:00"),
		},
	},
	"EMACH-2026-0410-7B22": {
		...findOrder("EMACH-2026-0410-7B22"),
		buyer: defaultBuyer,
		address: defaultAddress,
		breakdown: buildBreakdown({
			subtotalCents: 18_990,
			shippingCents: 990,
			shippingMethod: "PAC",
		}),
		payment: pixPayment(new Date("2026-04-10T10:32:00")),
		paidAt: new Date("2026-04-10T10:32:00"),
		shippedAt: new Date("2026-04-11T14:00:00"),
		deliveredAt: new Date("2026-04-15T16:22:00"),
		tracking: {
			carrier: "Correios",
			service: "PAC",
			code: "BR987654321BR",
			updatedAt: new Date("2026-04-15T16:22:00"),
		},
	},
	"EMACH-2026-0205-C12B": {
		...findOrder("EMACH-2026-0205-C12B"),
		buyer: defaultBuyer,
		address: defaultAddress,
		breakdown: buildBreakdown({
			subtotalCents: 14_990,
			shippingCents: 1490,
			shippingMethod: "Sedex",
		}),
		payment: cardPayment("0001", new Date("2026-02-05T19:24:00")),
		cancelledAt: new Date("2026-02-06T08:30:00"),
	},
};

export function getOrderDetail(id: string): OrderDetail | undefined {
	const detail = mockOrderDetails[id];
	if (!detail) {
		return;
	}
	const refund = mockRefunds.find((r) => r.orderId === id);
	return refund ? { ...detail, refund } : detail;
}
