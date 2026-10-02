import type { Metadata } from "next";
import { Suspense } from "react";
import { StoreFrame } from "@/components/store-frame";
import { DashboardChrome } from "./_components/dashboard-chrome";
import { DashboardChromeSkeleton } from "./_components/dashboard-chrome-skeleton";

export const metadata: Metadata = {
	title: "Minha conta",
	robots: { index: false, follow: false },
};

// A guarda P0 (#98) vive em DashboardChrome (chama `requireCurrentClient`),
// sob Suspense por exigência do cacheComponents. Toda página em /dashboard
// herda a proteção por renderizar dentro do chrome.
export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<StoreFrame>
			<Suspense fallback={<DashboardChromeSkeleton />}>
				<DashboardChrome>{children}</DashboardChrome>
			</Suspense>
		</StoreFrame>
	);
}
