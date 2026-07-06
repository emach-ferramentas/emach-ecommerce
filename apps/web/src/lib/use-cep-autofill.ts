"use client";

import { useRef, useState } from "react";

import { type CepAddress, lookupCepAction } from "@/lib/actions/lookup-cep";

// Autofill de endereço por CEP (#191). Dispara o lookup quando o CEP completa
// 8 dígitos (deduplicado por ref — colar/redigitar o mesmo CEP não re-consulta)
// e entrega os campos pro caller preencher no form. Falha de infra é silenciosa
// (o cliente segue digitando à mão), mas CEP INEXISTENTE vira `notFound` — a
// Frenet cota preço real até pra CEP fora de faixa, então sem esse aviso um
// CEP digitado errado atravessa checkout e anti-fraude sem nenhum sinal.
export function useCepAutofill(onFill: (address: CepAddress) => void) {
	const [loading, setLoading] = useState(false);
	const [notFound, setNotFound] = useState(false);
	const lastCep = useRef<string | null>(null);
	const lastNotFound = useRef(false);

	// Fire-and-forget: retorna void pro caller usar direto em onChange sem
	// promise flutuante (noVoid). Falha da action já é silenciosa por contrato.
	function maybeLookup(rawCep: string): void {
		const cep = rawCep.replace(/\D/g, "");
		if (cep.length !== 8) {
			// CEP incompleto (usuário editando) — aviso anterior deixa de valer.
			setNotFound(false);
			return;
		}
		if (cep === lastCep.current) {
			// Dedup é de REDE, não de UI: redigitar o mesmo CEP inexistente
			// (backspace + mesmo dígito) precisa reexibir o aviso que o ramo
			// de CEP incompleto acabou de apagar.
			setNotFound(lastNotFound.current);
			return;
		}
		lastCep.current = cep;
		lastNotFound.current = false;
		setLoading(true);
		setNotFound(false);
		lookupCepAction(cep)
			.then((result) => {
				if (result.ok) {
					onFill(result.data);
					return;
				}
				if (result.reason === "not_found") {
					lastNotFound.current = true;
					setNotFound(true);
				}
			})
			.catch(() => {
				// Action não lança por contrato; guarda contra falha de rede do RSC.
			})
			.finally(() => setLoading(false));
	}

	return { loading, notFound, maybeLookup };
}
