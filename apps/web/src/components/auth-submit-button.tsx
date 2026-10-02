"use client";

import { EmachButton } from "@/components/emach-button";

interface AuthSubmitButtonProps {
	/** `canSubmit` do TanStack Form — já fica falso durante a submissão. */
	canSubmit: boolean;
	isSubmitting: boolean;
	label: string;
	pendingLabel: string;
}

export function AuthSubmitButton({
	canSubmit,
	isSubmitting,
	label,
	pendingLabel,
}: AuthSubmitButtonProps) {
	return (
		<EmachButton
			className="mt-2"
			disabled={!canSubmit}
			full
			isLoading={isSubmitting}
			size="lg"
			type="submit"
			variant="cta"
		>
			{isSubmitting ? pendingLabel : label}
		</EmachButton>
	);
}
