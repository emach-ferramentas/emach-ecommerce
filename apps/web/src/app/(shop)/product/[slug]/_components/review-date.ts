const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
	timeZone: "America/Sao_Paulo",
	day: "2-digit",
	month: "short",
	year: "numeric",
});
const TRAILING_DOT = /\.$/u;

export function formatReviewDate(date: Date): string {
	return DATE_FORMATTER.format(date).replace(TRAILING_DOT, "").toUpperCase();
}
