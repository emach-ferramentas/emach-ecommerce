"use client";

import { cn } from "@emach/ui/lib/utils";
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";
import { PasswordInput } from "./password-input";

export type FieldErrors = ReadonlyArray<{ message?: string } | undefined>;

export function errorMessages(errors: FieldErrors): string[] {
	return [
		...new Set(
			errors.flatMap((error) => (error?.message ? [error.message] : []))
		),
	];
}

export interface FieldControl {
	"aria-describedby"?: string;
	"aria-invalid"?: true;
	id: string;
}

interface FieldProps {
	children: (control: FieldControl) => ReactNode;
	error?: readonly string[];
	hint?: string;
	id: string;
	label: string;
}

export function Field({ children, error = [], hint, id, label }: FieldProps) {
	const hintId = `${id}-hint`;
	const errorId = `${id}-error`;
	const hasError = error.length > 0;
	const describedBy =
		[hint ? hintId : null, hasError ? errorId : null]
			.filter(Boolean)
			.join(" ") || undefined;

	return (
		<div className="emach-field">
			<label className="emach-field__label" htmlFor={id}>
				{label}
			</label>
			{children({
				"aria-describedby": describedBy,
				"aria-invalid": hasError ? true : undefined,
				id,
			})}
			{hint ? (
				<span className="emach-field__hint" id={hintId}>
					{hint}
				</span>
			) : null}
			{hasError ? (
				<div aria-live="polite" id={errorId} role="alert">
					{error.map((message) => (
						<span className="emach-field__error" key={message}>
							{message}
						</span>
					))}
				</div>
			) : null}
		</div>
	);
}

/**
 * Forma mínima de um campo string do TanStack Form. Estrutural: o FieldApi da
 * lib encaixa sem importar os genéricos dela.
 */
export interface StringFieldApi {
	handleBlur: () => void;
	handleChange: (value: string) => void;
	name: string;
	state: { meta: { errors: FieldErrors }; value: string };
}

type TextFieldProps = Omit<
	InputHTMLAttributes<HTMLInputElement>,
	"children" | "id" | "name" | "onBlur" | "onChange" | "value"
> & {
	field: StringFieldApi;
	hint?: string;
	id?: string;
	label: string;
	transform?: (raw: string) => string;
};

export function TextField({
	className,
	field,
	hint,
	id,
	label,
	transform,
	type,
	...inputProps
}: TextFieldProps) {
	return (
		<Field
			error={errorMessages(field.state.meta.errors)}
			hint={hint}
			id={id ?? field.name}
			label={label}
		>
			{(control) => {
				const props = {
					...inputProps,
					...control,
					name: field.name,
					onBlur: field.handleBlur,
					onChange: (e: ChangeEvent<HTMLInputElement>) =>
						field.handleChange(
							transform ? transform(e.target.value) : e.target.value
						),
					value: field.state.value,
				};
				return type === "password" ? (
					<PasswordInput {...props} className={className} />
				) : (
					<input
						{...props}
						className={cn("emach-input", className)}
						type={type}
					/>
				);
			}}
		</Field>
	);
}
