// `tool_variant.price_amount` é anulável desde o sync #216: o dashboard cria
// rascunhos sem preço e só exige o valor ao ativar. A loja trata variante sem
// preço como NÃO vendável — mesma barreira que `visibleOnSite=false`: some da
// PDP, bloqueia cupom, é pulada na revalidação e derruba o place-order.

export type PricedVariant<T extends { priceAmount: string | null }> = T & {
	priceAmount: string;
};

export function hasPrice<T extends { priceAmount: string | null }>(
	variant: T
): variant is PricedVariant<T> {
	return variant.priceAmount !== null;
}
