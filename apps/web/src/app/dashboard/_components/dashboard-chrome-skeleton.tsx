import { NAV_ITEMS } from "./nav-items";

// Fallback do Suspense da guarda (cacheComponents): renderiza enquanto a sessão
// é validada e a página é montada. Espelha a ESTRUTURA real do chrome (sidebar
// + hero + corpo) pra que, vindo da home escura, a entrada caia num frame
// "mobiliado" — e não num vazão claro vazio que lê como "pisca branca" antes do
// layout carregar. Para o não-autenticado é só isto que renderiza antes do
// redirect — nunca dados sensíveis (avatar/nome/email são placeholders; os
// labels de nav são estáticos, não dependem de sessão).
export function DashboardChromeSkeleton() {
	return (
		<main className="grid h-[calc(100vh-3.5rem)] w-full grid-cols-1 md:grid-cols-[260px_1fr]">
			<aside className="hidden h-full flex-col border-black border-r-2 bg-near-black pt-8 text-white md:flex">
				<div className="flex items-center gap-3 border-white/10 border-b px-[22px] pb-[22px]">
					<div className="size-[42px] shrink-0 rounded-[2px] bg-white/10" />
					<div className="min-w-0 flex-1 space-y-2">
						<div className="h-3.5 w-28 rounded-[2px] bg-white/10" />
						<div className="h-2.5 w-36 max-w-full rounded-[2px] bg-white/[0.06]" />
					</div>
				</div>
				<nav aria-hidden className="flex flex-1 flex-col">
					{NAV_ITEMS.map((item) => (
						<span
							className="block border-transparent border-l-[3px] px-[22px] py-3 font-semibold text-[13px] text-gray-50 tracking-[0.04em]"
							key={item.label}
						>
							{item.label}
						</span>
					))}
				</nav>
			</aside>

			<div className="flex min-w-0 flex-col overflow-y-auto">
				{/* Faixa escura comum a todas as páginas (AccountHero/ProfileHeader:
				    bg-near-black + borda vermelha, mesmas medidas) — entrada
				    escuro→escuro no topo, sem pop nem CLS. */}
				<div className="border-emach-red border-b-[3px] bg-near-black px-6 py-8 md:px-10">
					<div className="h-4 w-24 rounded-[2px] bg-white/10" />
					<div className="mt-2 h-10 w-56 max-w-full rounded-[2px] bg-white/10" />
				</div>
				{/* Corpo: placeholders no idioma de card do sistema (bg-gray-10 +
				    hairline border-border) pra a superfície clara não aparecer
				    vazia. Genérico de propósito (o skeleton é compartilhado por
				    todas as /dashboard/*). */}
				<div className="space-y-8 px-6 py-8 md:px-10">
					<div className="h-3 w-28 rounded-[2px] bg-black/[0.06]" />
					<div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
						<div className="h-32 rounded-[2px] border border-border bg-gray-10" />
						<div className="h-32 rounded-[2px] border border-border bg-gray-10" />
						<div className="h-32 rounded-[2px] border border-border bg-gray-10" />
					</div>
				</div>
			</div>
		</main>
	);
}
