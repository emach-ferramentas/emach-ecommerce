"use client";

import {
	Sheet,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@emach/ui/components/sheet";
import { cn } from "@emach/ui/lib/utils";
import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmachButton } from "@/components/emach-button";
import { createReviewAction } from "../../_actions/reviews";

const STARS = [1, 2, 3, 4, 5] as const;

function StarInput({
	value,
	onChange,
}: {
	value: number;
	onChange: (v: number) => void;
}) {
	const [hover, setHover] = useState(0);
	const clearHover = () => setHover(0);
	return (
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: onMouseLeave só limpa o hover visual; a interação real está nos <button> filhos
		<fieldset
			aria-label="Nota do produto"
			className="flex gap-1"
			onMouseLeave={clearHover}
		>
			{STARS.map((n) => (
				<button
					aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
					aria-pressed={value === n}
					className="flex min-h-11 min-w-11 items-center justify-center"
					key={n}
					onClick={() => onChange(n)}
					onMouseEnter={() => setHover(n)}
					type="button"
				>
					<Star
						className={cn(
							"h-7 w-7 transition-colors",
							(hover || value) >= n
								? "fill-emach-red text-emach-red"
								: "text-gray-50"
						)}
						strokeWidth={1.5}
					/>
				</button>
			))}
		</fieldset>
	);
}

export function ReviewSheet({
	open,
	onOpenChange,
	orderId,
	toolId,
	productName,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	orderId: string;
	productName: string;
	toolId: string;
}) {
	const [rating, setRating] = useState(0);
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [pending, startTransition] = useTransition();

	function reset() {
		setRating(0);
		setTitle("");
		setBody("");
	}

	// Sempre começa em branco ao reabrir (descarta rascunho ao fechar).
	function handleOpenChange(next: boolean) {
		if (!next) {
			reset();
		}
		onOpenChange(next);
	}

	function submit() {
		if (rating < 1) {
			toast.error("Escolha uma nota");
			return;
		}
		startTransition(async () => {
			const res = await createReviewAction({
				orderId,
				toolId,
				rating,
				title,
				body,
			});
			if (res.ok) {
				toast.success("Avaliação enviada para moderação");
				handleOpenChange(false);
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<Sheet onOpenChange={handleOpenChange} open={open}>
			<SheetContent className="flex flex-col gap-0" side="right">
				<SheetHeader>
					<SheetTitle className="font-display">Avaliar produto</SheetTitle>
				</SheetHeader>
				<div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
					<div className="font-semibold text-[14px] text-near-black">
						{productName}
					</div>
					<div>
						<div className="mb-2 font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
							Sua nota
						</div>
						<StarInput onChange={setRating} value={rating} />
					</div>
					<label className="block">
						<span className="mb-1.5 block font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
							Título (opcional)
						</span>
						<input
							className="h-10 w-full border border-border px-3 text-[14px] outline-none focus:border-near-black focus-visible:outline-2 focus-visible:outline-emach-red focus-visible:outline-offset-2"
							maxLength={120}
							onChange={(e) => setTitle(e.target.value)}
							value={title}
						/>
					</label>
					<label className="block">
						<span className="mb-1.5 block font-display font-semibold text-[11px] text-gray-60 uppercase tracking-[0.14em]">
							Sua avaliação
						</span>
						<textarea
							className="min-h-[120px] w-full border border-border p-3 text-[14px] outline-none focus:border-near-black focus-visible:outline-2 focus-visible:outline-emach-red focus-visible:outline-offset-2"
							maxLength={2000}
							onChange={(e) => setBody(e.target.value)}
							value={body}
						/>
					</label>
				</div>
				<SheetFooter className="flex-row gap-2">
					<EmachButton
						onClick={() => handleOpenChange(false)}
						size="md"
						variant="ghost"
					>
						Cancelar
					</EmachButton>
					<EmachButton
						disabled={pending}
						onClick={submit}
						size="md"
						variant="primary"
					>
						{pending ? "Enviando..." : "Enviar avaliação"}
					</EmachButton>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
