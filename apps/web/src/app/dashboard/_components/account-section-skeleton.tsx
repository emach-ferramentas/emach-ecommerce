/** Fallback do conteúdo de uma página da conta enquanto o dado chega. */
export function AccountSectionSkeleton() {
	return (
		<div aria-busy="true" className="animate-pulse space-y-4">
			<div className="h-48 rounded-[5px] border border-line bg-paper" />
			<div className="h-48 rounded-[5px] border border-line bg-paper" />
		</div>
	);
}
