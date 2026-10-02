import type { ToolListItem } from "@emach/db/queries/tools";
import { cn } from "@emach/ui/lib/utils";
import { cacheLife } from "next/cache";
import Image from "next/image";
import Link from "next/link";

import { CardActionButton } from "@/components/product-card-actions";
import {
	cardAction,
	listItemSnapshot,
	voltageSummary,
} from "@/lib/card-action";
import { getCardExtras } from "@/lib/card-data";
import { fmtBRL } from "@/lib/format";
import { installmentText } from "@/lib/installments";
import { listPriceCents, sortInStockFirst } from "@/lib/list-price";
import { getServices, type ToolService } from "@/lib/services";
import { PRODUCT_COPY } from "../_lib/product-copy";

const KIT_LIMIT = 6;

interface ServiceKitProps {
	services: ToolService[];
	toolId: string;
}

// Lista do kit em cache, na mesma janela dos ofícios: o shell da página de
// produto é prerenderizado e não pode ler o banco fora de cache.
async function getServiceKit(serviceSlugs: string[], toolId: string) {
	"use cache";
	cacheLife({ revalidate: 600 });

	const slugs = new Set(serviceSlugs);
	const summaries = (await getServices()).filter((s) => slugs.has(s.slug));
	const seen = new Set([toolId]);
	const items: ToolListItem[] = [];
	for (const summary of summaries) {
		for (const tool of summary.preview) {
			if (!seen.has(tool.id)) {
				seen.add(tool.id);
				items.push(tool);
			}
		}
	}
	const kit = sortInStockFirst(items).slice(0, KIT_LIMIT);
	const photo = summaries.find((s) => s.imageSrc) ?? null;
	return {
		extras: await getCardExtras(kit.map((t) => t.id)),
		kit,
		photo: photo && {
			href: photo.href,
			imageSrc: photo.imageSrc,
			name: photo.name,
		},
	};
}

/** "Para esse serviço você também precisa": outros produtos dos mesmos ofícios. */
export async function ServiceKit({ services, toolId }: ServiceKitProps) {
	if (services.length === 0) {
		return null;
	}
	const { extras, kit, photo } = await getServiceKit(
		services.map((s) => s.slug),
		toolId
	);
	if (kit.length === 0) {
		return null;
	}

	return (
		<section
			aria-labelledby="kit-titulo"
			className="border-line border-y bg-canteiro py-8 md:py-11"
		>
			<div className="shop-wrap grid items-start gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-12">
				<div>
					<h2
						className="font-display font-extrabold text-[clamp(1.9rem,1.3rem+1.6vw,2.75rem)] uppercase leading-[0.98]"
						id="kit-titulo"
					>
						{PRODUCT_COPY.kitTitle}
					</h2>
					<p className="mt-2.5 max-w-[40ch] text-[15.5px] text-ink-2">
						{PRODUCT_COPY.kitLead}
					</p>
					{photo?.imageSrc && (
						<Link
							className="relative mt-5 block aspect-[4/3] overflow-hidden rounded-[5px] bg-grafite max-lg:hidden"
							href={photo.href}
						>
							<Image
								alt={photo.name}
								className="object-cover"
								fill
								sizes="(min-width: 1296px) 400px, 30vw"
								src={photo.imageSrc}
							/>
						</Link>
					)}
				</div>
				<ul className="overflow-hidden rounded-[5px] border border-line bg-paper">
					{kit.map((tool) => {
						const price = listPriceCents(tool);
						const toolExtras = extras[tool.id] ?? { specs: [], voltages: [] };
						const volt = voltageSummary(toolExtras.voltages);
						const detail = [...toolExtras.specs, ...(volt ? [volt] : [])];
						return (
							<li
								className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1 border-line border-b p-3 last:border-b-0 md:grid-cols-[64px_minmax(0,1fr)_auto_minmax(0,190px)] md:gap-x-3.5 md:px-[18px]"
								key={tool.id}
							>
								<span className="relative row-span-3 size-[52px] overflow-hidden rounded-[3px] bg-well md:row-span-1 md:size-16">
									{tool.primaryImage && (
										<Image
											alt=""
											className={cn(
												"object-contain p-1 mix-blend-multiply",
												!tool.inStock && "opacity-50 grayscale"
											)}
											fill
											sizes="64px"
											src={tool.primaryImage.url}
										/>
									)}
								</span>
								<div className="min-w-0">
									<h3 className="font-bold text-[15px] leading-snug">
										<Link
											className="text-ink no-underline hover:underline"
											href={`/product/${tool.slug}`}
										>
											{tool.name}
										</Link>
									</h3>
									{detail.length > 0 && (
										<p className="mt-0.5 text-[13.5px] text-ink-muted tabular-nums">
											{detail.join(" · ")}
										</p>
									)}
								</div>
								<p className="whitespace-nowrap font-extrabold text-[16.5px] tabular-nums md:text-right">
									{tool.inStock && price !== null ? fmtBRL(price) : "Esgotado"}
									{tool.inStock && price !== null && (
										<small className="block font-semibold text-[12.5px] text-ink-muted">
											{installmentText(price)}
										</small>
									)}
								</p>
								<div className="max-md:col-start-2 [&>*]:mt-0">
									<CardActionButton
										action={cardAction(tool, toolExtras.voltages)}
										item={listItemSnapshot(tool)}
										name={tool.name}
										slug={tool.slug}
									/>
								</div>
							</li>
						);
					})}
				</ul>
			</div>
		</section>
	);
}
