/** Clique que o browser deve tratar (nova aba/janela): botão não-primário ou modificador. */
export function isModifiedClick(e: {
	altKey: boolean;
	button: number;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}): boolean {
	return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}
