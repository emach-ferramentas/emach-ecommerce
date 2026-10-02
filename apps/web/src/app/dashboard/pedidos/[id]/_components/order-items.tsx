import type { OrderStatus } from "@emach/db/schema/orders";
import { Package } from "lucide-react";
import Image from "next/image";
import { Panel } from "@/components/panel";
import { fmtNumericBRL } from "@/lib/format";
import type { OrderDetailData } from "@/lib/orders/queries";
import { ReviewItemButton } from "./review-item-button";

type Item = OrderDetailData["items"][number];

function ItemThumb({ url, alt }: { url: string | null; alt: string }) {
	return (
		<div className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-well">
			{url ? (
				<Image
					alt={alt}
					className="size-full object-contain"
					height={72}
					src={url}
					width={72}
				/>
			) : (
				<Package
					aria-hidden="true"
					className="size-8 text-ink-muted"
					strokeWidth={1.4}
				/>
			)}
		</div>
	);
}

function metaLine(item: Item): string {
	return [item.voltage, item.model, item.manufacturerName]
		.filter(Boolean)
		.join(" · ");
}

export function OrderItems({
	items,
	orderId,
	reviewedToolIds,
	status,
}: {
	items: Item[];
	orderId: string;
	reviewedToolIds: string[];
	status: OrderStatus;
}) {
	return (
		<Panel flush title="Itens do pedido">
			<ul className="divide-y divide-line border-line border-t">
				{items.map((item) => {
					const meta = metaLine(item);
					return (
						<li
							className="flex items-center gap-4 px-5 py-4 md:px-6"
							key={item.id}
						>
							<ItemThumb alt={item.name} url={item.imageUrl} />
							<div className="min-w-0 flex-1">
								<div className="font-semibold text-[15px] text-ink leading-snug">
									{item.name}
								</div>
								{meta ? (
									<div className="mt-1 text-[13.5px] text-ink-2">{meta}</div>
								) : null}
								<div className="mt-1 text-[13px] text-ink-muted">
									{item.sku ? <span>{item.sku} · </span> : null}
									Quantidade:{" "}
									<span className="tabular-nums">{item.quantity}</span>
								</div>
							</div>
							<div className="flex min-w-[100px] flex-col items-end gap-1.5">
								<span className="font-bold text-[15px] text-ink tabular-nums">
									{fmtNumericBRL(item.lineTotal)}
								</span>
								{status === "delivered" ? (
									<ReviewItemButton
										orderId={orderId}
										productName={item.name}
										reviewed={reviewedToolIds.includes(item.toolId)}
										toolId={item.toolId}
									/>
								) : null}
							</div>
						</li>
					);
				})}
			</ul>
		</Panel>
	);
}
