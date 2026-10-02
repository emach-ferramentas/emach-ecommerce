const CATEGORY_PREFIX = /^ferramentas\s+/i;

/** Rótulo curto da categoria na linha de departamentos: "Ferramentas à bateria" vira "À bateria". */
export function navShortLabel(name: string): string {
	const short = name.replace(CATEGORY_PREFIX, "").trim();
	if (short.length === 0) {
		return name;
	}
	return short.charAt(0).toLocaleUpperCase("pt-BR") + short.slice(1);
}
