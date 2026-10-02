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
					className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[3px] focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
					key={n}
					onClick={() => onChange(n)}
					onMouseEnter={() => setHover(n)}
					type="button"
				>
					<Star
						aria-hidden="true"
						className={cn(
							"size-7 transition-colors",
							(hover || value) >= n ? "fill-ink text-ink" : "text-line-strong"
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
					<SheetTitle>Avaliar produto</SheetTitle>
				</SheetHeader>
				<div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
					<div className="font-semibold text-[15px] text-ink">
						{productName}
					</div>
					<div>
						<div className="emach-field__label mb-1">Sua nota</div>
						<StarInput onChange={setRating} value={rating} />
					</div>
					<label className="emach-field">
						<span className="emach-field__label">Título (opcional)</span>
						<input
							className="emach-input"
							maxLength={120}
							onChange={(e) => setTitle(e.target.value)}
							value={title}
						/>
					</label>
					<label className="emach-field">
						<span className="emach-field__label">Sua avaliação</span>
						<textarea
							className="emach-textarea"
							maxLength={2000}
							onChange={(e) => setBody(e.target.value)}
							value={body}
						/>
					</label>
				</div>
				<SheetFooter className="flex-row items-center justify-end gap-4 border-line border-t bg-canteiro px-5">
					<EmachButton
						onClick={() => handleOpenChange(false)}
						size="md"
						variant="link"
					>
						Cancelar
					</EmachButton>
					<EmachButton
						disabled={pending}
						onClick={submit}
						size="md"
						variant="dark"
					>
						{pending ? "Enviando..." : "Enviar avaliação"}
					</EmachButton>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
