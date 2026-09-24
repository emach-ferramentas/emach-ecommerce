import { AlertTriangle } from "lucide-react";
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
		<div className="flex min-h-screen flex-col">
			<CheckoutHeader />
			<DemoBanner />
			<main className="flex-1" id="main-content">
				{children}
			</main>
			<CheckoutFooter />
		</div>
	);
}

function DemoBanner() {
	return (
		<div className="bg-near-black px-4 py-3 text-white sm:px-6 lg:px-10">
			<div className="mx-auto flex max-w-5xl items-center gap-3">
				<AlertTriangle
					aria-hidden="true"
					className="size-4 shrink-0 text-amber-400"
				/>
				<div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<span className="font-display text-[11px] uppercase tracking-[0.16em]">
						Ambiente de demonstração · Pagamento não integrado
					</span>
					<span className="text-[12px] text-white/60">
						Nenhuma cobrança real será realizada
					</span>
				</div>
			</div>
		</div>
	);
}
