// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CheckoutContent } from "./checkout-content";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/app/checkout/_actions/create-order", () => ({
	createOrderAction: vi.fn(),
}));
vi.mock("@/app/checkout/_actions/quote-shipping", () => ({
	quoteShippingAction: vi.fn(),
}));
vi.mock("@/app/checkout/_actions/revalidate-cart", () => ({
	revalidateCartAction: vi.fn(),
}));
vi.mock("@/app/checkout/_actions/apply-coupon", () => ({
	applyCouponAction: vi.fn(),
}));
vi.mock("@/lib/actions/lookup-cep", () => ({ lookupCepAction: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));

const FORM_ID = /<form\b[^>]*\bid="([^"]+)"/g;
const SUBMIT_BUTTON =
	/<button\b[^>]*\btype="submit"[^>]*>[^<]*Confirmar pedido/;
const FORM_ATTR = /\bform="([^"]+)"/;

function renderCheckout() {
	return renderToStaticMarkup(
		<CheckoutContent
			addresses={[]}
			clientDocument={null}
			clientEmail="maria@example.com"
			clientName="Maria da Silva"
			clientPhone=""
			emailVerified
		/>
	);
}

describe("CheckoutContent", () => {
	it("liga o botão Confirmar pedido ao form do checkout pelo atributo form", () => {
		const html = renderCheckout();
		const formIds = [...html.matchAll(FORM_ID)].map((m) => m[1]);
		const button = html.match(SUBMIT_BUTTON)?.[0];

		expect(button).toBeDefined();
		const target = button?.match(FORM_ATTR)?.[1];
		expect(target).toBeDefined();
		expect(formIds).toContain(target);
	});
});
