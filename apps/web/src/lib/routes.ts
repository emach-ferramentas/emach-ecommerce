import type { Route } from "next";

// No `typedRoutes`, o `Route` sem parâmetro só cobre rota estática (o ramo
// dinâmico resolve para `never`), e é esse tipo que `Link`, `EmachLinkButton` e
// os campos `href` do app usam. O cast de cada rota dinâmica mora aqui, uma vez.

/** Categoria ou ofício do catálogo. */
export function catalogHref(slug: string): Route {
	// SAFETY: app/(shop)/catalog/[cat]/page.tsx define `/catalog/<segmento>`.
	return `/catalog/${slug}` as Route;
}

/** Detalhe do pedido na conta do cliente. */
export function accountOrderHref(orderId: string): Route {
	// SAFETY: app/dashboard/pedidos/[id]/page.tsx define `/dashboard/pedidos/<id>`.
	return `/dashboard/pedidos/${orderId}` as Route;
}

/** Pagamento do pedido na conta do cliente. */
export function accountOrderPayHref(orderId: string): Route {
	// SAFETY: app/dashboard/pedidos/[id]/pagar/page.tsx define a rota.
	return `/dashboard/pedidos/${orderId}/pagar` as Route;
}

/** Página do pedido pelo número público. */
export function orderHref(orderNumber: string): Route {
	// SAFETY: app/(shop)/pedidos/[number]/page.tsx define `/pedidos/<number>`.
	return `/pedidos/${orderNumber}` as Route;
}
