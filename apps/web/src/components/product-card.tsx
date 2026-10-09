import type { ToolListItem } from "@emach/db/queries/tools";
import { cn } from "@emach/ui/lib/utils";
import { Wrench } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";

import {
	CardActionButton,
	QuickViewButton,
} from "@/components/product-card-actions";
import { StockLine } from "@/components/stock-line";
import {
	cardAction,
	listItemSnapshot,
	voltageSummary,
} from "@/lib/card-action";
import type { CardExtras } from "@/lib/card-data";
import { fmtBRL, fmtNumericBRL } from "@/lib/format";
import { installmentText } from "@/lib/installments";
import { listPriceCents } from "@/lib/list-price";

interface ProductCardProps {
	extras?: CardExtras;
	/** Nível do título: 3 dentro de seção com h2, 4 dentro de prateleira com h3. */
	headingLevel?: 2 | 3 | 4;
	/** Primeira dobra: a foto carrega com prioridade. */
	priority?: boolean;
	/** Grade densa (2 colunas no celular) encolhe textos e respiros. */
	size?: "default" | "compact";
	tool: ToolListItem;
}

const NO_EXTRAS: CardExtras = { specs: [], voltages: [] };

/**
 * Card de produto do redesign H3: foto grande em fundo neutro com "Ver rápido",
 * estoque, nome, chips curtos, preço com parcelas e o botão que muda conforme o
 * produto (adicionar, escolher voltagem ou avisar quando chegar).
 */
export function ProductCard({
	extras = NO_EXTRAS,
	headingLevel = 3,
	priority = false,
	size = "default",
	tool,
}: ProductCardProps) {
	const Heading = `h${headingLevel}` as const;
	const href = `/product/${tool.slug}` as Route;
	const priceCents = listPriceCents(tool);
	const hasDiscount =
		tool.defaultVariant.discountedAmount != null &&
		priceCents !== null &&
		Number(tool.defaultVariant.priceAmount) * 100 > priceCents;
	const voltageText = voltageSummary(extras.voltages);
	const specs = [...extras.specs, ...(voltageText ? [voltageText] : [])];
	const compact = size === "compact";

	return (
		<article className="group relative flex min-w-0 flex-col overflow-hidden rounded-[5px] border border-line bg-paper transition-colors duration-150 ease-out hover:border-line-strong">
			<div className="relative aspect-square bg-well">
				<Link
					aria-hidden="true"
					className="absolute inset-0 block"
					href={href}
					tabIndex={-1}
				>
					{tool.primaryImage ? (
						<Image
							alt=""
							className={cn(
								"object-contain mix-blend-multiply transition-transform duration-500 ease-out-expo group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
								compact ? "p-3 sm:p-5" : "p-5",
								!tool.inStock && "opacity-50 grayscale"
							)}
							fill
							priority={priority}
							sizes="(min-width: 1296px) 300px, (min-width: 768px) 33vw, 50vw"
							src={tool.primaryImage.url}
						/>
					) : (
						<span className="grid size-full place-items-center text-ink-muted">
							<Wrench
								aria-hidden="true"
								className="size-1/3"
								strokeWidth={1.2}
							/>
						</span>
					)}
				</Link>
				<QuickViewButton name={tool.name} slug={tool.slug} />
			</div>

			<div
				className={cn(
					"flex flex-1 flex-col",
					compact
						? "gap-[5px] p-2.5 pb-3 sm:gap-1.5 sm:p-4 sm:pb-[18px]"
						: "gap-1.5 p-4 pb-[18px]"
				)}
			>
				<StockLine inStock={tool.inStock} />
				<Heading
					className={cn(
						"line-clamp-3 min-h-[calc(1.35em*3)] font-semibold leading-[1.35]",
						compact ? "text-[14px] sm:text-[16px]" : "text-[16px]"
					)}
				>
					<Link className="text-ink no-underline hover:underline" href={href}>
						{tool.name}
					</Link>
				</Heading>
				{specs.length > 0 && (
					<p
						className={cn(
							"text-ink-muted tabular-nums",
							compact ? "text-[12.5px] sm:text-[13.5px]" : "text-[13.5px]"
						)}
					>
						{specs.join(" · ")}
					</p>
				)}
				<div className="mt-auto pt-2">
					{priceCents === null ? (
						<p className="font-bold text-[15px] text-ink-muted">
							Preço sob consulta
						</p>
					) : (
						<>
							<p className="flex flex-wrap items-baseline gap-x-2">
								<span
									className={cn(
										"font-extrabold text-ink tabular-nums leading-[1.05] tracking-[-0.01em]",
										compact ? "text-[20px] sm:text-[27px]" : "text-[27px]"
									)}
								>
									{fmtBRL(priceCents)}
								</span>
								{hasDiscount && (
									<span className="text-[13px] text-ink-muted tabular-nums line-through">
										<span className="sr-only">Antes </span>
										{fmtNumericBRL(tool.defaultVariant.priceAmount)}
									</span>
								)}
							</p>
							<p
								className={cn(
									"mt-1 min-h-[1.4em] text-ink-2 tabular-nums",
									compact ? "text-[12.5px] sm:text-[14px]" : "text-[14px]"
								)}
							>
								{installmentText(priceCents)}
							</p>
						</>
					)}
				</div>
				<CardActionButton
					action={cardAction(tool, extras.voltages)}
					item={listItemSnapshot(tool)}
					name={tool.name}
					slug={tool.slug}
				/>
			</div>
		</article>
	);
}
