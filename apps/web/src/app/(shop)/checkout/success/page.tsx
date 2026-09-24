import { CircleCheckBig } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { EmachLinkButton } from "@/components/emach-button";
import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
	title: "Pedido confirmado",
	description: "Recebemos seu pedido e ele já está em processamento.",
	robots: { index: false, follow: false },
};

interface SuccessPageProps {
	searchParams: Promise<{ order?: string }>;
}

export default function CheckoutSuccessPage({
	searchParams,
}: SuccessPageProps) {
	return (
		<>
			<SiteHeader />
			<PageContainer
				as="main"
				className="flex flex-col items-center py-28 text-center"
				id="main-content"
			>
				<div className="flex size-[72px] items-center justify-center rounded-full bg-success/10">
					<CircleCheckBig className="text-success-text" size={32} />
				</div>
				<div className="mt-6 font-display font-semibold text-[11px] text-emach-red uppercase tracking-[0.14em]">
					Pedido confirmado
				</div>
				<h1 className="mt-3 font-display font-medium text-[clamp(36px,5vw,56px)] text-near-black leading-tight tracking-[-0.01em]">
					Obrigado pela compra.
				</h1>
				<p className="mt-5 max-w-[440px] text-[15px] text-gray-60 leading-[1.6]">
					Enviamos a confirmação por e-mail com todos os detalhes da entrega e
					nota fiscal. Você pode acompanhar o status pelo seu painel.
				</p>
				{/* Só o número do pedido depende de searchParams — buraco dinâmico
				    mínimo sob Suspense; o resto da página é shell estático. */}
				<Suspense fallback={null}>
					<OrderNumber searchParams={searchParams} />
				</Suspense>
				<div className="mt-8 flex gap-3">
					<EmachLinkButton href="/catalog" size="lg" variant="primary">
						Continuar comprando
					</EmachLinkButton>
					<EmachLinkButton href="/" size="lg" variant="outline">
						Página inicial
					</EmachLinkButton>
				</div>
			</PageContainer>
		</>
	);
}

async function OrderNumber({ searchParams }: SuccessPageProps) {
	const { order } = await searchParams;
	if (!order) {
		return null;
	}
	return (
		<div className="mt-6 font-display text-[13px] text-near-black uppercase tracking-[0.14em]">
			Pedido #{order}
		</div>
	);
}
