import { PageContainer } from "@/components/page-container";
import { ProductCardSkeleton } from "@/components/product-card-skeleton";

const SIDEBAR_ROWS = [0, 1, 2, 3, 4] as const;
const CARD_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

// Skeleton fiel do catálogo, compartilhado pelos DOIS boundaries da rota:
// loading.tsx (hard nav / segurança) e o fallback do Suspense inline do
// page.tsx — sob cacheComponents é o inline que o usuário vê na soft nav
// (o shell prefetchado já inclui este fallback). Um esqueleto só, sem
// divergir do layout real: hero escuro, sidebar 260px, toolbar e grid de
// cards escuros. SiteHeader fica por conta do caller (page/loading).
export function CatalogSkeleton() {
	return (
		<>
			<section className="bg-near-black py-12">
				<PageContainer className="animate-pulse">
					<div className="mb-3 h-3 w-40 bg-white/10" />
					<div className="h-10 w-64 bg-white/15 sm:w-80" />
				</PageContainer>
			</section>
			<PageContainer className="grid grid-cols-1 gap-0 py-8 lg:grid-cols-[260px_1fr] lg:gap-10">
				<aside className="hidden animate-pulse space-y-4 lg:block">
					<div className="h-3 w-24 bg-gray-20" />
					{SIDEBAR_ROWS.map((row) => (
						<div className="h-4 w-full bg-gray-20" key={row} />
					))}
				</aside>
				<div>
					<div className="mb-6 flex animate-pulse items-center justify-between">
						<div className="h-4 w-28 bg-gray-20" />
						<div className="h-10 w-44 bg-gray-20" />
					</div>
					<div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
						{CARD_SLOTS.map((slot) => (
							<ProductCardSkeleton key={slot} />
						))}
					</div>
				</div>
			</PageContainer>
		</>
	);
}
