"use client";

import { cn } from "@emach/ui/lib/utils";
import { ChevronRight, Search } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { type SearchResult, searchToolsAction } from "@/lib/actions/search";
import { fmtBRL, fmtNumericBRL } from "@/lib/format";

const MAX_SUGGESTIONS = 5;
const SEARCH_FAILED = "Não foi possível buscar agora.";

function catalogSearchHref(term: string): Route {
	return `/catalog?q=${encodeURIComponent(term)}` as Route;
}

function Highlight({ text, query }: { text: string; query: string }) {
	const q = query.trim().toLowerCase();
	const idx = q ? text.toLowerCase().indexOf(q) : -1;
	if (idx === -1) {
		return text;
	}
	return (
		<>
			{text.slice(0, idx)}
			<mark className="bg-transparent font-extrabold text-ink">
				{text.slice(idx, idx + q.length)}
			</mark>
			{text.slice(idx + q.length)}
		</>
	);
}

function priceLabel(result: SearchResult): string {
	return result.discountedCents === null
		? fmtNumericBRL(result.defaultVariant.priceAmount)
		: fmtBRL(result.discountedCents);
}

/**
 * Busca do cabeçalho: campo sempre visível com até 5 sugestões em links. Enter
 * no campo abre o catálogo com o termo; as setas descem até as sugestões.
 */
export function HeaderSearch({ className }: { className?: string }) {
	const router = useRouter();
	const listId = useId();
	const formRef = useRef<HTMLFormElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [results, setResults] = useState<SearchResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const term = query.trim();
		if (term.length < 2) {
			setResults([]);
			setError(null);
			setLoading(false);
			return;
		}
		// Resposta de um termo antigo pode chegar depois da do termo atual.
		let stale = false;
		setLoading(true);
		const handle = window.setTimeout(async () => {
			try {
				const res = await searchToolsAction(term);
				if (stale) {
					return;
				}
				setResults(res.ok ? res.data.slice(0, MAX_SUGGESTIONS) : []);
				setError(res.ok ? null : res.error);
			} catch {
				if (!stale) {
					setResults([]);
					setError(SEARCH_FAILED);
				}
			} finally {
				if (!stale) {
					setLoading(false);
				}
			}
		}, 250);
		return () => {
			stale = true;
			window.clearTimeout(handle);
		};
	}, [query]);

	useEffect(() => {
		if (!open) {
			return;
		}
		const onPointer = (e: PointerEvent) => {
			if (!formRef.current?.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", onPointer);
		return () => document.removeEventListener("pointerdown", onPointer);
	}, [open]);

	const term = query.trim();
	const showList = open && term.length >= 2;

	function close() {
		setOpen(false);
	}

	function submit(e: React.FormEvent) {
		e.preventDefault();
		if (term) {
			close();
			router.push(catalogSearchHref(term));
		}
	}

	function suggestionLinks(): HTMLAnchorElement[] {
		return Array.from(
			formRef.current?.querySelectorAll<HTMLAnchorElement>(
				"a[data-suggestion]"
			) ?? []
		);
	}

	// Setas andam entre o campo e as sugestões; Esc fecha e volta ao campo.
	function onKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
		if (e.key === "Escape") {
			close();
			inputRef.current?.focus();
			return;
		}
		if (!showList || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) {
			return;
		}
		const links = suggestionLinks();
		if (links.length === 0) {
			return;
		}
		e.preventDefault();
		const current = links.indexOf(document.activeElement as HTMLAnchorElement);
		if (e.key === "ArrowDown") {
			links[(current + 1) % links.length]?.focus();
		} else if (current <= 0) {
			inputRef.current?.focus();
		} else {
			links[current - 1]?.focus();
		}
	}

	const optionClass =
		"rounded-[3px] px-2.5 text-ink no-underline outline-none hover:bg-canteiro focus-visible:bg-canteiro focus-visible:outline-2 focus-visible:outline-ink";

	return (
		<search className={cn("relative min-w-0", className)}>
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: o form só delega as setas entre o campo e os links de sugestão */}
			<form
				className="flex min-w-0 rounded-[3px] focus-within:shadow-[0_0_0_4px_rgba(216,40,27,0.2)]"
				noValidate
				onKeyDown={onKeyDown}
				onSubmit={submit}
				ref={formRef}
			>
				<label className="sr-only" htmlFor={`${listId}-q`}>
					Buscar na loja
				</label>
				<input
					aria-controls={listId}
					autoComplete="off"
					className="h-12 min-w-0 flex-1 rounded-l-[3px] border-[1.5px] border-line-strong border-r-0 bg-paper px-4 text-[16px] text-ink outline-none placeholder:text-ink-muted focus:border-ink md:h-[50px] [&::-webkit-search-cancel-button]:hidden"
					id={`${listId}-q`}
					onChange={(e) => {
						setQuery(e.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					placeholder="Buscar ferramenta, serviço ou código"
					ref={inputRef}
					type="search"
					value={query}
				/>
				<button
					aria-label="Buscar"
					className="grid h-12 w-[52px] shrink-0 cursor-pointer place-items-center rounded-r-[3px] bg-grafite text-on-dark hover:bg-black md:h-[50px] md:w-14"
					type="submit"
				>
					<Search aria-hidden="true" className="size-5" />
				</button>

				<div
					className={cn(
						"absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-[min(70vh,460px)] overflow-auto rounded-[5px] border border-line-strong bg-paper p-1.5 shadow-pop",
						!showList && "hidden"
					)}
					id={listId}
				>
					<p aria-live="polite" className="sr-only">
						{showList && !loading
							? `${results.length} ${results.length === 1 ? "sugestão" : "sugestões"}`
							: ""}
					</p>
					{showList && error && !loading && (
						<p className="px-2.5 py-3 text-[14.5px] text-ink-muted">{error}</p>
					)}
					{showList && !(error || loading) && results.length === 0 && (
						<p className="px-2.5 py-3 text-[14.5px] text-ink-muted">
							Nenhum produto com esse nome. Aperte Enter para buscar no
							catálogo.
						</p>
					)}
					{showList && (
						<ul aria-label="Sugestões">
							{results.map((r) => (
								<li key={r.id}>
									<Link
										className={cn(
											optionClass,
											"grid min-h-14 grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 py-1.5 md:grid-cols-[44px_minmax(0,1fr)_auto]"
										)}
										data-suggestion
										href={`/product/${r.slug}`}
										onClick={close}
									>
										<span className="relative row-span-2 size-11 overflow-hidden rounded-[3px] bg-well md:row-span-1">
											{r.primaryImage?.url && (
												<Image
													alt=""
													className="object-contain p-1 mix-blend-multiply"
													fill
													sizes="44px"
													src={r.primaryImage.url}
												/>
											)}
										</span>
										<span className="font-medium text-[14.5px] leading-snug">
											<Highlight query={term} text={r.name} />
										</span>
										<span className="whitespace-nowrap font-extrabold text-[14.5px] tabular-nums">
											{priceLabel(r)}
										</span>
									</Link>
								</li>
							))}
							<li className="mt-1 border-line border-t pt-1">
								<Link
									className={cn(
										optionClass,
										"flex min-h-12 items-center justify-between gap-3 font-bold text-[14.5px]"
									)}
									data-suggestion
									href={catalogSearchHref(term)}
									onClick={close}
								>
									<span>Ver todos os resultados para “{term}”</span>
									<ChevronRight aria-hidden="true" className="size-5" />
								</Link>
							</li>
						</ul>
					)}
				</div>
			</form>
		</search>
	);
}
