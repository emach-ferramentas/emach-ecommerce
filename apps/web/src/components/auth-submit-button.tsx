"use client";

import { EmachButton } from "@/components/emach-button";

interface AuthSubmitButtonProps {
	/** `canSubmit` do TanStack Form — já fica falso durante a submissão. */
	canSubmit: boolean;
	isSubmitting: boolean;
	label: string;
	pendingLabel: string;
}

/**
 * Submit dos fluxos de auth (entrar, criar conta, recuperar e redefinir senha).
 * Existe porque as quatro telas carregavam a mesma cópia manual do estilo
 * `primary` — divergindo do primitivo a cada ajuste.
 */
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
			size="md"
			type="submit"
			variant="primary"
		>
			{isSubmitting ? pendingLabel : label}
		</EmachButton>
	);
}
