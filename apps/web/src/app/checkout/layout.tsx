import { Info } from "lucide-react";
import type { Metadata } from "next";

import { CheckoutFooter } from "@/components/checkout-footer";
import { CheckoutHeader } from "@/components/checkout-header";

export const metadata: Metadata = {
	robots: { index: false, follow: false },
};

export default function CheckoutLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className="flex min-h-screen flex-col bg-paper">
			<CheckoutHeader />
			<div className="border-line border-b bg-canteiro">
				<p className="shop-wrap flex items-center gap-2 py-2.5 text-[14px] text-ink-2">
					<Info aria-hidden="true" className="size-4 shrink-0" />
					Ambiente de demonstração: nenhum pagamento é cobrado.
				</p>
			</div>
			<main className="flex-1" id="main-content">
				{children}
			</main>
			<CheckoutFooter />
		</div>
	);
}
