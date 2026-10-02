import type { LucideIcon } from "lucide-react";
import { Download, FileText, Receipt } from "lucide-react";
import { emachButtonVariants } from "@/components/emach-button";
import { Panel } from "@/components/panel";

interface OrderDocumentsProps {
	nfeNumber: string | null;
	nfeStatus: string | null;
	nfeUrl: string | null;
	nfeXmlUrl: string | null;
	paymentReceiptUrl: string | null;
}

export function OrderDocuments({
	nfeNumber,
	nfeStatus,
	nfeUrl,
	nfeXmlUrl,
	paymentReceiptUrl,
}: OrderDocumentsProps) {
	const hasNfe = Boolean(nfeNumber || nfeUrl || nfeXmlUrl);
	if (!(hasNfe || paymentReceiptUrl)) {
		return null;
	}

	return (
		<Panel title="Documentos">
			<div className="flex flex-col gap-2.5">
				{hasNfe ? (
					<DocRow
						Icon={FileText}
						subtitle={nfeStatus ? `Status: ${nfeStatus}` : undefined}
						title={
							nfeNumber ? `Nota fiscal · NF-e ${nfeNumber}` : "Nota fiscal"
						}
					>
						{nfeUrl ? <DocLink href={nfeUrl} label="DANFE (PDF)" /> : null}
						{nfeXmlUrl ? <DocLink href={nfeXmlUrl} label="XML" /> : null}
					</DocRow>
				) : null}
				{paymentReceiptUrl ? (
					<DocRow Icon={Receipt} title="Comprovante de pagamento">
						<DocLink href={paymentReceiptUrl} label="Baixar" />
					</DocRow>
				) : null}
			</div>
		</Panel>
	);
}

function DocRow({
	Icon,
	title,
	subtitle,
	children,
}: {
	children: React.ReactNode;
	Icon: LucideIcon;
	subtitle?: string;
	title: string;
}) {
	return (
		<div className="flex flex-wrap items-center gap-3.5 rounded-[3px] border border-line px-4 py-3.5">
			<span className="flex size-10 shrink-0 items-center justify-center rounded-[3px] bg-canteiro text-ink">
				<Icon aria-hidden="true" className="size-5" strokeWidth={1.6} />
			</span>
			<div className="min-w-0 flex-1">
				<div className="font-semibold text-[15px] text-ink">{title}</div>
				{subtitle ? (
					<div className="text-[13.5px] text-ink-muted">{subtitle}</div>
				) : null}
			</div>
			<div className="flex flex-wrap items-center gap-2">{children}</div>
		</div>
	);
}

function DocLink({ href, label }: { href: string; label: string }) {
	return (
		<a
			className={emachButtonVariants({ variant: "line" })}
			href={href}
			rel="noopener noreferrer"
			target="_blank"
		>
			<Download aria-hidden="true" className="size-4" strokeWidth={1.8} />
			{label}
		</a>
	);
}
