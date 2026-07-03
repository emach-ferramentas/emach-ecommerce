/**
 * IP confiável do cliente a partir dos headers da request.
 *
 * Precedência:
 *  1. `x-real-ip` — IP real injetado pelo proxy confiável (Vercel).
 *  2. ÚLTIMO elemento de `x-forwarded-for` — o hop adicionado pelo proxy.
 *     O PRIMEIRO elemento é controlado pelo cliente (spoofável) e nunca é usado.
 *  3. `null` se nenhum header estiver presente.
 *
 * Em dev local (sem proxy) o `x-forwarded-for` costuma ter um único elemento,
 * que é retornado como está.
 */
export function getClientIp(headers: Headers): string | null {
	const realIp = headers.get("x-real-ip")?.trim();
	if (realIp) {
		return realIp;
	}

	const forwarded = headers.get("x-forwarded-for");
	if (forwarded) {
		const hops = forwarded
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
		return hops.at(-1) ?? null;
	}

	return null;
}
