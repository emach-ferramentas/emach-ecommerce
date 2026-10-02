import { MapPin, Truck } from "lucide-react";
import Link from "next/link";

import { ContactLink } from "@/components/contact-link";
import { DeptNav } from "@/components/dept-nav";
import { HeaderBar } from "@/components/header-bar";
import { getStoreNav } from "@/lib/store-nav";

const topLinkClass =
	"inline-flex min-h-10 items-center gap-1.5 text-on-dark no-underline hover:underline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2";

/**
 * Cabeçalho da loja: barra utilitária grafite, barra principal (logo, busca,
 * conta, carrinho) e a navegação por serviço e por categoria. A navegação vem
 * do banco em cache; o resto é estático.
 */
export async function SiteHeader() {
	const nav = await getStoreNav();

	return (
		<>
			<a
				className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-4 focus-visible:z-50 focus-visible:bg-paper focus-visible:px-4 focus-visible:py-2 focus-visible:font-semibold focus-visible:text-ink focus-visible:text-sm focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
				href="#main-content"
			>
				Pular para o conteúdo
			</a>
			<div className="bg-grafite text-[13.5px] text-on-dark [color-scheme:dark]">
				<div className="shop-wrap flex min-h-9 items-center justify-between gap-4 md:min-h-10">
					<Link className={topLinkClass} href="/sobre#filiais">
						<MapPin aria-hidden="true" className="size-4 text-on-dark-muted" />
						Nossas filiais
					</Link>
					<div className="flex items-center gap-5">
						<ContactLink
							className={topLinkClass}
							iconClassName="text-on-dark-muted"
						/>
						<span
							aria-hidden="true"
							className="hidden h-3.5 w-px bg-line-dark sm:block"
						/>
						<Link className={`${topLinkClass} max-sm:hidden`} href="/entrega">
							<Truck aria-hidden="true" className="size-4 text-on-dark-muted" />
							Entrega e pagamento
						</Link>
					</div>
				</div>
			</div>
			<HeaderBar nav={nav} />
			<DeptNav nav={nav} />
		</>
	);
}
