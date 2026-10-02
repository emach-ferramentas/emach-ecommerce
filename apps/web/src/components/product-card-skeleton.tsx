// Espelha a anatomia do ProductCard (foto quadrada em fundo neutro, estoque,
// nome, preço e botão) pra troca skeleton→dados não deslocar nada.
export function ProductCardSkeleton() {
	return (
		<div className="flex h-full flex-col overflow-hidden rounded-[5px] border border-line bg-paper">
			<div className="emach-shimmer aspect-square shrink-0 bg-well" />
			<div className="flex flex-1 animate-pulse flex-col gap-2 p-4">
				<div className="h-3 w-20 bg-canteiro-2" />
				<div className="h-4 w-4/5 bg-canteiro-2" />
				<div className="h-4 w-3/5 bg-canteiro-2" />
				<div className="mt-auto h-6 w-28 bg-canteiro-2" />
				<div className="h-11 w-full bg-canteiro-2" />
			</div>
		</div>
	);
}
