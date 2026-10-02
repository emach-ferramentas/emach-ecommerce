"use client";

import type { ClientAddress } from "@emach/db/schema/client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setDefaultAddressAction } from "@/app/dashboard/dados-pessoais/_actions/addresses";
import { EmachButton } from "@/components/emach-button";
import { Notice } from "@/components/notice";
import { Panel } from "@/components/panel";

import { AddressSheet, type AddressSheetMode } from "./address-sheet";

interface AddressesSectionProps {
	addresses: ClientAddress[];
}

const RE_CEP_DISPLAY = /^(\d{5})(\d{3})$/;
function formatCep(zip: string): string {
	return zip.replace(RE_CEP_DISPLAY, "$1-$2");
}

export function AddressesSection({ addresses }: AddressesSectionProps) {
	const [sheetMode, setSheetMode] = useState<AddressSheetMode>(null);
	const [expanded, setExpanded] = useState(false);

	const sorted = [...addresses].sort((a, b) => {
		if (a.isDefault && !b.isDefault) {
			return -1;
		}
		if (!a.isDefault && b.isDefault) {
			return 1;
		}
		return b.updatedAt.getTime() - a.updatedAt.getTime();
	});
	const primary = sorted[0] ?? null;
	const others = sorted.slice(1);

	const hasOthers = addresses.length > 0;

	return (
		<Panel
			actions={
				primary === null ? null : (
					<EmachButton
						icon={<Plus aria-hidden="true" className="size-4" />}
						onClick={() => setSheetMode({ kind: "create", hasOthers })}
						variant="link"
					>
						Adicionar endereço
					</EmachButton>
				)
			}
			flush
			title="Endereço de entrega"
		>
			{primary === null ? (
				<EmptyState
					onAdd={() => setSheetMode({ kind: "create", hasOthers: false })}
				/>
			) : (
				<div className="divide-y divide-line border-line border-t">
					<AddressCard
						address={primary}
						onEdit={() => setSheetMode({ kind: "edit", address: primary })}
					/>

					{expanded &&
						others.map((addr) => (
							<AddressCard
								address={addr}
								key={addr.id}
								onEdit={() => setSheetMode({ kind: "edit", address: addr })}
							/>
						))}

					{others.length > 0 && (
						<div className="px-5 py-1 md:px-6">
							<EmachButton
								onClick={() => setExpanded((v) => !v)}
								variant="link"
							>
								{expanded
									? `Ocultar outros endereços (${others.length})`
									: `Ver outros endereços (${others.length})`}
							</EmachButton>
						</div>
					)}
				</div>
			)}

			<AddressSheet mode={sheetMode} onClose={() => setSheetMode(null)} />
		</Panel>
	);
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
	return (
		<div className="px-5 pb-5 md:px-6 md:pb-6">
			<Notice
				action={
					<EmachButton
						icon={<Plus aria-hidden="true" className="size-4" />}
						onClick={onAdd}
						variant="line"
					>
						Adicionar
					</EmachButton>
				}
			>
				<strong className="font-semibold text-ink">
					Nenhum endereço cadastrado
				</strong>
				<span className="block">Necessário para finalizar compras.</span>
			</Notice>
		</div>
	);
}

interface AddressCardProps {
	address: ClientAddress;
	onEdit: () => void;
}

function AddressCard({ address, onEdit }: AddressCardProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	const handleSetDefault = () => {
		startTransition(async () => {
			const result = await setDefaultAddressAction({ id: address.id });
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			toast.success("Endereço definido como padrão");
			router.refresh();
		});
	};

	const lineMain = [`${address.street}, ${address.number}`, address.complement]
		.filter(Boolean)
		.join(" — ");
	const lineSub = [
		address.neighborhood,
		`${address.city}/${address.state}`,
		formatCep(address.zipCode),
	].join(" · ");

	return (
		<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-4 md:px-6">
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-semibold text-[15px] text-ink">
						{address.label ?? "Endereço"}
					</span>
					{address.isDefault && (
						<span className="rounded-[3px] border border-line-strong px-1.5 py-px font-semibold text-[12.5px] text-ink-2">
							Padrão
						</span>
					)}
				</div>
				<div className="mt-1 text-[15px] text-ink">{lineMain}</div>
				<div className="mt-0.5 text-[13.5px] text-ink-muted">{lineSub}</div>
			</div>
			<div className="flex shrink-0 items-center gap-4">
				{!address.isDefault && (
					<EmachButton
						disabled={isPending}
						isLoading={isPending}
						onClick={handleSetDefault}
						variant="link"
					>
						Tornar padrão
					</EmachButton>
				)}
				<EmachButton onClick={onEdit} variant="link">
					Editar
				</EmachButton>
			</div>
		</div>
	);
}
