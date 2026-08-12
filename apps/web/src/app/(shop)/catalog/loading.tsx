import { SiteHeader } from "@/components/site-header";
import { CatalogSkeleton } from "./_components/catalog-skeleton";

export default function Loading() {
	return (
		<>
			<SiteHeader />
			<CatalogSkeleton />
		</>
	);
}
