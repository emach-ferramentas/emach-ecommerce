import { EmachLinkButton } from "@/components/emach-button";
import { PageContainer } from "@/components/page-container";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
	return (
		<>
			<SiteHeader />
			<PageContainer
				as="main"
				className="flex flex-col items-center py-32 text-center"
				id="main-content"
			>
				<div className="font-display font-semibold text-[11px] text-emach-red uppercase tracking-[0.14em]">
					Erro 404
				</div>
				<h1 className="mt-4 font-display font-medium text-[clamp(48px,7vw,96px)] text-near-black leading-none tracking-[-0.01em]">
					Página não encontrada.
				</h1>
				<p className="mt-6 max-w-[440px] text-[15px] text-gray-60 leading-[1.6]">
					Essa página pode ter sido movida, renomeada ou ainda está na oficina.
					Volte ao catálogo para seguir explorando.
				</p>
				<div className="mt-8 flex gap-3">
					<EmachLinkButton href="/" size="lg" variant="primary">
						Página inicial
					</EmachLinkButton>
					<EmachLinkButton href="/catalog" size="lg" variant="outline">
						Ver catálogo
					</EmachLinkButton>
				</div>
			</PageContainer>
			<SiteFooter />
		</>
	);
}
