"use client";

import { cn } from "@emach/ui/lib/utils";
import { ArrowRight, Search } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/product-image";
import { SectionLabel } from "@/components/section-label";
import { type SearchResult, searchToolsAction } from "@/lib/actions/search";
import { fmtBRL, fmtNumericBRL } from "@/lib/format";
import { useOverlay } from "@/lib/use-overlay";

interface SearchOverlayProps {
	onClose: () => void;
	open: boolean;
}

const SUGGESTIONS = ["Furadeira", "Serra", "Nível Laser", "Chaves"];
const RECENT_KEY = "emach:recent-searches";
const RECENT_MAX = 5;

function loadRecent(): string[] {
	if (typeof window === "undefined") {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(RECENT_KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed)
			? parsed.filter((v): v is string => typeof v === "string")
			: [];
	} catch {
		return [];
	}
}

function saveRecent(list: string[]) {
	try {
		window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
	} catch {
		// noop — storage unavailable
	}
}

const SEARCH_FAILED = "Não foi possível buscar agora.";

function catalogSearchHref(term: string): Route {
	return `/catalog?q=${encodeURIComponent(term)}` as Route;
}

function highlightMatch(text: string, query: string) {
	const q = query.trim();
	if (!q) {
		return text;
	}
	const lowerText = text.toLowerCase();
	const lowerQ = q.toLowerCase();
	const idx = lowerText.indexOf(lowerQ);
	if (idx === -1) {
		return text;
	}
	return (
		<>
			{text.slice(0, idx)}
			<mark className="bg-emach-red/15 p-0 text-near-black">
				{text.slice(idx, idx + q.length)}
			</mark>
			{text.slice(idx + q.length)}
		</>
	);
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
	const router = useRouter();
	const [query, setQuery] = useState("");
	// -1 = nada destacado pelas setas: Enter vai para a busca completa.
	const [highlight, setHighlight] = useState(-1);
	const [recent, setRecent] = useState<string[]>([]);
	const [results, setResults] = useState<SearchResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [retryNonce, setRetryNonce] = useState(0);
	// Esc, focus-trap, scroll-lock e restauração de foco vêm do hook. O foco
	// inicial fica com o `<input autoFocus>`, então `autoFocus: false` aqui.
	const dialogRef = useOverlay(open, onClose, { autoFocus: false });

	useEffect(() => {
		if (open) {
			setRecent(loadRecent());
		}
	}, [open]);

	function addRecent(term: string) {
		const t = term.trim();
		if (!t) {
			return;
		}
		const next = [
			t,
			...recent.filter((r) => r.toLowerCase() !== t.toLowerCase()),
		].slice(0, RECENT_MAX);
		setRecent(next);
		saveRecent(next);
	}

	function clearRecent() {
		setRecent([]);
		saveRecent([]);
	}

	useEffect(() => {
		if (!open) {
			setQuery("");
			setHighlight(-1);
		}
	}, [open]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: retryNonce não é lido no corpo — é gatilho manual do botão "Tentar de novo".
	useEffect(() => {
		const trimmed = query.trim();
		if (trimmed.length < 2) {
			setResults([]);
			setError(null);
			setIsLoading(false);
			return;
		}
		// A resposta de um termo antigo pode chegar depois da do termo atual:
		// o cleanup marca a requisição como velha e ela é descartada.
		let stale = false;
		setIsLoading(true);
		setError(null);
		const handle = window.setTimeout(async () => {
			try {
				const res = await searchToolsAction(trimmed);
				if (stale) {
					return;
				}
				setResults(res.ok ? res.data : []);
				setError(res.ok ? null : res.error);
			} catch {
				if (!stale) {
					setResults([]);
					setError(SEARCH_FAILED);
				}
			} finally {
				if (!stale) {
					setIsLoading(false);
				}
			}
		}, 300);
		return () => {
			stale = true;
			window.clearTimeout(handle);
		};
	}, [query, retryNonce]);

	function changeQuery(value: string) {
		setQuery(value);
		setHighlight(-1);
	}

	function handleInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown" && results.length > 0) {
			e.preventDefault();
			setHighlight((h) => (h + 1) % results.length);
		} else if (e.key === "ArrowUp" && results.length > 0) {
			e.preventDefault();
			setHighlight((h) => (h <= 0 ? results.length - 1 : h - 1));
		} else if (e.key === "Enter") {
			const term = query.trim();
			const picked = highlight >= 0 ? results[highlight] : undefined;
			if (picked) {
				e.preventDefault();
				addRecent(query);
				router.push(`/product/${picked.slug}`);
				onClose();
			} else if (term) {
				e.preventDefault();
				addRecent(query);
				router.push(catalogSearchHref(term));
				onClose();
			}
		}
	}

	function handleResultClick() {
		addRecent(query);
		onClose();
	}

	if (!open) {
		return null;
	}

	const term = query.trim();
	const showEmpty =
		term.length >= 2 && !isLoading && !error && results.length === 0;
	const showError = term.length >= 2 && !isLoading && error !== null;

	return (
		<div className="fixed inset-0 z-100 flex items-start justify-center bg-black/60 pt-20">
			<button
				aria-label="Fechar busca"
				className="absolute inset-0 cursor-default border-none bg-transparent"
				onClick={onClose}
				type="button"
			/>
			<div
				aria-label="Busca de produtos"
				aria-modal="true"
				className="relative w-[720px] max-w-[90%] rounded-[2px] bg-white p-7"
				ref={dialogRef}
				role="dialog"
			>
				<div className="flex items-center gap-3 border-border border-b pb-3">
					<Search className="text-near-black" size={20} />
					<input
						aria-label="Busca"
						autoFocus
						className="flex-1 border-none font-normal text-[18px] outline-none"
						onChange={(e) => changeQuery(e.target.value)}
						onKeyDown={handleInputKey}
						placeholder="Buscar por produto, categoria ou SKU…"
						value={query}
					/>
					<button
						className="emach-ghost-btn -mr-3 inline-flex min-h-11 items-center px-3 font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]"
						onClick={onClose}
						type="button"
					>
						FECHAR
					</button>
				</div>

				<div aria-live="polite" className="mt-4">
					<span className="sr-only">
						{showEmpty ? "Nenhum resultado encontrado" : ""}
						{showError ? error : ""}
						{!isLoading && term.length >= 2 && results.length > 0
							? `${results.length} resultado${results.length === 1 ? "" : "s"} encontrado${results.length === 1 ? "" : "s"}`
							: ""}
					</span>
					{results.length === 0 && !query && (
						<div className="space-y-5">
							{recent.length > 0 && (
								<div>
									<div className="flex items-center justify-between">
										<SectionLabel>Recentes</SectionLabel>
										<button
											className="text-[11px] text-gray-60 uppercase tracking-[0.12em]"
											onClick={clearRecent}
											type="button"
										>
											Limpar
										</button>
									</div>
									<div className="mt-2.5 flex flex-wrap gap-2">
										{recent.map((r) => (
											<button
												className="emach-chip"
												key={r}
												onClick={() => changeQuery(r)}
												type="button"
											>
												{r}
											</button>
										))}
									</div>
								</div>
							)}
							<div>
								<SectionLabel>Sugestões</SectionLabel>
								<div className="mt-2.5 flex flex-wrap gap-2">
									{SUGGESTIONS.map((s) => (
										<button
											className="emach-chip"
											key={s}
											onClick={() => changeQuery(s)}
											type="button"
										>
											{s}
										</button>
									))}
								</div>
							</div>
						</div>
					)}

					{isLoading && query.trim().length >= 2 && (
						<div className="py-6 text-center font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
							Buscando…
						</div>
					)}

					{showEmpty && (
						<div className="py-10 text-center">
							<div className="font-display font-semibold text-[11px] text-emach-red uppercase tracking-[0.14em]">
								Sem resultados
							</div>
							<div className="mt-2 text-[15px] text-near-black">
								Nada encontrado para <b>“{query}”</b>.
							</div>
							<div className="mt-1 text-[13px] text-gray-60">
								Pressione Enter para buscar no catálogo completo.
							</div>
						</div>
					)}

					{showError && (
						<div className="py-10 text-center">
							<div className="font-display font-semibold text-[11px] text-emach-red uppercase tracking-[0.14em]">
								Busca indisponível
							</div>
							<div className="mt-2 text-[15px] text-near-black">{error}</div>
							<button
								className="emach-ghost-btn mt-3 inline-flex min-h-11 items-center px-3 font-semibold text-[11px] text-near-black uppercase tracking-[0.14em]"
								onClick={() => setRetryNonce((n) => n + 1)}
								type="button"
							>
								Tentar de novo
							</button>
						</div>
					)}

					{!isLoading &&
						results.map((r, i) => {
							const active = i === highlight;
							return (
								<Link
									className={cn(
										"grid cursor-pointer grid-cols-[60px_1fr_auto] items-center gap-4 rounded-[2px] border-border border-b px-2 py-3 transition-colors hover:bg-gray-10",
										active ? "bg-gray-10" : "bg-transparent"
									)}
									href={`/product/${r.slug}`}
									key={r.id}
									onClick={handleResultClick}
								>
									<div className="relative size-[60px] overflow-hidden rounded-[2px] bg-image-bg">
										<ProductImage
											alt={r.name}
											categorySlug=""
											sizes="60px"
											src={r.primaryImage?.url ?? ""}
										/>
									</div>
									<div>
										<SectionLabel>SKU {r.defaultVariant.sku}</SectionLabel>
										<div className="mt-0.5 font-medium text-[14px]">
											{highlightMatch(r.name, query)}
										</div>
									</div>
									<div className="text-right tabular-nums">
										<div className="font-bold">
											{r.discountedCents === null
												? fmtNumericBRL(r.defaultVariant.priceAmount)
												: fmtBRL(r.discountedCents)}
										</div>
										{r.discountedCents !== null && (
											<div className="text-[11px] text-gray-60 line-through">
												<span className="sr-only">Preço original </span>
												{fmtNumericBRL(r.defaultVariant.priceAmount)}
											</div>
										)}
									</div>
								</Link>
							);
						})}

					{!isLoading && results.length > 0 && (
						<Link
							className="mt-2 flex min-h-11 items-center justify-between gap-4 px-2 font-display font-semibold text-[11px] text-near-black uppercase tracking-[0.14em] transition-colors hover:bg-gray-10"
							href={catalogSearchHref(term)}
							onClick={handleResultClick}
						>
							<span>Ver todos os resultados</span>
							<span className="inline-flex items-center gap-1.5 text-gray-60">
								{highlight < 0 && "Enter"}
								<ArrowRight aria-hidden="true" className="size-3.5" />
							</span>
						</Link>
					)}
				</div>
			</div>
		</div>
	);
}
