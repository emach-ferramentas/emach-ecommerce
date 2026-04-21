import { CreditCard, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { CategoryTile } from "@/components/category-tile";
import { EmachButton } from "@/components/emach-button";
import { ProductCard } from "@/components/product-card";
import { SectionLabel } from "@/components/section-label";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { categories, products } from "@/lib/mock-data";

const TRUST_ITEMS = [
	{ icon: Truck, title: "Frete grátis", sub: "Acima de R$ 299" },
	{
		icon: ShieldCheck,
		title: "2 anos de garantia",
		sub: "Toda linha profissional",
	},
	{ icon: CreditCard, title: "12× sem juros", sub: "No cartão" },
	{ icon: RotateCcw, title: "30 dias para troca", sub: "Sem burocracia" },
];

const STATS = [
	{ n: "200+", l: "Horas de teste" },
	{ n: "2 anos", l: "Garantia total" },
	{ n: "98%", l: "Aprovação" },
	{ n: "50+", l: "Cidades" },
	{ n: "24/7", l: "Suporte" },
	{ n: "12×", l: "Sem juros" },
];

const featured = products.slice(0, 4);
const promos = products.filter((p) => p.originalPrice);

export default function HomePage() {
	return (
		<>
			<SiteHeader />

			<main>
				{/* ---- HERO: Cinema variant ---- */}
				<section
					className="relative h-[640px] overflow-hidden text-white"
					style={{ background: "#000" }}
				>
					<div
						aria-hidden="true"
						className="absolute inset-0"
						style={{
							background:
								"radial-gradient(ellipse at 70% 40%, #2a2a2a 0%, #0a0a0a 60%, #000 100%)",
						}}
					/>
					<div
						aria-hidden="true"
						className="absolute inset-0"
						style={{
							background:
								"repeating-linear-gradient(35deg, transparent 0 40px, rgba(255,255,255,0.02) 40px 80px)",
						}}
					/>
					{/* Hero product photo */}
					<div
						aria-hidden="true"
						className="absolute top-1/2 right-[-4%] aspect-square w-[56%] max-w-[720px] -translate-y-1/2"
						style={{
							opacity: 0.72,
							maskImage:
								"radial-gradient(ellipse at center, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)",
						}}
					>
						<Image
							alt=""
							className="object-contain"
							fill
							priority
							sizes="720px"
							src="/images/hero-tools.png"
						/>
					</div>

					<div
						className="relative flex h-full flex-col justify-center gap-6 px-20"
						style={{ maxWidth: 1440, margin: "0 auto" }}
					>
						<div className="flex items-center gap-3.5">
							<div
								className="h-0.5 w-12"
								style={{ background: "var(--emach-red)" }}
							/>
							<SectionLabel tone="light">
								Coleção 2026 · Linha Profissional
							</SectionLabel>
						</div>

						<h1
							className="m-0 max-w-[780px] font-medium leading-[0.95]"
							style={{
								fontFamily: "var(--font-display)",
								fontSize: "clamp(44px, 6vw, 84px)",
								letterSpacing: "-0.01em",
								textWrap: "balance",
							}}
						>
							Ferramentas
							<br />
							feitas para{" "}
							<span style={{ color: "var(--emach-red)" }}>trabalhar</span>.
						</h1>

						<p
							className="max-w-[520px] text-[17px] leading-relaxed"
							style={{ color: "rgba(255,255,255,0.75)" }}
						>
							Desempenho industrial para obras, oficinas e profissionais que não
							negociam com qualidade.
						</p>

						<div className="mt-2 flex gap-3">
							<Link href="/catalog">
								<EmachButton size="lg" variant="primary">
									Ver Catálogo
								</EmachButton>
							</Link>
							<Link href="/catalog?cat=eletricas">
								<EmachButton size="lg" variant="outline-light">
									Elétricas
								</EmachButton>
							</Link>
						</div>
					</div>

					{/* Bottom trust strip inside hero */}
					<div
						className="absolute right-0 bottom-0 left-0 flex justify-between px-10 py-4"
						style={{
							borderTop: "1px solid rgba(255,255,255,0.1)",
							fontFamily: "var(--font-display)",
							fontSize: 11,
							letterSpacing: "0.2em",
							color: "rgba(255,255,255,0.55)",
						}}
					>
						<div>ENTREGA EM TODO BRASIL</div>
						<div>12× SEM JUROS</div>
						<div>GARANTIA 2 ANOS</div>
						<div>SUPORTE 24/7</div>
					</div>
				</section>

				{/* ---- Trust strip ---- */}
				<div
					className="bg-white"
					style={{ borderBottom: "1px solid var(--border)" }}
				>
					<div
						className="mx-auto grid grid-cols-4 gap-6 px-10 py-[22px]"
						style={{ maxWidth: 1440 }}
					>
						{TRUST_ITEMS.map((f) => (
							<div className="flex items-center gap-3" key={f.title}>
								<div
									className="flex items-center justify-center"
									style={{
										width: 36,
										height: 36,
										background: "var(--gray-10)",
									}}
								>
									<f.icon size={18} />
								</div>
								<div>
									<div className="font-semibold text-[13px]">{f.title}</div>
									<div
										className="text-[12px]"
										style={{ color: "var(--gray-60)" }}
									>
										{f.sub}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* ---- Categories ---- */}
				<section
					className="mx-auto px-[56px] py-[72px]"
					style={{ maxWidth: 1440 }}
				>
					<div className="mb-8 flex items-end justify-between">
						<div>
							<SectionLabel tone="accent">01 · Categorias</SectionLabel>
							<h2
								className="m-0 mt-2.5 font-medium"
								style={{
									fontFamily: "var(--font-display)",
									fontSize: 44,
									letterSpacing: "-0.01em",
								}}
							>
								Explorar por categoria
							</h2>
						</div>
						<Link
							className="pb-0.5 font-semibold text-[13px]"
							href="/catalog"
							style={{ borderBottom: "2px solid var(--emach-red)" }}
						>
							Ver todas
						</Link>
					</div>

					<div className="grid grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-6">
						<div className="row-span-2">
							<CategoryTile category={categories[0]} size="full" />
						</div>
						<CategoryTile category={categories[1]} />
						<CategoryTile category={categories[2]} />
						<CategoryTile category={categories[3]} />
						<CategoryTile category={categories[4]} />
					</div>
				</section>

				{/* ---- Promos ---- */}
				{promos.length > 0 && (
					<section
						className="px-[56px] py-[72px]"
						style={{ background: "var(--gray-10)" }}
					>
						<div className="mx-auto" style={{ maxWidth: 1440 }}>
							<div className="mb-8 flex items-end justify-between">
								<div>
									<SectionLabel tone="accent">02 · Ofertas</SectionLabel>
									<h2
										className="m-0 mt-2.5 font-medium"
										style={{ fontFamily: "var(--font-display)", fontSize: 44 }}
									>
										Promoções da semana
									</h2>
								</div>
								<Link
									className="pb-0.5 font-semibold text-[13px]"
									href="/catalog"
									style={{ borderBottom: "2px solid var(--emach-red)" }}
								>
									Ver todos
								</Link>
							</div>
							<div className="grid grid-cols-4 gap-6">
								{promos.map((p) => (
									<ProductCard key={p.id} product={p} />
								))}
							</div>
						</div>
					</section>
				)}

				{/* ---- Editorial banner ---- */}
				<section
					className="text-white"
					style={{ background: "#000", padding: 0 }}
				>
					<div
						className="mx-auto grid grid-cols-2"
						style={{ maxWidth: 1440, minHeight: 440 }}
					>
						<div className="flex flex-col justify-center gap-5 px-20 py-[80px]">
							<SectionLabel tone="accent">Feito para durar</SectionLabel>
							<h2
								className="m-0 font-medium leading-[1.02]"
								style={{
									fontFamily: "var(--font-display)",
									fontSize: 48,
									letterSpacing: "-0.01em",
								}}
							>
								Engenharia que
								<br />
								não abandona você
								<br />
								no meio da obra.
							</h2>
							<p
								className="max-w-[440px] text-[16px] leading-relaxed"
								style={{ color: "rgba(255,255,255,0.7)" }}
							>
								Cada ferramenta EMACH passa por 200+ horas de testes em campo
								antes de chegar ao catálogo.
							</p>
							<div>
								<EmachButton size="lg" variant="outline-light">
									Conheça a marca
								</EmachButton>
							</div>
						</div>

						<div
							className="relative"
							style={{
								background: "linear-gradient(135deg, #1a1a1a, #000)",
								borderLeft: "3px solid var(--emach-red)",
							}}
						>
							<div
								className="absolute inset-0 grid items-center p-10"
								style={{
									gridTemplateColumns: "repeat(3, 1fr)",
									alignContent: "center",
								}}
							>
								{STATS.map((s, i) => (
									<div
										key={s.n}
										style={{
											padding: 20,
											borderTop:
												i > 2 ? "1px solid rgba(255,255,255,0.1)" : "none",
											borderRight:
												i % 3 < 2 ? "1px solid rgba(255,255,255,0.1)" : "none",
										}}
									>
										<div
											className="font-medium text-white"
											style={{
												fontFamily: "var(--font-display)",
												fontSize: 32,
											}}
										>
											{s.n}
										</div>
										<div
											className="mt-1 text-[11px] uppercase tracking-[0.14em]"
											style={{ color: "rgba(255,255,255,0.55)" }}
										>
											{s.l}
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</section>

				{/* ---- Featured products ---- */}
				<section
					className="mx-auto px-[56px] py-[72px]"
					style={{ maxWidth: 1440 }}
				>
					<div className="mb-8">
						<SectionLabel tone="accent">03 · Em destaque</SectionLabel>
						<h2
							className="m-0 mt-2.5 font-medium"
							style={{ fontFamily: "var(--font-display)", fontSize: 44 }}
						>
							Selecionados pela equipe
						</h2>
					</div>
					<div
						className="grid gap-6"
						style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
					>
						{featured.map((p) => (
							<ProductCard key={p.id} product={p} />
						))}
					</div>
				</section>
			</main>

			<SiteFooter />
		</>
	);
}
