"use client";

import { cn } from "@emach/ui/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { signOut, useSession } from "@/lib/auth-client";
import { useOverlay } from "@/lib/use-overlay";
import { useSectionInView } from "@/lib/use-section-in-view";

interface MobileMenuProps {
	onClose: () => void;
	open: boolean;
}

const NAV_LINKS: {
	href: "/catalog" | "/sobre" | "/sobre#filiais";
	label: string;
}[] = [
	{ href: "/catalog", label: "Catálogo" },
	{ href: "/sobre", label: "Sobre" },
	{ href: "/sobre#filiais", label: "Filiais" },
];

export function MobileMenu({ open, onClose }: MobileMenuProps) {
	const { data: session } = useSession();
	const pathname = usePathname();
	const router = useRouter();
	// Esc, focus-trap, scroll-lock e restauração de foco vêm do hook.
	const panelRef = useOverlay(open, onClose);
	// Scroll-spy: em /sobre, "Filiais" marca enquanto a seção #filiais está na tela.
	const filiaisInView = useSectionInView("filiais", pathname === "/sobre");
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	// Fecha ao navegar (troca de rota). Ref evita re-disparo ao abrir;
	// fechar quando já fechado é no-op. Backstop além do onClick de cada link.
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
		toast.success("Sessão encerrada");
		router.push("/");
		router.refresh();
	}

	const activeHref =
		pathname === "/sobre" && filiaisInView ? "/sobre#filiais" : pathname;

	return (
		<div
			aria-label="Menu"
			aria-modal="true"
			className="fade-in fixed inset-0 z-[25] flex animate-in flex-col bg-black px-6 pt-20 pb-8 text-white duration-200 [color-scheme:dark] md:hidden"
			id="mobile-menu"
			ref={panelRef}
			role="dialog"
		>
			<nav className="mt-2 flex flex-col">
				{NAV_LINKS.map((link, i) => {
					const active = link.href === activeHref;
					return (
						<div
							className="fade-in slide-in-from-bottom-3 animate-in fill-mode-both duration-400 ease-out motion-reduce:animate-none"
							key={link.href}
							style={{ animationDelay: `${80 + i * 60}ms` }}
						>
							<Link
								aria-current={active ? "page" : undefined}
								className={cn(
									"relative block py-1 font-display font-semibold text-[clamp(40px,13vw,52px)] uppercase leading-[1.06] tracking-[0.01em] transition-colors",
									"focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2",
									active ? "text-white" : "text-white/55 hover:text-white"
								)}
								href={link.href}
								onClick={onClose}
							>
								{active && (
									<span
										aria-hidden="true"
										className="absolute top-1/2 -left-6 size-2.5 -translate-y-1/2 bg-emach-red"
									/>
								)}
								{link.label}
							</Link>
						</div>
					);
				})}
			</nav>

			<div className="mt-auto">
				<div className="mb-5 h-px bg-white/12" />
				{session?.user ? (
					<div className="flex items-center gap-4 font-display text-[16px] uppercase tracking-[0.08em]">
						<Link
							className="text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
							href="/dashboard"
							onClick={onClose}
						>
							Minha conta
						</Link>
						<span aria-hidden="true" className="text-emach-red">
							·
						</span>
						<button
							className="cursor-pointer text-white/80 uppercase transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
							onClick={handleSignOut}
							type="button"
						>
							Sair
						</button>
					</div>
				) : (
					<div className="flex items-center gap-4 font-display text-[16px] uppercase tracking-[0.08em]">
						<Link
							className="text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
							href="/login"
							onClick={onClose}
						>
							Entrar
						</Link>
						<span aria-hidden="true" className="text-emach-red">
							·
						</span>
						<Link
							className="text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
							href="/login"
							onClick={onClose}
						>
							Criar conta
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}
