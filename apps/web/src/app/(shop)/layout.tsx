import { SiteJsonLd } from "@/components/seo/site-json-ld";
import { SiteFooter } from "@/components/site-footer";

export default function ShopLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<div className="flex min-h-screen flex-col">
			<SiteJsonLd />
			<div className="flex-1">{children}</div>
			<SiteFooter />
		</div>
	);
}
