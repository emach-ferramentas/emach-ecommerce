"use client";

import { cn } from "@emach/ui/lib/utils";
import { ChevronDown, ChevronRight, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { navShortLabel } from "@/lib/nav-label";
import type { StoreNav } from "@/lib/store-nav";

const linkClass =
	"relative inline-flex min-h-[50px] shrink-0 items-center whitespace-nowrap px-2 font-semibold text-[14px] text-ink-2 no-underline hover:text-ink xl:px-[11px] xl:text-[15px] after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:origin-left after:scale-x-0 after:bg-grafite after:transition-transform after:duration-200 after:ease-out-expo after:content-[''] hover:after:scale-x-100 xl:after:inset-x-[11px]";

function plural(n: number, one: string, many: string) {
	return `${n} ${n === 1 ? one : many}`;
}

/** Navegação por serviço e por categoria (desktop). No mobile vive no menu. */
export function DeptNav({ nav }: { nav: StoreNav }) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLElement>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		const onPointer = (e: PointerEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", onPointer);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<nav
			aria-label="Departamentos"
			className="relative z-20 border-line border-b bg-paper max-lg:hidden"
			ref={rootRef}
		>
			<div className="shop-wrap flex min-h-[50px] items-center gap-0.5">
				<button
					aria-controls="dept-panel"
					aria-expanded={open}
					className="mr-2.5 inline-flex min-h-[50px] shrink-0 cursor-pointer items-center gap-2 border-line border-r pr-4 font-extrabold text-[15px] text-ink"
					onClick={() => setOpen((v) => !v)}
					type="button"
				>
					<Menu aria-hidden="true" className="size-5" />
					Departamentos
					<ChevronDown
						aria-hidden="true"
						className={cn(
							"size-4 transition-transform duration-200 ease-out-expo",
							open && "rotate-180"
						)}
					/>
				</button>
				<div className="flex min-w-0 items-center overflow-x-auto [scrollbar-width:none]">
					{nav.services.length > 0 && (
						<>
							{nav.services.map((s) => (
								<Link className={linkClass} href={s.href} key={s.slug}>
									{s.name}
								</Link>
							))}
							<span
								aria-hidden="true"
								className="mx-2.5 h-[22px] w-px shrink-0 bg-line"
							/>
						</>
					)}
					{nav.categories
						.filter((c) => c.productCount > 0)
						.map((c) => (
							<Link className={linkClass} href={c.href} key={c.slug}>
								{navShortLabel(c.name)}
							</Link>
						))}
				</div>
			</div>

			{open && (
				<div
					className="absolute inset-x-0 top-full animate-[emach-drop_260ms_var(--ease-expo)_both] border-line border-y bg-paper shadow-[0_22px_30px_-22px_rgba(22,25,29,0.45)] motion-reduce:animate-none"
					id="dept-panel"
				>
					<div
						className={cn(
							"shop-wrap grid gap-9 pt-[22px] pb-[26px]",
							nav.services.length > 0 &&
								"grid-cols-[minmax(0,3fr)_minmax(0,1fr)]"
						)}
					>
						{nav.services.length > 0 && (
							<div>
								<p className="mb-2.5 font-bold text-[13px] text-ink-muted">
									Por serviço
								</p>
								<div className="grid grid-cols-4 gap-3">
									{nav.services.map((s) => (
										<Link
											className="group block rounded-[5px] no-underline"
											href={s.href}
											key={s.slug}
											onClick={() => setOpen(false)}
										>
											<span className="relative block aspect-video overflow-hidden rounded-[5px] bg-grafite">
												{s.imageSrc && (
													<Image
														alt=""
														className="object-cover transition-transform duration-500 ease-out-expo group-hover:scale-[1.04] motion-reduce:transition-none"
														fill
														sizes="(min-width: 1296px) 230px, 18vw"
														src={s.imageSrc}
													/>
												)}
											</span>
											<b className="mt-2 block font-bold text-[15px] text-ink leading-tight group-hover:underline">
												{s.name}
											</b>
											<small className="block text-[13px] text-ink-muted">
												{plural(s.productCount, "produto", "produtos")}
											</small>
										</Link>
									))}
								</div>
							</div>
						)}
						<div>
							<p className="mb-2.5 font-bold text-[13px] text-ink-muted">
								Por categoria
							</p>
							{nav.categories.map((c) => (
								<Link
									className="flex min-h-11 items-center justify-between border-line border-b font-semibold text-[15px] text-ink no-underline hover:underline"
									href={c.href}
									key={c.slug}
									onClick={() => setOpen(false)}
								>
									{c.name}
									<i className="font-medium text-[14px] text-ink-muted not-italic tabular-nums">
										{c.productCount}
									</i>
								</Link>
							))}
							<Link
								className="flex min-h-11 items-center gap-1 font-extrabold text-[15px] text-ink no-underline hover:underline"
								href="/catalog"
								onClick={() => setOpen(false)}
							>
								Ver catálogo completo
								<ChevronRight aria-hidden="true" className="size-5" />
							</Link>
						</div>
					</div>
				</div>
			)}
		</nav>
	);
}
