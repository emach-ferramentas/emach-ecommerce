"use client";

import { useEffect, useState } from "react";
import { type CountdownParts, formatCountdown } from "@/lib/countdown";

interface PromoCountdownProps {
	endsAt: string; // ISO — o server passa endsAt.toISOString()
}

const UNITS: Array<{ key: keyof Omit<CountdownParts, "done">; label: string }> =
	[
		{ key: "days", label: "dias" },
		{ key: "hours", label: "hrs" },
		{ key: "minutes", label: "min" },
		{ key: "seconds", label: "seg" },
	];

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

export function PromoCountdown({ endsAt }: PromoCountdownProps) {
	// Mount gate: o primeiro paint (server + hidratação) não calcula tempo,
	// evitando mismatch entre relógio do server e do client.
	const [parts, setParts] = useState<CountdownParts | null>(null);

	useEffect(() => {
		const target = new Date(endsAt).getTime();
		const tick = () => setParts(formatCountdown(target - Date.now()));
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [endsAt]);

	if (parts === null || parts.done) {
		// Pré-mount ou já encerrado: não mostra dígitos (a seção segue visível
		// até a próxima revalidação do server, que deixará de renderizá-la).
		return null;
	}

	return (
		<div className="flex flex-col gap-2">
			<span className="font-display text-[11px] text-white/55 uppercase tracking-[0.14em]">
				Termina em
			</span>
			<div
				aria-label="Tempo restante da oferta"
				className="flex items-start gap-3 tabular-nums"
			>
				{UNITS.map((u, i) => (
					<div className="flex items-start gap-3" key={u.key}>
						<div className="flex flex-col items-center">
							<span className="font-display font-medium text-[32px] text-emach-red leading-none">
								{pad(parts[u.key])}
							</span>
							<span className="mt-1 font-display text-[10px] text-white/45 uppercase tracking-[0.14em]">
								{u.label}
							</span>
						</div>
						{i < UNITS.length - 1 && (
							<span
								aria-hidden="true"
								className="font-display text-[28px] text-white/25 leading-none"
							>
								:
							</span>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
