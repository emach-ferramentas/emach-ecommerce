import { ProductCardSkeleton } from "@/components/product-card-skeleton";

const SIDEBAR_ROWS = [0, 1, 2, 3, 4] as const;
const CARD_SLOTS = [0, 1, 2, 3, 4, 5] as const;

// Skeleton fiel do catálogo, compartilhado pelos DOIS boundaries da rota:
// loading.tsx (hard nav / segurança) e o fallback do Suspense inline do
// page.tsx — sob cacheComponents é o inline que o usuário vê na soft nav
// (o shell prefetchado já inclui este fallback). Título, coluna de
// filtros de 250px e grade.
export function CatalogSkeleton() {
	return (
		<div className="shop-wrap pb-16">
			<div className="animate-pulse pt-6 md:pt-10">
				<div className="h-12 w-64 bg-canteiro-2 sm:w-80" />
				<div className="mt-3 h-4 w-32 bg-canteiro-2" />
			</div>
			<div className="mt-6 grid grid-cols-1 items-start gap-9 lg:grid-cols-[250px_minmax(0,1fr)]">
				<aside className="animate-pulse space-y-4 max-lg:hidden">
					{SIDEBAR_ROWS.map((row) => (
						<div className="h-5 w-full bg-canteiro-2" key={row} />
					))}
				</aside>
				<div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 lg:grid-cols-2 xl:grid-cols-3">
					{CARD_SLOTS.map((slot) => (
						<ProductCardSkeleton key={slot} />
					))}
				</div>
			</div>
		</div>
	);
}
