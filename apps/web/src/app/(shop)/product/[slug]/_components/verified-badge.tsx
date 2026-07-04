import { Check } from "lucide-react";

export function VerifiedBadge() {
	return (
		<span className="inline-flex items-center gap-1 border border-border px-1.5 py-0.5 font-display font-semibold text-[10.5px] text-gray-60 uppercase leading-none tracking-[0.1em]">
			<Check aria-hidden size={10} strokeWidth={2.5} />
			Compra verificada
		</span>
	);
}
