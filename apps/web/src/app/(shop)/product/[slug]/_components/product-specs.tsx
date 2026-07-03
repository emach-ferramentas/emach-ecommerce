// apps/web/src/app/(shop)/product/[slug]/_components/product-specs.tsx
import type { ToolDetail } from "@emach/db/queries/tools";
import { cn } from "@emach/ui/lib/utils";
import type { ReactNode } from "react";
import { SectionLabel } from "@/components/section-label";
import { fmtSpecNumber, fmtSpecRange } from "@/lib/format";
import { buildPlateLayout, type PlateAnchorCell } from "./plate-layout";
import { PlateMedia } from "./plate-media";

interface ProductSpecsProps {
	attributes: ToolDetail["attributes"];
	categoryName?: string | null;
	images: ToolDetail["images"];
	tool: ToolDetail["tool"];
	video: { url: string; poster: string | null } | null;
}

type Attr = ToolDetail["attributes"][number];

// Separa "650 W" → número grande + unidade menor. Valores sem unidade
// numérica ("até 2.800 RPM", "Sim") caem no else e renderizam inteiros.
const HERO_VALUE = /^([\d.,]+)\s*(\S.*)$/;

function fmtAttr(item: Attr): string {
	const { definition, value } = item;
	const unit = definition.unit ?? "";
	switch (definition.inputType) {
		case "boolean": {
			if (value.valueBool == null) {
				return "—";
			}
			return value.valueBool ? "Sim" : "Não";
		}
		case "numeric_range":
			return fmtSpecRange(value.valueNumeric, value.valueNumericMax, unit);
		case "number":
			return fmtSpecNumber(value.valueNumeric, unit);
		case "select": {
			// Opções de select podem ter unidade ("Diâmetro do disco: 185" + mm).
			if (!value.valueText) {
				return "—";
			}
			return unit ? `${value.valueText} ${unit}` : value.valueText;
		}
		default:
			return value.valueText ?? "—";
	}
}

function SpecLabel({ children }: { children: ReactNode }) {
	return (
		<dt className="font-display font-semibold text-[10.5px] text-gray-60 uppercase tracking-[0.12em]">
			{children}
		</dt>
	);
}

function specValueNode(attr: Attr): ReactNode {
	const formatted = fmtAttr(attr);
	const numeric =
		attr.definition.inputType === "number" ||
		attr.definition.inputType === "numeric_range";
	const match = numeric ? HERO_VALUE.exec(formatted) : null;

	if (match) {
		return (
			<span className="font-bold font-display text-[30px] tabular-nums leading-none sm:text-[36px]">
				{match[1]}
				<span className="ml-1 font-semibold text-[14px] text-gray-60 sm:text-[16px]">
					{match[2]}
				</span>
			</span>
		);
	}
	return (
		<span
			className={cn(
				"font-semibold leading-tight",
				numeric ? "font-display text-[22px]" : "text-[16px]"
			)}
		>
			{formatted}
		</span>
	);
}

/** Célula padrão (label em cima, valor embaixo) ou larga (sobra 1: horizontal). */
function SpecCell({
	attr,
	className,
	wide = false,
}: {
	attr: Attr;
	className?: string;
	wide?: boolean;
}) {
	if (wide) {
		return (
			<dl
				className={cn(
					"flex items-baseline justify-between gap-4 px-4 py-3.5 sm:px-5",
					className
				)}
			>
				<SpecLabel>{attr.definition.label}</SpecLabel>
				<dd>{specValueNode(attr)}</dd>
			</dl>
		);
	}
	return (
		<dl className={cn("px-4 py-3.5 sm:px-5 sm:py-4", className)}>
			<SpecLabel>{attr.definition.label}</SpecLabel>
			<dd className="mt-2">{specValueNode(attr)}</dd>
		</dl>
	);
}

/** Índice da primeira célula da última "linha" da zona da âncora, por k. */
function anchorLastRowStart(k: number): number {
	if (k <= 1) {
		return 0;
	}
	if (k <= 3) {
		return 1;
	}
	return 2;
}

const LEFTOVER_COLS: Record<number, string> = {
	2: "grid-cols-2",
	3: "grid-cols-3",
};

