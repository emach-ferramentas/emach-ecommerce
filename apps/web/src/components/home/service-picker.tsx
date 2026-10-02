import { cn } from "@emach/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { fmtBRL } from "@/lib/format";
import { listPriceCents } from "@/lib/list-price";
import type { ServiceSummary } from "@/lib/services";

/** Itens listados por cartão no desktop; o resto fica em "Ver os N produtos". */
const LIST_LIMIT = 4;

function plural(n: number, one: string, many: string) {
	return `${n} ${n === 1 ? one : many}`;
}

function ServiceCard({ service }: { service: ServiceSummary }) {
	const listed = service.preview.slice(0, LIST_LIMIT);
	return (
		<article className="group flex flex-col overflow-hidden rounded-[5px] border border-line bg-paper transition-[border-color,box-shadow] duration-200 ease-out hover:border-line-strong hover:shadow-pop">
			<Link
				className="relative block aspect-square overflow-hidden bg-grafite text-white no-underline sm:aspect-video lg:aspect-[4/3]"
				href={service.href}
			>
				{service.imageSrc && (
					<Image
						alt=""
						className="object-cover transition-transform duration-[600ms] ease-out-expo group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
						fill
						sizes="(min-width: 1296px) 300px, (min-width: 1024px) 25vw, 50vw"
						src={service.imageSrc}
					/>
				)}
				<span
					aria-hidden="true"
					className="absolute inset-0 bg-[linear-gradient(180deg,rgba(19,21,24,0)_38%,rgba(19,21,24,0.86)_100%)]"
				/>
				<h3 className="absolute inset-x-2.5 bottom-2.5 z-[1] font-display font-extrabold text-[22px] uppercase leading-[0.95] md:inset-x-4 md:bottom-3.5 md:text-[31px]">
					{service.name}
				</h3>
			</Link>
			<p className="flex flex-col gap-px px-2.5 pt-2.5 pb-1.5 text-[12.5px] text-ink-muted md:border-line md:border-b md:px-4 md:py-3 md:text-[13.5px]">
				<span>
					{plural(service.productCount, "produto", "produtos")},{" "}
					{service.inStockCount} em estoque
				</span>
				<strong className="whitespace-nowrap font-extrabold text-[14.5px] text-ink tabular-nums md:text-[18px]">
					{service.fromPriceCents === null ? (
						"Esgotado"
					) : (
						<>
							<small className="font-semibold text-[12.5px] text-ink-muted">
								a partir de{" "}
							</small>
							{fmtBRL(service.fromPriceCents)}
						</>
					)}
				</strong>
			</p>

			<ul className="flex-1 max-md:hidden">
				{listed.map((tool) => {
					const price = listPriceCents(tool);
					return (
						<li className="border-line border-b last:border-b-0" key={tool.id}>
							<Link
								className={cn(
									"grid min-h-[60px] grid-cols-[48px_minmax(0,1fr)] grid-rows-[auto_auto] items-center gap-x-3 px-4 py-2 text-ink no-underline hover:bg-canteiro [&:hover_.name]:underline",
									!tool.inStock && "text-ink-muted"
								)}
								href={`/product/${tool.slug}`}
							>
								<span className="relative row-span-2 size-12 overflow-hidden rounded-[3px] bg-well">
									{tool.primaryImage && (
										<Image
											alt=""
											className={cn(
												"object-contain p-1 mix-blend-multiply",
												!tool.inStock && "opacity-50 grayscale"
											)}
											fill
											sizes="48px"
											src={tool.primaryImage.url}
										/>
									)}
								</span>
								<span className="name line-clamp-2 self-end font-semibold text-[14px] leading-snug">
									{tool.name}
								</span>
								<b
									className={cn(
										"self-start whitespace-nowrap tabular-nums",
										tool.inStock && price !== null
											? "font-extrabold text-[14.5px]"
											: "font-bold text-[12.5px] text-off"
									)}
								>
									{tool.inStock && price !== null ? fmtBRL(price) : "Esgotado"}
								</b>
							</Link>
						</li>
					);
				})}
			</ul>

			<div aria-hidden="true" className="flex gap-1 px-2.5 pb-2.5 md:hidden">
				{listed.map((tool) => (
					<span
						className="relative size-9 overflow-hidden rounded-[3px] bg-well"
						key={tool.id}
					>
						{tool.primaryImage && (
							<Image
								alt=""
								className={cn(
									"object-contain p-0.5 mix-blend-multiply",
									!tool.inStock && "opacity-45 grayscale"
								)}
								fill
								sizes="36px"
								src={tool.primaryImage.url}
							/>
						)}
					</span>
				))}
			</div>

			<div className="px-4 pt-3 pb-4 max-md:hidden">
				<Link
					className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[3px] bg-grafite px-4 font-bold text-[15px] text-on-dark no-underline hover:bg-black"
					href={service.href}
				>
					{service.productCount === 1
						? "Ver o produto"
						: `Ver os ${service.productCount} produtos`}
					<ChevronRight aria-hidden="true" className="size-5" />
				</Link>
			</div>
		</article>
	);
}

/** "Qual é a sua obra hoje?": um cartão por ofício, com o que a loja tem para ele. */
export function ServicePicker({ services }: { services: ServiceSummary[] }) {
	return (
		<section
			aria-labelledby="obra-titulo"
			className="py-7 pb-9 md:pt-12 md:pb-14"
		>
			<div className="shop-wrap">
				<div className="mb-4 grid gap-2 md:mb-[26px] lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-end lg:gap-8">
					<h2
						className="font-display font-extrabold text-[2.85rem] uppercase leading-[0.92] md:text-[clamp(2.7rem,1.4rem+3.6vw,4.6rem)]"
						id="obra-titulo"
					>
						Qual é a sua obra hoje?
					</h2>
					<p className="text-[15.5px] text-ink-2 leading-normal md:pb-1.5 md:text-[17px]">
						Escolha o serviço e veja só as ferramentas e os acessórios da loja
						que servem para ele, com preço e estoque de hoje.
					</p>
				</div>
				<div className="grid grid-cols-2 gap-2.5 md:gap-4 xl:grid-cols-4">
					{services.map((service) => (
						<ServiceCard key={service.slug} service={service} />
					))}
				</div>
			</div>
		</section>
	);
}
