export interface CountdownParts {
	days: number;
	done: boolean;
	hours: number;
	minutes: number;
	seconds: number;
}

/** Decompõe um intervalo em ms (alvo - agora) em d/h/m/s. <=0 vira "done". */
export function formatCountdown(remainingMs: number): CountdownParts {
	if (remainingMs <= 0) {
		return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
	}

	const totalSeconds = Math.floor(remainingMs / 1000);

	return {
		days: Math.floor(totalSeconds / 86_400),
		hours: Math.floor((totalSeconds % 86_400) / 3600),
		minutes: Math.floor((totalSeconds % 3600) / 60),
		seconds: totalSeconds % 60,
		done: false,
	};
}