export function ProductSpecs({
	attributes,
	categoryName,
	images,
	tool,
	video,
}: ProductSpecsProps) {
	const sorted = [...attributes].sort((a, b) => a.sortOrder - b.sortOrder);
	const n = sorted.length;
	const mediaImage = images[1] ?? null;
	const hasMedia = Boolean(video || mediaImage);

	if (n === 0 && !hasMedia && !tool.description) {
		return null;
	}

	const desktop = buildPlateLayout(n, hasMedia, 4);
	const mobile = buildPlateLayout(n, false, 2);

	const renderLeftover = (row: number[]) => {
		if (row.length === 0) {
			return null;
		}
		if (row.length === 1) {
			return <SpecCell attr={sorted[row[0]]} wide />;
		}
		return (
			<div
				className={cn("grid divide-x divide-border", LEFTOVER_COLS[row.length])}
			>
				{row.map((i) => (
					<SpecCell attr={sorted[i]} key={sorted[i].definition.id} />
				))}
			</div>
		);
	};

	const anchorCellClass = (
		cell: PlateAnchorCell,
		index: number,
		cells: PlateAnchorCell[]
	) =>
		cn(
			"border-border border-r",
			cell.colSpan === 2 && "col-span-2",
			cell.rowSpan === 2 && "row-span-2",
			index < anchorLastRowStart(cells.length) && "border-border border-b"
		);

	return (
		<section aria-label="Ficha técnica do produto" className="py-14">
			{/* Largura alinhada ao topo (galeria w-1/2 + buy box w-[480px],
			    centrados) — replica 50vw + 480px, com teto p/ telas estreitas. */}
			<div className="mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)]">
				<div className="mb-5 flex items-baseline justify-between gap-6">
					<SectionLabel tone="accent">Ficha técnica</SectionLabel>
					{categoryName && (
						<span className="font-display font-semibold text-[11.5px] text-gray-60 uppercase tracking-[0.1em]">
							{categoryName}
						</span>
					)}
				</div>

				{tool.description && (
					<p className="mb-7 max-w-[70ch] text-[15px] text-near-black/80 leading-relaxed">
						{tool.description}
					</p>
				)}

				{n === 0 ? (
					hasMedia && (
						<div className="relative aspect-video max-w-[560px] border border-border">
							<PlateMedia image={mediaImage} name={tool.name} video={video} />
						</div>
					)
				) : (
					<>
						{/* Desktop: placa 4 colunas (âncora de mídia quando houver) */}
						<div className="hidden divide-y divide-border border border-border lg:block">
							{desktop.anchor && (
								<div className="grid auto-rows-fr grid-cols-4">
									{desktop.anchor.cells.map((cell, i, cells) => (
										<SpecCell
											attr={sorted[cell.specIndex]}
											className={anchorCellClass(cell, i, cells)}
											key={sorted[cell.specIndex].definition.id}
										/>
									))}
									<div className="col-span-2 col-start-3 row-span-2 row-start-1 min-h-[220px]">
										<PlateMedia
											image={mediaImage}
											name={tool.name}
											video={video}
										/>
									</div>
								</div>
							)}
							{desktop.fullRows.map((row) => (
								<div
									className="grid grid-cols-4 divide-x divide-border"
									key={sorted[row[0]].definition.id}
								>
									{row.map((i) => (
										<SpecCell attr={sorted[i]} key={sorted[i].definition.id} />
									))}
								</div>
							))}
							{renderLeftover(desktop.leftoverRow)}
						</div>

						{/* Mobile: mídia full-width + placa 2 colunas */}
						<div className="lg:hidden">
							{hasMedia && (
								<div className="relative mb-3 aspect-video border border-border">
									<PlateMedia
										image={mediaImage}
										name={tool.name}
										video={video}
									/>
								</div>
							)}
							<div className="divide-y divide-border border border-border">
								{mobile.fullRows.map((row) => (
									<div
										className="grid grid-cols-2 divide-x divide-border"
										key={sorted[row[0]].definition.id}
									>
										{row.map((i) => (
											<SpecCell
												attr={sorted[i]}
												key={sorted[i].definition.id}
											/>
										))}
									</div>
								))}
								{renderLeftover(mobile.leftoverRow)}
							</div>
						</div>
					</>
				)}
			</div>
		</section>
	);
}
