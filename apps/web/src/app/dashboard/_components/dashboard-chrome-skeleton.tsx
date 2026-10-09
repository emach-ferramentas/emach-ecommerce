import { AccountSectionSkeleton } from "./account-section-skeleton";
import { ACCOUNT_GRID_CLASS } from "./dashboard-chrome";
import { NAV_ITEMS } from "./nav-items";

export function DashboardChromeSkeleton() {
	return (
		<div aria-busy="true" className={ACCOUNT_GRID_CLASS}>
			<div className="-mx-4 flex overflow-hidden border-line border-b px-4 md:hidden">
				{NAV_ITEMS.map((item) => (
					<span
						className="inline-flex min-h-12 shrink-0 items-center whitespace-nowrap px-3 text-[15px] text-ink-muted"
						key={item.href}
					>
						{item.label}
					</span>
				))}
			</div>

			<div className="hidden md:block md:self-start md:pt-10">
				<div className="space-y-2 border-line border-b pb-4">
					<div className="h-4 w-32 rounded-[3px] bg-canteiro" />
					<div className="h-3.5 w-44 max-w-full rounded-[3px] bg-canteiro" />
				</div>
				{NAV_ITEMS.map((item) => (
					<span
						className="flex min-h-12 items-center border-line border-b px-3 text-[15px] text-ink-muted"
						key={item.href}
					>
						{item.label}
					</span>
				))}
			</div>

			<div className="min-w-0 pt-6 md:pt-10">
				<div className="mb-6 h-12 w-64 max-w-full rounded-[3px] bg-canteiro" />
				<AccountSectionSkeleton />
			</div>
		</div>
	);
}
