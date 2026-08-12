// Sinal GLOBAL de início de soft navigation do App Router (push/replace/
// traverse — cobre <Link>, router.push/replace e back/forward). O App Router
// não expõe evento de fim: quem detecta a chegada é o NavigationProgress
// (components/navigation-progress.tsx) via mudança de pathname/searchParams —
// por isso a URL de destino viaja no evento, para o componente descartar
// transições que não mudam nenhum dos dois (mesma URL, só hash).
export function onRouterTransitionStart(url: string) {
	window.dispatchEvent(new CustomEvent("emach:navstart", { detail: { url } }));
}
