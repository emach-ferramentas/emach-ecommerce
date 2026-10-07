import { Column, Row, Section, Text } from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";
import {
	color,
	EmailButton,
	EmailHeading,
	EmailLayout,
	EmailNote,
	EmailText,
} from "../layout";

export interface OrderReceivedItem {
	detail: string | null;
	id: string;
	lineTotal: string;
	name: string;
	quantity: number;
}

export interface OrderReceivedProps {
	addressLines: string[];
	items: OrderReceivedItem[];
	name: string;
	orderNumber: string;
	/** Página do pedido na conta, onde o cliente paga. */
	orderUrl: string;
	summary: { label: string; value: string }[];
	total: string;
}

const label: CSSProperties = {
	color: color.inkMuted,
	fontSize: "12px",
	fontWeight: 700,
	letterSpacing: "0.06em",
	margin: "0 0 8px",
	textTransform: "uppercase",
};

const cell: CSSProperties = {
	color: color.ink,
	fontSize: "15px",
	lineHeight: 1.5,
	margin: 0,
};

const block: CSSProperties = {
	borderTop: `1px solid ${color.line}`,
	padding: "20px 0",
};

function Block({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Section style={block}>
			<Text style={label}>{title}</Text>
			{children}
		</Section>
	);
}

function Amount({
	name,
	value,
	strong = false,
}: {
	name: string;
	value: string;
	strong?: boolean;
}) {
	const weight = strong ? { fontWeight: 800, fontSize: "17px" } : {};
	return (
		<Row>
			<Column>
				<Text style={{ ...cell, ...weight }}>{name}</Text>
			</Column>
			<Column align="right">
				<Text style={{ ...cell, ...weight }}>{value}</Text>
			</Column>
		</Row>
	);
}

export function OrderReceivedEmail({
	addressLines,
	items,
	name,
	orderNumber,
	orderUrl,
	summary,
	total,
}: OrderReceivedProps) {
	return (
		<EmailLayout
			preview={`Pedido ${orderNumber} recebido. Falta o pagamento.`}
			siteUrl={new URL(orderUrl).origin}
		>
			<EmailHeading>Pedido recebido</EmailHeading>
			<EmailText>
				Olá {name}, recebemos o seu pedido <strong>{orderNumber}</strong>. Ele
				segue para separação depois que o pagamento for aprovado. Você paga pela
				página do pedido na sua conta.
			</EmailText>
			<EmailButton href={orderUrl}>Ver pedido e pagar</EmailButton>

			<Block title="Itens">
				{items.map((item) => (
					<Row key={item.id} style={{ marginBottom: "8px" }}>
						<Column>
							<Text style={cell}>
								{item.quantity}× {item.name}
								{item.detail ? (
									<span style={{ color: color.inkMuted }}>
										{` · ${item.detail}`}
									</span>
								) : null}
							</Text>
						</Column>
						<Column align="right" style={{ verticalAlign: "top" }}>
							<Text style={{ ...cell, whiteSpace: "nowrap" }}>
								{item.lineTotal}
							</Text>
						</Column>
					</Row>
				))}
			</Block>

			<Block title="Resumo">
				{summary.map((row) => (
					<Amount key={row.label} name={row.label} value={row.value} />
				))}
				<Amount name="Total" strong value={total} />
			</Block>

			<Block title="Endereço de entrega">
				{addressLines.map((line) => (
					<Text key={line} style={cell}>
						{line}
					</Text>
				))}
			</Block>

			<EmailNote>
				Você pode acompanhar o andamento em "Meus pedidos", na sua conta EMACH.
			</EmailNote>
		</EmailLayout>
	);
}

OrderReceivedEmail.PreviewProps = {
	name: "Ana Souza",
	orderNumber: "2026-000123",
	orderUrl: "https://emachferramentas.com.br/dashboard/pedidos/preview",
	items: [
		{
			id: "i1",
			name: "Furadeira de Impacto 750W",
			detail: "220V",
			quantity: 2,
			lineTotal: "R$ 1.798,00",
		},
		{
			id: "i2",
			name: "Óculos de Proteção Incolor",
			detail: null,
			quantity: 1,
			lineTotal: "R$ 29,90",
		},
	],
	summary: [
		{ label: "Subtotal", value: "R$ 1.827,90" },
		{ label: "Desconto do cupom", value: "- R$ 50,00" },
		{ label: "Frete (Correios — PAC)", value: "R$ 42,10" },
	],
	total: "R$ 1.820,00",
	addressLines: [
		"Ana Souza",
		"Rua das Obras, 100 — Apto 2",
		"Centro, Campinas — SP",
		"CEP 13010-000",
	],
} satisfies OrderReceivedProps;

export default OrderReceivedEmail;
