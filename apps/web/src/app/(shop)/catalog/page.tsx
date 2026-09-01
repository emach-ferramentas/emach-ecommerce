import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { canonicalFor } from "@/lib/seo/canonical";
import { CatalogResults } from "./_components/catalog-results";
import { CatalogSkeleton } from "./_components/catalog-skeleton";
import type { CatalogSearchParams } from "./_lib/parse-search-params";

interface CatalogPageProps {
	searchParams: Promise<CatalogSearchParams>;
}

// Metadata estática: sob cacheComponents, ler searchParams em generateMetadata
// bloquearia o prerender do shell. Categoria tem rota própria (/catalog/[cat])
// com metadata dinâmica; aqui ficam só busca e filtros por query.
export const metadata: Metadata = {
	title: "Catálogo",
	description:
		"Todas as ferramentas da EMACH: elétricas, manuais, medição e EPIs. Filtre por categoria, voltagem e preço.",
	alternates: canonicalFor("/catalog"),
};

export default function CatalogPage({ searchParams }: CatalogPageProps) {
	return (
		<>
			<SiteHeader />
			<Suspense fallback={<CatalogSkeleton />}>
				{/* `?cat=` legado é redirecionado no proxy (308); aqui é ignorado
				    de propósito pra nunca servir conteúdo duplicado. */}
				<CatalogResults searchParams={searchParams} />
			</Suspense>
		</>
	);
}
