import {
	PRODUCT_CHIP_ROW,
	PRODUCT_GRID,
	PRODUCT_TITLE,
} from "./_lib/product-layout";

const THUMBS = [0, 1, 2, 3] as const;

export default function Loading() {
	return (
		<div className="max-md:pb-[84px]">
			<div className="shop-wrap animate-pulse">
				<div className="pt-2.5 pb-1.5 md:pt-[18px]">
					<div className="flex min-h-8 items-center">
						<div className="h-3.5 w-64 max-w-full bg-canteiro" />
					</div>
				</div>
				<div className={PRODUCT_GRID}>
					<div className="grid gap-3.5 max-md:-mx-4 md:grid-cols-[76px_minmax(0,1fr)]">
						<div className="flex flex-col gap-2.5 max-md:hidden">
							{THUMBS.map((thumb) => (
								<div
									className="size-[76px] rounded-[3px] bg-well"
									key={thumb}
								/>
							))}
						</div>
						<div className="aspect-square rounded-[5px] bg-well" />
					</div>
					<div className="min-w-0">
						<div className={PRODUCT_CHIP_ROW}>
							<div className="h-8 w-40 rounded-[3px] bg-canteiro" />
						</div>
						<div className={PRODUCT_TITLE}>
							<div className="h-[0.98em] w-11/12 bg-canteiro" />
							<div className="h-[0.98em] w-2/3 bg-canteiro" />
						</div>
						<div className="mt-2.5 h-5 w-56 bg-canteiro" />
						<div className="mt-3.5 flex gap-1.5">
							<div className="h-[30px] w-24 rounded-[3px] bg-canteiro" />
							<div className="h-[30px] w-20 rounded-[3px] bg-canteiro" />
						</div>
						<div className="mt-7">
							<div className="h-[34px] w-48 bg-canteiro md:h-10" />
							<div className="mt-2 h-6 w-64 max-w-full bg-canteiro" />
							<div className="mt-1 h-5 w-52 bg-canteiro" />
							<div className="mt-4 h-5 w-36 bg-canteiro" />
							<div className="mt-3.5 flex gap-2.5">
								<div className="h-[52px] w-32 rounded-[3px] bg-canteiro" />
								<div className="h-[52px] flex-1 rounded-[3px] bg-canteiro" />
							</div>
							<div className="mt-2.5 h-[52px] rounded-[3px] bg-canteiro" />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
