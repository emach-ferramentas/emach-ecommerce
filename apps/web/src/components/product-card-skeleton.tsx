// Espelha a anatomia real do ProductCard (card escuro, tile de imagem claro,
// label + nome + preço) pra troca skeleton→dados não deslocar nada. O tile usa
// .emach-shimmer; as linhas de texto pulsam como os demais skeletons.
export function ProductCardSkeleton() {
	return (
		<div className="flex h-full flex-col overflow-hidden rounded-[2px] border border-white/14 bg-near-black">
			<div className="emach-shimmer aspect-square shrink-0 bg-image-bg" />
			<div className="flex flex-1 animate-pulse flex-col gap-1 px-3 py-3.5">
				<div className="h-3 w-20 bg-white/10" />
				<div className="mt-1 h-4 w-4/5 bg-white/15" />
				<div className="mt-auto pt-2">
					<div className="h-4 w-24 bg-white/25" />
				</div>
			</div>
		</div>
	);
}
