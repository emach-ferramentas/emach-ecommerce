"use client";

import { cn } from "@emach/ui/lib/utils";
import { useEffect, useState } from "react";
import type { BranchPin } from "@/lib/branch-map/types";

const CYCLE_MS = 2200;

interface Props {
	mapHeight: number;
	mapMaskUri: string;
	mapUri: string;
	mapWidth: number;
	pins: BranchPin[];
}

const REDUCE_MOTION =
	typeof window !== "undefined" &&
	window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function BranchMap({
	pins,
	mapUri,
	mapMaskUri,
	mapWidth,
	mapHeight,
}: Props) {
	const [hovered, setHovered] = useState<string | null>(null);
	const [paused, setPaused] = useState(false);

	// Auto-cycle: destaca cada filial em rotação (efeito hover automático),
	// pausando enquanto o usuário interage. Respeita prefers-reduced-motion.
	useEffect(() => {
		if (REDUCE_MOTION || paused || pins.length < 2) {
			return;
		}
		const timer = setInterval(() => {
			setHovered((cur) => {
				const idx = pins.findIndex((p) => p.id === cur);
				return pins[(idx + 1) % pins.length].id;
			});
		}, CYCLE_MS);
		return () => clearInterval(timer);
	}, [paused, pins]);

	// Scroll a filial ativa pra dentro do carrossel da lista (sem mover a página).
	useEffect(() => {
		if (!hovered) {
			return;
		}
		const row = document.getElementById(`branch-row-${hovered}`);
		const list = row?.parentElement;
		if (!(row && list) || list.scrollHeight <= list.clientHeight) {
			return;
		}
		list.scrollTo({
			top:
				row.offsetTop -
				list.offsetTop -
				(list.clientHeight - row.clientHeight) / 2,
			behavior: REDUCE_MOTION ? "auto" : "smooth",
		});
	}, [hovered]);

	function activate(id: string) {
		setPaused(true);
		setHovered(id);
	}
	function resume() {
		setPaused(false);
	}

	return (
		<div className="flex flex-1 flex-col gap-0 border-white/10 border-l max-md:border-t max-md:border-l-0 md:flex-row">
			{/* MAPA — base como <img> (imune ao force-dark), pins como overlay HTML */}
			<div className="flex flex-[0_0_50%] items-center justify-center p-6">
				<div
					className="relative w-full max-w-[420px]"
					style={{ aspectRatio: `${mapWidth} / ${mapHeight}` }}
				>
					{/* biome-ignore lint/performance/noImgElement: data-URI inline, sem otimização de CDN */}
					<img
						alt="Mapa do Brasil com as filiais EMACH no Sul e Sudeste"
						className="block h-full w-full select-none"
						draggable={false}
						height={mapHeight}
						src={mapUri}
						style={{
							maskImage: `url("${mapMaskUri}")`,
							WebkitMaskImage: `url("${mapMaskUri}")`,
							maskSize: "contain",
							WebkitMaskSize: "contain",
							maskRepeat: "no-repeat",
							WebkitMaskRepeat: "no-repeat",
							maskPosition: "center",
							WebkitMaskPosition: "center",
						}}
						width={mapWidth}
					/>
					{pins.map((p) => (
						<a
							aria-label={`EMACH ${p.name} — ${p.address}`}
							className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
							href={p.mapsUrl}
							key={p.id}
							onBlur={resume}
							onFocus={() => activate(p.id)}
							onMouseEnter={() => activate(p.id)}
							onMouseLeave={resume}
							rel="noopener"
							style={{
								left: `${(p.x / mapWidth) * 100}%`,
								top: `${(p.y / mapHeight) * 100}%`,
							}}
							target="_blank"
						>
							<span
								className={cn(
									"absolute rounded-full bg-emach-red transition-all duration-200",
									hovered === p.id
										? "h-5 w-5 opacity-40"
										: "h-3.5 w-3.5 opacity-20"
								)}
							/>
							<span
								className={cn(
									"relative block rounded-full bg-emach-red ring-2 ring-cinema-3 transition-all duration-200",
									hovered === p.id ? "h-3.5 w-3.5" : "h-2.5 w-2.5"
								)}
							/>
						</a>
					))}
				</div>
			</div>

			{/* LISTA */}
			<div className="flex flex-1 flex-col p-6">
				<p className="mb-2 font-display font-medium text-[12px] text-white/60 uppercase tracking-[0.16em]">
					{pins.length} {pins.length === 1 ? "filial" : "filiais"}
				</p>
				<div className="emach-scrollbar-dark max-h-[440px] flex-1 overflow-y-auto pr-1 [scroll-behavior:smooth] motion-reduce:[scroll-behavior:auto]">
					{pins.map((p) => (
						<a
							className={cn(
								"block border border-transparent border-white/10 border-b px-3 py-3.5 no-underline transition-colors duration-200",
								hovered === p.id && "border-emach-red/45 bg-emach-red/10"
							)}
							href={p.mapsUrl}
							id={`branch-row-${p.id}`}
							key={p.id}
							onMouseEnter={() => activate(p.id)}
							onMouseLeave={resume}
							rel="noopener"
							target="_blank"
						>
							<div className="flex items-baseline gap-2">
								<span className="font-display font-semibold text-[20px] text-white">
									{p.name}
								</span>
								<span className="font-display font-semibold text-[12px] text-emach-red-on-dark uppercase tracking-[0.1em]">
									{p.uf}
								</span>
							</div>
							<div className="mt-1 text-[12px] text-white/55">{p.address}</div>
							<div className="mt-1.5 flex gap-3.5 text-[11.5px] text-white/40">
								{p.phone && <span className="text-white/70">{p.phone}</span>}
								<span className="text-white">Como chegar →</span>
							</div>
						</a>
					))}
				</div>
			</div>
		</div>
	);
}
