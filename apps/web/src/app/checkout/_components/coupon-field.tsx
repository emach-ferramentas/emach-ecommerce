"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { applyCouponAction } from "@/app/checkout/_actions/apply-coupon";
import type { CouponCartItem } from "@/app/checkout/_lib/coupon-schema";
import { EmachButton } from "@/components/emach-button";
import { Field } from "@/components/field";

interface CouponFieldProps {
	applied: { code: string; discountCents: number } | null;
	cartItems: CouponCartItem[];
	onApplied: (value: { code: string; discountCents: number }) => void;
	onRemoved: () => void;
}

export function CouponField({
	applied,
	cartItems,
	onApplied,
	onRemoved,
}: CouponFieldProps) {
	const [code, setCode] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const apply = async () => {
		const trimmed = code.trim();
		if (!trimmed) {
			return;
		}
		setLoading(true);
		setError(null);
		const result = await applyCouponAction({ code: trimmed, cartItems });
		setLoading(false);
		if (result.ok) {
			onApplied({
				code: trimmed.toUpperCase(),
				discountCents: result.discountCents,
			});
			setCode("");
		} else {
			setError(result.error);
		}
	};

	if (applied) {
		return (
			<div className="flex items-center justify-between gap-3 rounded-[3px] border border-line bg-paper py-1 pr-1 pl-3 text-[15px] text-ink">
				<span>
					Cupom <strong>{applied.code}</strong> aplicado
				</span>
				<EmachButton
					aria-label="Remover cupom"
					className="px-3"
					icon={<X aria-hidden="true" className="size-4" />}
					onClick={onRemoved}
					variant="link"
				>
					Remover
				</EmachButton>
			</div>
		);
	}

	return (
		<Field
			error={error ? [error] : undefined}
			id="coupon-code"
			label="Cupom de desconto"
		>
			{(control) => (
				<div className="flex gap-2">
					<input
						{...control}
						className="emach-input min-w-0 flex-1 uppercase"
						onChange={(e) => setCode(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								apply();
							}
						}}
						placeholder="Inserir código"
						value={code}
					/>
					<EmachButton
						className="min-h-12"
						disabled={code.trim().length === 0}
						isLoading={loading}
						onClick={apply}
						variant="line"
					>
						Aplicar
					</EmachButton>
				</div>
			)}
		</Field>
	);
}
