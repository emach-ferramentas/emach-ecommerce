import { SiteJsonLd } from "@/components/seo/site-json-ld";
import { StoreFrame } from "@/components/store-frame";

export default function ShopLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<StoreFrame>
			<SiteJsonLd />
			{children}
		</StoreFrame>
	);
}
