import type { ReactNode } from "react";

export const PAGE_TITLE_CLASS =
	"font-display font-extrabold text-[clamp(2.4rem,1.6rem+2.2vw,3.6rem)] uppercase leading-[0.92]";

interface PageHeadProps {
	aside?: ReactNode;
	children?: ReactNode;
	title: string;
}

export function PageHead({ aside, children, title }: PageHeadProps) {
	return (
		<header>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4 pt-6 md:pt-10">
				<div className="min-w-0">
					<h1 className={PAGE_TITLE_CLASS}>{title}</h1>
					{children ? (
						<div className="mt-2 text-[15.5px] text-ink-2">{children}</div>
					) : null}
				</div>
				{aside ? <div className="shrink-0">{aside}</div> : null}
			</div>
		</header>
	);
}
