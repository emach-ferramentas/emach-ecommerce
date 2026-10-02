import { Panel } from "@/components/panel";

interface AddressSnapshot {
	city?: string;
	complement?: string | null;
	country?: string;
	neighborhood?: string;
	number?: string;
	recipient?: string;
	state?: string;
	street?: string;
	zipCode?: string;
}

export function ShippingAddress({ address }: { address: unknown }) {
	const a = (address ?? {}) as AddressSnapshot;
	const streetLine = [a.street, a.number].filter(Boolean).join(", ");
	const localityLine = [a.neighborhood, a.city].filter(Boolean).join(", ");
	const stateSuffix = a.state ? ` — ${a.state}` : "";
	const zipLine = [a.zipCode ? `CEP ${a.zipCode}` : null, a.country]
		.filter(Boolean)
		.join(" · ");

	return (
		<Panel title="Endereço de entrega">
			<address className="text-[15px] text-ink not-italic leading-[1.6]">
				{a.recipient ? (
					<div className="font-semibold">{a.recipient}</div>
				) : null}
				{streetLine ? (
					<div>
						{streetLine}
						{a.complement ? ` — ${a.complement}` : null}
					</div>
				) : null}
				{localityLine || a.state ? (
					<div>
						{localityLine}
						{stateSuffix}
					</div>
				) : null}
				{zipLine ? (
					<div className="text-[13.5px] text-ink-muted">{zipLine}</div>
				) : null}
			</address>
		</Panel>
	);
}
