import type { ReactNode } from "react";
import { PageHead } from "@/components/page-head";

export function AuthColumn({
	children,
	lede,
	title,
}: {
	children?: ReactNode;
	lede: ReactNode;
	title: string;
}) {
	return (
		<div className="shop-wrap pb-16 md:pb-24">
			<div className="mx-auto w-full max-w-[440px]">
				<PageHead title={title}>{lede}</PageHead>
				{children}
			</div>
		</div>
	);
}
