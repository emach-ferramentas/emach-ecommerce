import Link from "next/link";

interface BreadcrumbProps {
	category: { slug: string; name: string } | null;
	productName: string;
}

/** Trilha estrutural da PDP; no mobile colapsa pra "‹ Categoria". */
export function Breadcrumb({ category, productName }: BreadcrumbProps) {
	return (
		<nav aria-label="Navegação estrutural" className="text-[12px] text-gray-60">
			<ol className="hidden flex-wrap items-center gap-1.5 sm:flex">
				<li>
					<Link className="transition-colors hover:text-near-black" href="/">
						Início
					</Link>
				</li>
				<li aria-hidden="true">/</li>
				<li>
					<Link
						className="transition-colors hover:text-near-black"
						href="/catalog"
					>
						Catálogo
					</Link>
				</li>
				{category && (
					<>
						<li aria-hidden="true">/</li>
						<li>
							<Link
								className="transition-colors hover:text-near-black"
								href={`/catalog?cat=${category.slug}`}
							>
								{category.name}
							</Link>
						</li>
					</>
				)}
				<li aria-hidden="true">/</li>
				<li aria-current="page" className="font-semibold text-near-black">
					{productName}
				</li>
			</ol>
			<div className="sm:hidden">
				<Link
					className="font-semibold text-near-black"
					href={category ? `/catalog?cat=${category.slug}` : "/catalog"}
				>
					‹ {category?.name ?? "Catálogo"}
				</Link>
			</div>
		</nav>
	);
}
