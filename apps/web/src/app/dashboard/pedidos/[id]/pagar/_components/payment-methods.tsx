"use client";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@emach/ui/components/tabs";
import { Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import { EmachButton } from "@/components/emach-button";
import { Notice } from "@/components/notice";
import { Panel, SummaryRow } from "@/components/panel";
import { fmtNumericBRL } from "@/lib/format";

// TODO(asaas): substituir os dados mock por cobrança real gerada via Asaas
// (Pix copia-e-cola + QR, linha digitável do boleto, tokenização do cartão).
// O webhook do Asaas confirma o pagamento e muda o status do pedido para "paid".
const MOCK_PIX =
	"00020126580014br.gov.bcb.pix0136mock-emach-asaas-pendente5204000053039865802BR";
const MOCK_BOLETO = "23793.38128 60007.827136 42000.063305 9 00000000000000";

export function PaymentMethods({
	orderNumber,
	subtotal,
	shipping,
	total,
}: {
	orderNumber: string;
	shipping: string;
	subtotal: string;
	total: string;
}) {
	const copy = (text: string, label: string) => async () => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${label} copiado`);
		} catch {
			toast.error("Não foi possível copiar");
		}
	};

	return (
		<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
			<div className="min-w-0 space-y-5">
				<Notice>Ambiente de demonstração: nenhum pagamento é cobrado.</Notice>
				<Tabs defaultValue="pix">
					<TabsList variant="line">
						<TabsTrigger value="pix">Pix</TabsTrigger>
						<TabsTrigger value="boleto">Boleto</TabsTrigger>
						<TabsTrigger value="cartao">Cartão</TabsTrigger>
					</TabsList>

					<TabsContent className="pt-5" value="pix">
						<div className="flex flex-col items-center gap-4 rounded-[5px] border border-line bg-paper p-6">
							<div
								aria-label="QR Code Pix (demonstração)"
								className="flex size-40 items-center justify-center rounded-[3px] bg-well"
								role="img"
							>
								<QrCode
									aria-hidden="true"
									className="size-16 text-ink-muted"
									strokeWidth={1.2}
								/>
							</div>
							<p className="text-center text-[14px] text-ink-2">
								Escaneie o QR ou copie o código abaixo
							</p>
							<CopyLine
								ariaLabel="Copiar código Pix"
								onCopy={copy(MOCK_PIX, "Código Pix")}
								value={MOCK_PIX}
							/>
						</div>
					</TabsContent>

					<TabsContent className="pt-5" value="boleto">
						<div className="space-y-4 rounded-[5px] border border-line bg-paper p-6">
							<p className="text-[14px] text-ink-2">
								Linha digitável (compensação em 1-2 dias úteis):
							</p>
							<CopyLine
								ariaLabel="Copiar linha digitável do boleto"
								onCopy={copy(MOCK_BOLETO, "Linha digitável")}
								value={MOCK_BOLETO}
							/>
						</div>
					</TabsContent>

					<TabsContent className="pt-5" value="cartao">
						<div className="space-y-3 rounded-[5px] border border-line bg-paper p-6">
							<input
								aria-describedby="card-soon"
								aria-label="Número do cartão"
								className="emach-input"
								disabled
								placeholder="Número do cartão"
							/>
							<div className="flex gap-3">
								<input
									aria-describedby="card-soon"
									aria-label="Validade"
									className="emach-input"
									disabled
									placeholder="Validade"
								/>
								<input
									aria-label="CVV"
									className="emach-input"
									disabled
									placeholder="CVV"
								/>
							</div>
							<p className="text-[13px] text-ink-muted" id="card-soon">
								Pagamento com cartão estará disponível em breve.
							</p>
						</div>
					</TabsContent>
				</Tabs>
			</div>

			<Panel as="aside" title="Resumo" tone="canteiro">
				<SummaryRow label="Pedido">#{orderNumber}</SummaryRow>
				<SummaryRow label="Subtotal">{fmtNumericBRL(subtotal)}</SummaryRow>
				<SummaryRow
					label="Frete"
					tone={Number(shipping) === 0 ? "discount" : undefined}
				>
					{Number(shipping) === 0 ? "Grátis" : fmtNumericBRL(shipping)}
				</SummaryRow>
				<SummaryRow label="Total" total>
					{fmtNumericBRL(total)}
				</SummaryRow>
			</Panel>
		</div>
	);
}

function CopyLine({
	ariaLabel,
	onCopy,
	value,
}: {
	ariaLabel: string;
	onCopy: () => void;
	value: string;
}) {
	return (
		<div className="flex w-full gap-2">
			<code className="block min-w-0 flex-1 truncate rounded-[3px] border border-line bg-canteiro px-3 py-3 font-mono text-[13px] text-ink leading-5">
				{value}
			</code>
			<EmachButton
				aria-label={ariaLabel}
				icon={<Copy aria-hidden="true" className="size-4" />}
				onClick={onCopy}
				variant="line"
			>
				Copiar
			</EmachButton>
		</div>
	);
}
