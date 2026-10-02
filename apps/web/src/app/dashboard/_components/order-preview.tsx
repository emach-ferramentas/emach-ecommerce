import { Package } from "lucide-react";
import Image from "next/image";
import { fmtNumericBRL } from "@/lib/format";
import type { OrderPreviewItem } from "@/lib/orders/queries";

export function MetaPair({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col">
			<span className="text-[13px] text-ink-muted">{label}</span>
			<span className="font-bold text-[15px] text-ink tabular-nums">
				{value}
			</span>
		</div>
	);
}

export function PreviewItems({
	items,
}: {
	items: readonly OrderPreviewItem[];
}) {
	return (
		<ul className="divide-y divide-line">
			{items.map((item) => (
				<li className="flex items-center gap-4 px-5 py-4" key={item.id}>
					<ItemThumb alt={item.name} url={item.imageUrl} />
					<div className="min-w-0 flex-1">
						<div className="line-clamp-2 font-semibold text-[15px] text-ink leading-snug">
							{item.name}
						</div>
						<div className="mt-1 text-[13.5px] text-ink-muted">
							{[item.voltage, `Qtd: ${item.quantity}`]
								.filter(Boolean)
								.join(" · ")}
						</div>
					</div>
					<div className="shrink-0 text-right font-bold text-[15px] text-ink tabular-nums">
						{fmtNumericBRL(item.unitPrice)}
					</div>
				</li>
			))}
		</ul>
	);
}

function ItemThumb({ url, alt }: { url: string | null; alt: string }) {
	return (
		<div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-well">
			{url ? (
				<Image
					alt={alt}
					className="object-contain p-1.5 mix-blend-multiply"
					fill
					sizes="64px"
					src={url}
				/>
			) : (
				<Package
					aria-hidden="true"
					className="size-7 text-ink-muted"
					strokeWidth={1.4}
				/>
			)}
		</div>
	);
}
