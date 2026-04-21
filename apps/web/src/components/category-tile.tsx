"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { SectionLabel } from "@/components/section-label";
import type { Category } from "@/lib/mock-data";

interface CategoryTileProps {
	category: Category;
	size?: "sm" | "md" | "lg" | "full";
}

const SIZE_HEIGHT: Record<string, string | number> = {
	sm: 240,
	md: 320,
	lg: 400,
	full: "100%",
};

export function CategoryTile({ category, size = "md" }: CategoryTileProps) {
	const [hovered, setHovered] = useState(false);
	const h = SIZE_HEIGHT[size] ?? 320;

	return (
		<Link
			className="block"
			href={`/catalog?cat=${category.slug}`}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{
				position: "relative",
				height: h,
				minHeight: size === "full" ? 664 : undefined,
				overflow: "hidden",
				background: "var(--near-black)",
				borderRadius: 2,
				display: "block",
			}}
		>
			{/* Background image */}
			{category.image && (
				<div
					aria-hidden="true"
					style={{
						position: "absolute",
						inset: 0,
						transform: hovered ? "scale(1.05)" : "scale(1)",
						transition: "transform 400ms ease",
					}}
				>
					<Image
						alt=""
						className="object-cover"
						fill
						sizes={size === "full" ? "50vw" : "25vw"}
						src={category.image}
					/>
				</div>
			)}

			{/* Gradient fallback / darken */}
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					inset: 0,
					background: category.image
						? "linear-gradient(135deg, rgba(0,0,0,0.2), rgba(0,0,0,0.45))"
						: "linear-gradient(135deg, #2a2a2a, #0a0a0a)",
					transform: hovered ? "scale(1.05)" : "scale(1)",
					transition: "transform 400ms ease",
				}}
			/>

			{/* Texture overlay */}
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					inset: 0,
					background:
						"repeating-linear-gradient(40deg, transparent 0 30px, rgba(255,255,255,0.015) 30px 60px)",
				}}
			/>

			{/* Bottom vignette */}
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					inset: 0,
					background:
						"linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.2) 55%, transparent)",
				}}
			/>

			{/* Red accent bar on hover */}
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					left: 0,
					bottom: 0,
					height: 3,
					width: hovered ? "100%" : "0%",
					background: "var(--emach-red)",
					transition: "width 300ms ease",
				}}
			/>

			{/* Content */}
			<div
				style={{
					position: "absolute",
					right: 24,
					bottom: 24,
					left: 24,
					color: "#fff",
					display: "flex",
					flexDirection: "column",
					gap: 6,
				}}
			>
				<SectionLabel tone="light">{category.slug}</SectionLabel>
				<div className="font-medium text-[24px]">{category.name}</div>
				<div
					className="max-w-[320px] text-[13px] leading-relaxed"
					style={{ color: "rgba(255,255,255,0.72)" }}
				>
					{category.description}
				</div>
				<div className="mt-2.5 flex items-end gap-2 font-semibold text-white text-xs">
					<span>Explorar</span>
					<ArrowRight
						size={14}
						strokeWidth={2}
						style={{
							color: hovered ? "var(--emach-red)" : "#fff",
							transform: hovered ? "translateX(4px)" : "translateX(0)",
							transition: "color 200ms ease, transform 200ms ease",
						}}
					/>
				</div>
			</div>
		</Link>
	);
}
