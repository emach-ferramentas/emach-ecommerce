import { cn } from "@emach/ui/lib/utils";
import { ArrowRight } from "lucide-react";

import { EmachLinkButton } from "@/components/emach-button";

export function CartEmpty({
	centered = false,
	onNavigate,
}: {
	centered?: boolean;
	onNavigate?: () => void;
}) {
	return (
		<div
			className={cn(
				"grid gap-3 py-9",
				centered ? "justify-items-center text-center" : "justify-items-start"
			)}
		>
			<p className="font-bold text-[18px] text-ink">Seu carrinho está vazio.</p>
			<p className="text-ink-2">Comece pelo serviço da sua obra.</p>
			<EmachLinkButton href="/catalog" onClick={onNavigate} variant="dark">
				Ver o catálogo
				<ArrowRight aria-hidden="true" className="size-[18px]" />
			</EmachLinkButton>
		</div>
	);
}
