"use client";

import { useRef, useState } from "react";

import { type CepAddress, lookupCepAction } from "@/lib/actions/lookup-cep";

// Autofill de endereço por CEP (#191). Dispara o lookup quando o CEP completa
// 8 dígitos (deduplicado por ref — colar/redigitar o mesmo CEP não re-consulta)
// e entrega os campos pro caller preencher no form. Progressive enhancement:
// falha silenciosa, o cliente segue digitando à mão.
export function useCepAutofill(onFill: (address: CepAddress) => void) {
	const [loading, setLoading] = useState(false);
	const lastCep = useRef<string | null>(null);

	// Fire-and-forget: retorna void pro caller usar direto em onChange sem
	// promise flutuante (noVoid). Falha da action já é silenciosa por contrato.
	function maybeLookup(rawCep: string): void {
		const cep = rawCep.replace(/\D/g, "");
		if (cep.length !== 8 || cep === lastCep.current) {
			return;
		}
		lastCep.current = cep;
		setLoading(true);
		lookupCepAction(cep)
			.then((result) => {
				if (result.ok) {
					onFill(result.data);
				}
			})
			.catch(() => {
				// Action não lança por contrato; guarda contra falha de rede do RSC.
			})
			.finally(() => setLoading(false));
	}

	return { loading, maybeLookup };
}
