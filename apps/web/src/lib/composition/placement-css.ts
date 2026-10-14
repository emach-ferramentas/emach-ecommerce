// Fórmulas de render do contrato composition (issue #210) — port do
// placement-css.ts do emach-dashboard (canônico lá; nomes espelhados).
import type { CSSProperties } from "react";
import {
	type Anchor9,
	anchorBasePosition,
	type BackgroundConfig,
	type BannerComposition,
	type ElementPlacement,
	type Viewport,
} from "./composition-schema";

// Deslocamento de translate p/ ancorar o ponto de referência no elemento
// (col = horizontal, row = vertical), lido por Map.get com fallback no uso.
const TX_BY_COL = new Map<string, string>([
	["l", "0%"],
	["c", "-50%"],
	["r", "-100%"],
]);

const TY_BY_ROW = new Map<string, string>([
	["t", "0%"],
	["m", "-50%"],
	["b", "-100%"],
]);

const PCT_BY_AXIS = new Map<string, string>([
	["l", "0%"],
	["c", "50%"],
	["r", "100%"],
	["t", "0%"],
	["m", "50%"],
	["b", "100%"],
]);

function colOf(anchor: Anchor9): string {
	return anchor.charAt(1);
}

function rowOf(anchor: Anchor9): string {
	return anchor.charAt(0);
}

export function placementToStyle(
	p: ElementPlacement,
	viewport: Viewport
): CSSProperties {
	const base = anchorBasePosition(p.anchor, viewport);
	const tx = TX_BY_COL.get(colOf(p.anchor)) ?? "0%";
	const ty = TY_BY_ROW.get(rowOf(p.anchor)) ?? "0%";
	const originX = PCT_BY_AXIS.get(colOf(p.anchor)) ?? "50%";
	const originY = PCT_BY_AXIS.get(rowOf(p.anchor)) ?? "50%";

	const style: CSSProperties = {
		left: `${base.x + p.offsetX}%`,
		top: `${base.y + p.offsetY}%`,
		transform: `translate(${tx}, ${ty}) scale(${p.scale / 100})`,
		transformOrigin: `${originX} ${originY}`,
	};

	if (p.maxWidth !== undefined) {
		style.maxWidth = `${p.maxWidth}ch`;
	}

	return style;
}

export function focalToObjectPosition(focal: Anchor9): string {
	const x = PCT_BY_AXIS.get(colOf(focal)) ?? "50%";
	const y = PCT_BY_AXIS.get(rowOf(focal)) ?? "50%";

	return `${x} ${y}`;
}

export function backgroundToStyle(bg: BackgroundConfig): CSSProperties {
	return {
		transform: `scale(${bg.zoom / 100})`,
		transformOrigin: focalToObjectPosition(bg.focal),
	};
}

export function textSide(c: BannerComposition): "left" | "right" | "center" {
	const a =
		c.desktop.elements.title?.anchor ?? c.desktop.elements.subtitle?.anchor;

	if (a === undefined) {
		return "center";
	}

	const col = colOf(a);

	if (col === "l") {
		return "left";
	}

	if (col === "r") {
		return "right";
	}

	return "center";
}

// Direção do gradiente de legibilidade no DESKTOP pela coluna da âncora do
// título (contrato §gradiente). A base mobile (to-t) é fixa no slide. Classes
// estáticas — Tailwind JIT não vê string montada.
export const GRADIENT_CLASS: Record<"left" | "right" | "center", string> = {
	left: "lg:bg-gradient-to-r lg:from-black/80 lg:via-black/20 lg:to-transparent",
	right:
		"lg:bg-gradient-to-l lg:from-black/80 lg:via-black/20 lg:to-transparent",
	center:
		"lg:bg-gradient-to-t lg:from-black/85 lg:via-black/30 lg:to-transparent",
};
