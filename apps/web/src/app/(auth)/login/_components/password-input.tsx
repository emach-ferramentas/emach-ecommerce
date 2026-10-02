"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface PasswordInputProps {
	id: string;
	name: string;
	onBlur: () => void;
	onChange: (value: string) => void;
	placeholder?: string;
	value: string;
}

export function PasswordInput({
	id,
	name,
	value,
	onBlur,
	onChange,
	placeholder,
}: PasswordInputProps) {
	const [isVisible, setIsVisible] = useState(false);

	return (
		<div className="relative">
			<input
				className="emach-input"
				id={id}
				name={name}
				onBlur={onBlur}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				style={{ paddingRight: "44px" }}
				type={isVisible ? "text" : "password"}
				value={value}
			/>
			<button
				aria-label={isVisible ? "Ocultar senha" : "Mostrar senha"}
				className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:-outline-offset-2"
				onClick={() => setIsVisible((v) => !v)}
				type="button"
			>
				{isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
			</button>
		</div>
	);
}
