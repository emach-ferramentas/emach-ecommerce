import { Check } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { PageHead } from "@/components/page-head";

const ACCOUNT_PERKS = [
	"Acompanhe cada pedido e o status dele",
	"Endereço salvo para a próxima compra",
	"Compre de novo um pedido anterior",
] as const;

export function LoginShell({ children }: { children: ReactNode }) {
	return (
		<div className="shop-wrap pb-16 md:pb-24">
			<div className="grid items-start gap-10 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-16 xl:gap-24">
				<div className="w-full max-w-[440px]">
					<PageHead title="Entrar ou criar conta" />
					<div className="min-h-[480px]">{children}</div>
				</div>

				<aside
					aria-label="O que a conta guarda"
					className="overflow-hidden rounded-[5px] bg-canteiro lg:mt-10"
				>
					<div className="relative aspect-[3/2] bg-well max-lg:hidden">
						<Image
							alt="Profissional fixando uma chapa na parede de concreto com parafusadeira"
							className="object-cover"
							fill
							sizes="(min-width: 1280px) 640px, 50vw"
							src="/images/oficios/furar-e-parafusar.webp"
						/>
					</div>
					<div className="p-5 md:p-6">
						<h2 className="font-extrabold text-[17px] text-ink">
							Com a conta você
						</h2>
						<ul className="mt-3 flex flex-col gap-2.5 text-[15px] text-ink-2">
							{ACCOUNT_PERKS.map((perk) => (
								<li className="flex items-start gap-2.5" key={perk}>
									<Check
										aria-hidden="true"
										className="mt-0.5 size-[18px] shrink-0 text-ink"
									/>
									{perk}
								</li>
							))}
						</ul>
					</div>
				</aside>
			</div>
		</div>
	);
}
