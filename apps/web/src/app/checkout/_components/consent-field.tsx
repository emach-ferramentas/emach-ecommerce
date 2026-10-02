"use client";

import { Checkbox } from "@emach/ui/components/checkbox";
import { CircleAlert } from "lucide-react";
import { errorMessages, type FieldErrors } from "@/components/field";

interface ConsentFieldProps {
	checked: boolean;
	errors: FieldErrors;
	id: string;
	label: string;
	onChange: (v: boolean) => void;
	required?: boolean;
	/** `field.state.meta.isTouched`: o TanStack marca ao mudar a caixa e no envio. */
	touched: boolean;
}

export function ConsentField({
	checked,
	errors,
	id,
	label,
	onChange,
	required = false,
	touched,
}: ConsentFieldProps) {
	const messages = touched ? errorMessages(errors) : [];
	return (
		<div>
			<label
				className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink"
				htmlFor={id}
			>
				<Checkbox
					checked={checked}
					id={id}
					onCheckedChange={(v) => onChange(v === true)}
				/>
				<span>
					{label}
					{required && (
						<span
							aria-label="obrigatório"
							className="ml-1 text-ink-muted"
							role="img"
						>
							*
						</span>
					)}
				</span>
			</label>
			{messages.map((message) => (
				<p
					className="flex items-center gap-1.5 pl-[30px] text-[13px] text-error-text"
					key={message}
				>
					<CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
					{message}
				</p>
			))}
		</div>
	);
}
