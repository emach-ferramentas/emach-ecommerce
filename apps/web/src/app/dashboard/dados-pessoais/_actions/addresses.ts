"use server";

import { db } from "@emach/db";
import { clientAddress } from "@emach/db/schema/client";
import { onlyDigits } from "@emach/validators";
import { and, desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, ActionResultWith } from "@/lib/actions/types";
import { log } from "@/lib/evlog";
import { requireCurrentClient } from "@/lib/session";
import {
	type AddressInput,
	addressInputSchema,
} from "@/lib/validators/address";

const idSchema = z.object({ id: z.string().min(1) });
const updateSchema = addressInputSchema.extend({ id: z.string().min(1) });

function normalize(input: AddressInput) {
	return {
		label: input.label?.trim() || null,
		zipCode: onlyDigits(input.zipCode),
		street: input.street.trim(),
		number: input.number.trim(),
		complement: input.complement.trim() || null,
		neighborhood: input.neighborhood.trim(),
		city: input.city.trim(),
		state: input.state.trim().toUpperCase(),
	};
}

export async function createAddressAction(
	raw: AddressInput
): Promise<ActionResultWith<{ id: string }>> {
	const parsed = addressInputSchema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}

	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const fields = normalize(parsed.data);
	const id = crypto.randomUUID();

	try {
		await db.transaction(async (tx) => {
			const existing = await tx
				.select({ id: clientAddress.id })
				.from(clientAddress)
				.where(eq(clientAddress.clientId, clientId))
				.limit(1);

			const wantsDefault = parsed.data.isDefault === true;
			const isFirst = existing.length === 0;
			const shouldBeDefault = isFirst || wantsDefault;

			if (shouldBeDefault && !isFirst) {
				await tx
					.update(clientAddress)
					.set({ isDefault: false })
					.where(eq(clientAddress.clientId, clientId));
			}

			await tx.insert(clientAddress).values({
				id,
				clientId,
				recipient: session.user.name,
				country: "BR",
				isDefault: shouldBeDefault,
				...fields,
			});
		});

		revalidatePath("/dashboard/dados-pessoais");
		return { ok: true, data: { id } };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({ action: "create_address_failed", clientId, error: message });
		return { ok: false, error: "Não foi possível salvar o endereço" };
	}
}

export async function updateAddressAction(
	raw: AddressInput & { id: string }
): Promise<ActionResult> {
	const parsed = updateSchema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "Dados inválidos" };
	}

	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { id, isDefault, ...rest } = parsed.data;
	const fields = normalize(rest);

	try {
		await db.transaction(async (tx) => {
			const owned = await tx
				.select({ id: clientAddress.id })
				.from(clientAddress)
				.where(
					and(eq(clientAddress.id, id), eq(clientAddress.clientId, clientId))
				)
				.limit(1);
			if (owned.length === 0) {
				throw new Error("Endereço não encontrado");
			}

			if (isDefault === true) {
				await tx
					.update(clientAddress)
					.set({ isDefault: false })
					.where(
						and(eq(clientAddress.clientId, clientId), ne(clientAddress.id, id))
					);
			}

			await tx
				.update(clientAddress)
				.set({
					...fields,
					...(isDefault === true ? { isDefault: true } : {}),
				})
				.where(
					and(eq(clientAddress.id, id), eq(clientAddress.clientId, clientId))
				);
		});

		revalidatePath("/dashboard/dados-pessoais");
		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({
			action: "update_address_failed",
			clientId,
			addressId: id,
			error: message,
		});
		return { ok: false, error: "Não foi possível atualizar o endereço" };
	}
}

export async function deleteAddressAction(raw: {
	id: string;
}): Promise<ActionResult> {
	const parsed = idSchema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "ID inválido" };
	}

	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { id } = parsed.data;

	try {
		await db.transaction(async (tx) => {
			const rows = await tx
				.select({ isDefault: clientAddress.isDefault })
				.from(clientAddress)
				.where(
					and(eq(clientAddress.id, id), eq(clientAddress.clientId, clientId))
				)
				.limit(1);
			const row = rows[0];
			if (!row) {
				throw new Error("Endereço não encontrado");
			}

			await tx
				.delete(clientAddress)
				.where(
					and(eq(clientAddress.id, id), eq(clientAddress.clientId, clientId))
				);

			if (row.isDefault) {
				const next = await tx
					.select({ id: clientAddress.id })
					.from(clientAddress)
					.where(eq(clientAddress.clientId, clientId))
					.orderBy(desc(clientAddress.updatedAt))
					.limit(1);
				const nextId = next[0]?.id;
				if (nextId) {
					await tx
						.update(clientAddress)
						.set({ isDefault: true })
						.where(eq(clientAddress.id, nextId));
				}
			}
		});

		revalidatePath("/dashboard/dados-pessoais");
		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({
			action: "delete_address_failed",
			clientId,
			addressId: id,
			error: message,
		});
		return { ok: false, error: "Não foi possível excluir o endereço" };
	}
}

export async function setDefaultAddressAction(raw: {
	id: string;
}): Promise<ActionResult> {
	const parsed = idSchema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false, error: "ID inválido" };
	}

	const session = await requireCurrentClient();
	const clientId = session.user.id;
	const { id } = parsed.data;

	try {
		await db.transaction(async (tx) => {
			const owned = await tx
				.select({ id: clientAddress.id })
				.from(clientAddress)
				.where(
					and(eq(clientAddress.id, id), eq(clientAddress.clientId, clientId))
				)
				.limit(1);
			if (owned.length === 0) {
				throw new Error("Endereço não encontrado");
			}

			await tx
				.update(clientAddress)
				.set({ isDefault: false })
				.where(eq(clientAddress.clientId, clientId));

			await tx
				.update(clientAddress)
				.set({ isDefault: true })
				.where(
					and(eq(clientAddress.id, id), eq(clientAddress.clientId, clientId))
				);
		});

		revalidatePath("/dashboard/dados-pessoais");
		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Erro inesperado";
		log.error({
			action: "set_default_address_failed",
			clientId,
			addressId: id,
			error: message,
		});
		return { ok: false, error: "Não foi possível definir o endereço padrão" };
	}
}
