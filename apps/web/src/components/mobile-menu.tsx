"use client";

import { ChevronRight, LogOut, Truck, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { ContactLink } from "@/components/contact-link";
import { useSession } from "@/lib/auth-client";
import { loginHref } from "@/lib/safe-redirect";
import type { StoreNav } from "@/lib/store-nav";
import { useOverlay } from "@/lib/use-overlay";
import { useSignOut } from "@/lib/use-sign-out";

interface MobileMenuProps {
	nav: StoreNav;
	onClose: () => void;
	open: boolean;
}

const rowClass =
	"flex min-h-12 w-full items-center justify-between gap-3 border-line border-b px-4 text-left font-semibold text-[16px] text-ink no-underline hover:bg-canteiro";

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="px-4 pt-[18px] pb-1.5 font-bold text-[13.5px] text-ink-muted">
			{children}
		</h2>
	);
}

export function MobileMenu({ nav, open, onClose }: MobileMenuProps) {
	const { data: session } = useSession();
	const pathname = usePathname();
	const signOut = useSignOut();
	// Esc, focus-trap, scroll-lock e restauração de foco vêm do hook.
	const panelRef = useOverlay(open, onClose);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	// Fecha ao navegar (troca de rota). Backstop além do onClick de cada link.
	useEffect(() => {
		if (pathname) {
			onCloseRef.current();
		}
	}, [pathname]);

	if (!open) {
		return null;
	}

	async function handleSignOut() {
		onClose();
		await signOut();
	}

	return (
		<div className="fixed inset-0 z-[60] lg:hidden">
			<button
				aria-label="Fechar menu"
				className="fade-in absolute inset-0 animate-in cursor-default bg-grafite-deep/60 duration-200"
				onClick={onClose}
				tabIndex={-1}
				type="button"
			/>
			<div
				aria-label="Menu"
				aria-modal="true"
				className="slide-in-from-left absolute inset-y-0 left-0 flex w-[min(380px,88vw)] animate-in flex-col bg-paper shadow-[8px_0_28px_-10px_rgba(0,0,0,0.4)] duration-300 ease-out-expo motion-reduce:animate-none"
				id="mobile-menu"
				ref={panelRef}
				role="dialog"
			>
				<div className="flex min-h-16 shrink-0 items-center justify-between gap-2.5 border-line border-b py-2 pr-2 pl-4">
					<Link
						aria-label="EMACH Ferramentas, página inicial"
						href="/"
						onClick={onClose}
					>
						<Image
							alt=""
							className="h-auto w-[120px]"
							height={377}
							src="/emach-logo-black.svg"
							width={2041}
						/>
					</Link>
					<button
						aria-label="Fechar menu"
						className="grid size-11 cursor-pointer place-items-center rounded-[3px] hover:bg-canteiro"
						onClick={onClose}
						type="button"
					>
						<X aria-hidden="true" className="size-6" />
					</button>
				</div>

				<nav
					aria-label="Menu da loja"
					className="flex-1 overflow-y-auto overscroll-contain"
				>
					<Link className={rowClass} href="/catalog" onClick={onClose}>
						Catálogo completo
						<ChevronRight
							aria-hidden="true"
							className="size-5 text-ink-muted"
						/>
					</Link>

					{nav.services.length > 0 && (
						<>
							<SectionTitle>Por serviço</SectionTitle>
							{nav.services.map((s) => (
								<Link
									className={rowClass}
									href={s.href}
									key={s.slug}
									onClick={onClose}
								>
									{s.name}
									<span className="font-medium text-[14px] text-ink-muted tabular-nums">
										{s.productCount}
									</span>
								</Link>
							))}
						</>
					)}

					{nav.categories.length > 0 && (
						<>
							<SectionTitle>Por categoria</SectionTitle>
							{nav.categories.map((c) => (
								<Link
									className={rowClass}
									href={c.href}
									key={c.slug}
									onClick={onClose}
								>
									{c.name}
									<span className="font-medium text-[14px] text-ink-muted tabular-nums">
										{c.productCount}
									</span>
								</Link>
							))}
						</>
					)}

					<SectionTitle>Atendimento</SectionTitle>
					{session?.user ? (
						<>
							<Link className={rowClass} href="/dashboard" onClick={onClose}>
								Minha conta
								<User aria-hidden="true" className="size-5" />
							</Link>
							<button
								className={`${rowClass} cursor-pointer`}
								onClick={handleSignOut}
								type="button"
							>
								Sair
								<LogOut aria-hidden="true" className="size-5" />
							</button>
						</>
					) : (
						<Link
							className={rowClass}
							href={loginHref(pathname)}
							onClick={onClose}
						>
							Entrar ou criar conta
							<User aria-hidden="true" className="size-5" />
						</Link>
					)}
					<Link className={rowClass} href="/entrega" onClick={onClose}>
						Entrega e pagamento
						<Truck aria-hidden="true" className="size-5" />
					</Link>
					<div className="p-4">
						<ContactLink
							className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[3px] bg-grafite px-4 font-bold text-[15px] text-on-dark no-underline hover:bg-black"
							iconClassName="size-5"
						/>
					</div>
				</nav>
			</div>
		</div>
	);
}
