import { PAGE_TITLE_CLASS } from "@/components/page-head";

export default function Loading() {
	return (
		<div className="shop-wrap animate-pulse pb-16">
			<div className="pt-2.5 pb-1.5 md:pt-[18px]">
				<div className="h-5 w-32 rounded-[3px] bg-canteiro" />
			</div>
			<div className="mt-0.5 mb-6 md:mt-2">
				<h1 className={`${PAGE_TITLE_CLASS} text-ink-muted`}>Seu carrinho</h1>
			</div>
			<div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
				<div>
					{["a", "b"].map((key) => (
						<div
							className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3.5 gap-y-2 border-line border-b py-4 md:grid-cols-[96px_minmax(0,1fr)]"
							key={key}
						>
							<div className="row-span-2 size-[72px] rounded-[3px] bg-well md:size-24" />
							<div className="space-y-2">
								<div className="h-4 w-60 max-w-full rounded-[3px] bg-canteiro" />
								<div className="h-3.5 w-72 max-w-full rounded-[3px] bg-canteiro" />
							</div>
							<div className="col-start-2 h-11 w-32 rounded-[3px] bg-canteiro" />
						</div>
					))}
				</div>
				<div className="h-[290px] rounded-[5px] border border-line bg-canteiro" />
			</div>
		</div>
	);
}
