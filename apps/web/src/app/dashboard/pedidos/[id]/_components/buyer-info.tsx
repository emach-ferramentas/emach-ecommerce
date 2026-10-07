import { normalizeDocument } from "@emach/validators";
import { Panel } from "@/components/panel";

function maskDocument(doc: string | null): string {
	if (!doc) {
		return "—";
	}
	const d = normalizeDocument(doc);
	if (d.length === 11) {
		return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
	}
	if (d.length === 14) {
		return `**.***.***/${d.slice(8, 12)}-${d.slice(12)}`;
	}
	return "—";
}

interface Buyer {
	document: string | null;
	email: string;
	name: string;
	phone: string | null;
}

function Field({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="text-[13.5px] text-ink-muted">{label}</dt>
			<dd className="mt-0.5 break-words font-semibold text-[15px] text-ink">
				{value}
			</dd>
		</div>
	);
}

export function BuyerInfo({ buyer }: { buyer: Buyer }) {
	return (
		<Panel title="Comprador">
			<dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
				<Field label="Nome" value={buyer.name} />
				<Field label="E-mail" value={buyer.email} />
				<Field label="Telefone" value={buyer.phone ?? "—"} />
				<Field label="CPF / CNPJ" value={maskDocument(buyer.document)} />
			</dl>
		</Panel>
	);
}
