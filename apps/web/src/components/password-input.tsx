"use client";

import { cn } from "@emach/ui/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { type InputHTMLAttributes, useState } from "react";

export function PasswordInput({
	className,
	...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
	const [isVisible, setIsVisible] = useState(false);

	return (
		<div className="relative">
			<input
				{...inputProps}
				className={cn("emach-input", className)}
				style={{ paddingRight: "44px" }}
				type={isVisible ? "text" : "password"}
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
