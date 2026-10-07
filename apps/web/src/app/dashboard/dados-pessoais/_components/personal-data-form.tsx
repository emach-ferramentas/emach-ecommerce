"use client";

import { cn } from "@emach/ui/lib/utils";
import {
	isValidCpfCnpj,
	maskCpfCnpj,
	maskPhone,
	normalizeDocument,
	onlyDigits,
} from "@emach/validators";
import { CircleAlert, CircleCheck, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { EmachButton } from "@/components/emach-button";
import { Notice } from "@/components/notice";
import { Panel } from "@/components/panel";
import { StatusChip } from "@/components/status-chip";
import { authClient } from "@/lib/auth-client";

type AccountType = "PF" | "PJ";

const detectAccountType = (document: string | null): AccountType =>
	document && normalizeDocument(document).length === 14 ? "PJ" : "PF";

interface InitialData {
	document: string | null;
	email: string;
	emailVerified: boolean;
	name: string;
	phone: string | null;
}

interface PersonalDataFormProps {
	initialData: InitialData;
}

export function PersonalDataForm({ initialData }: PersonalDataFormProps) {
	const [data, setData] = useState(initialData);

	return (
		<Panel flush title="Seus dados">
			<div className="grid grid-cols-1 sm:grid-cols-2">
				<NameCard
					initialValue={data.name}
					onSaved={(v) => setData((d) => ({ ...d, name: v }))}
				/>
				<EmailCard email={data.email} verified={data.emailVerified} />
				<PhoneCard
					initialValue={data.phone}
					onSaved={(v) => setData((d) => ({ ...d, phone: v }))}
				/>
				<DocumentCard
					initialValue={data.document}
					onSaved={(v) => setData((d) => ({ ...d, document: v }))}
				/>
			</div>
		</Panel>
	);
}

function CardShell({ children }: { children: React.ReactNode }) {
	return (
		<div
			className={cn(
				"flex items-start justify-between gap-4 border-line px-5 py-4 md:px-6",
				"border-b sm:[&:nth-child(odd)]:border-r",
				"sm:[&:nth-child(3)]:border-b-0 [&:nth-child(4)]:border-b-0"
			)}
		>
			{children}
		</div>
	);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
	return <div className="text-[13.5px] text-ink-muted">{children}</div>;
}

function FieldValue({ children }: { children: React.ReactNode }) {
	return (
		<div className="mt-0.5 truncate font-semibold text-[16px] text-ink">
			{children}
		</div>
	);
}

function EmptyValue() {
	return <div className="mt-0.5 text-[15px] text-ink-muted">Não informado</div>;
}

function EditTrigger({
	empty = false,
	onClick,
}: {
	empty?: boolean;
	onClick: () => void;
}) {
	return (
		<EmachButton
			className="shrink-0"
			icon={empty ? <Plus aria-hidden="true" className="size-4" /> : undefined}
			onClick={onClick}
			variant="link"
		>
			{empty ? "Adicionar" : "Editar"}
		</EmachButton>
	);
}

function FormActions({
	onCancel,
	isSaving,
}: {
	onCancel: () => void;
	isSaving: boolean;
}) {
	return (
		<div className="mt-4 flex items-center justify-end gap-4">
			<EmachButton onClick={onCancel} variant="link">
				Cancelar
			</EmachButton>
			<EmachButton
				disabled={isSaving}
				isLoading={isSaving}
				type="submit"
				variant="dark"
			>
				{isSaving ? "Salvando..." : "Salvar"}
			</EmachButton>
		</div>
	);
}

function FieldError({ message }: { message: string | null }) {
	if (!message) {
		return null;
	}
	return (
		<p className="emach-field__error" role="alert">
			{message}
		</p>
	);
}

const nameSchema = z.string().min(2, "Informe seu nome");

function NameCard({
	initialValue,
	onSaved,
}: {
	initialValue: string;
	onSaved: (next: string) => void;
}) {
	const router = useRouter();
	const [mode, setMode] = useState<"read" | "edit">("read");
	const [value, setValue] = useState(initialValue);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	if (mode === "read") {
		return (
			<CardShell>
				<div className="min-w-0 flex-1">
					<FieldLabel>Nome</FieldLabel>
					<FieldValue>{initialValue}</FieldValue>
				</div>
				<EditTrigger onClick={() => setMode("edit")} />
			</CardShell>
		);
	}

	const handleCancel = () => {
		setValue(initialValue);
		setError(null);
		setMode("read");
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const parsed = nameSchema.safeParse(value);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Inválido");
			return;
		}
		setIsSaving(true);
		await authClient.updateUser(
			{ name: value } as Parameters<typeof authClient.updateUser>[0],
			{
				onSuccess: () => {
					toast.success("Nome atualizado");
					onSaved(value);
					setMode("read");
					router.refresh();
				},
				onError: (err) => {
					toast.error(err.error.message || "Não foi possível salvar.");
				},
			}
		);
		setIsSaving(false);
	};

	return (
		<CardShell>
			<form className="emach-field w-full" onSubmit={handleSubmit}>
				<label className="emach-field__label" htmlFor="name-input">
					Nome
				</label>
				<input
					aria-invalid={error ? true : undefined}
					autoFocus
					className="emach-input"
					id="name-input"
					onChange={(e) => setValue(e.target.value)}
					value={value}
				/>
				<FieldError message={error} />
				<FormActions isSaving={isSaving} onCancel={handleCancel} />
			</form>
		</CardShell>
	);
}

function EmailCard({ email, verified }: { email: string; verified: boolean }) {
	const [sending, setSending] = useState(false);

	const handleVerify = async () => {
		setSending(true);
		try {
			await authClient.sendVerificationEmail(
				{ email, callbackURL: "/dashboard/dados-pessoais" },
				{
					onSuccess: () => {
						toast.success("E-mail de verificação enviado");
					},
					onError: (err) => {
						toast.error(err.error.message || "Não foi possível enviar.");
					},
				}
			);
		} finally {
			setSending(false);
		}
	};

	return (
		<CardShell>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<FieldLabel>E-mail</FieldLabel>
					{verified ? (
						<StatusChip icon={CircleCheck} tone="ok">
							Verificado
						</StatusChip>
					) : (
						<StatusChip icon={CircleAlert} tone="neutral">
							Não verificado
						</StatusChip>
					)}
				</div>
				<FieldValue>{email}</FieldValue>
				{verified ? (
					<div className="mt-1 text-[13px] text-ink-muted">Somente leitura</div>
				) : (
					<div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-line border-t pt-3">
						<span className="text-[14px] text-ink-2">
							Seu e-mail ainda não foi confirmado.
						</span>
						<EmachButton
							className="shrink-0"
							disabled={sending}
							isLoading={sending}
							onClick={handleVerify}
							variant="line"
						>
							{sending ? "Enviando..." : "Verificar e-mail"}
						</EmachButton>
					</div>
				)}
			</div>
		</CardShell>
	);
}

const phoneSchema = z
	.string()
	.refine(
		(v) => !v || [10, 11].includes(onlyDigits(v).length),
		"Telefone inválido"
	);

function PhoneCard({
	initialValue,
	onSaved,
}: {
	initialValue: string | null;
	onSaved: (next: string | null) => void;
}) {
	const router = useRouter();
	const [mode, setMode] = useState<"read" | "edit">("read");
	const [value, setValue] = useState(
		initialValue ? maskPhone(initialValue) : ""
	);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	if (mode === "read") {
		return (
			<CardShell>
				<div className="min-w-0 flex-1">
					<FieldLabel>Telefone</FieldLabel>
					{initialValue ? (
						<FieldValue>{maskPhone(initialValue)}</FieldValue>
					) : (
						<EmptyValue />
					)}
				</div>
				<EditTrigger empty={!initialValue} onClick={() => setMode("edit")} />
			</CardShell>
		);
	}

	const handleCancel = () => {
		setValue(initialValue ? maskPhone(initialValue) : "");
		setError(null);
		setMode("read");
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const parsed = phoneSchema.safeParse(value);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Inválido");
			return;
		}
		const digits = onlyDigits(value);
		setIsSaving(true);
		await authClient.updateUser(
			{
				phone: digits || undefined,
			} as Parameters<typeof authClient.updateUser>[0],
			{
				onSuccess: () => {
					toast.success("Telefone atualizado");
					onSaved(digits || null);
					setMode("read");
					router.refresh();
				},
				onError: (err) => {
					toast.error(err.error.message || "Não foi possível salvar.");
				},
			}
		);
		setIsSaving(false);
	};

	return (
		<CardShell>
			<form className="emach-field w-full" onSubmit={handleSubmit}>
				<label className="emach-field__label" htmlFor="phone-input">
					Telefone
				</label>
				<input
					aria-invalid={error ? true : undefined}
					autoFocus
					className="emach-input"
					id="phone-input"
					inputMode="tel"
					onChange={(e) => setValue(maskPhone(e.target.value))}
					placeholder="(00) 00000-0000"
					value={value}
				/>
				<FieldError message={error} />
				<FormActions isSaving={isSaving} onCancel={handleCancel} />
			</form>
		</CardShell>
	);
}

const documentSchema = z
	.string()
	.refine((v) => !v || isValidCpfCnpj(v), "Documento inválido");

function DocumentCard({
	initialValue,
	onSaved,
}: {
	initialValue: string | null;
	onSaved: (next: string | null) => void;
}) {
	const router = useRouter();
	const [mode, setMode] = useState<"read" | "edit">("read");
	const [accountType, setAccountType] = useState<AccountType>(
		detectAccountType(initialValue)
	);
	const [value, setValue] = useState(
		initialValue ? maskCpfCnpj(initialValue) : ""
	);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	if (mode === "read") {
		return (
			<CardShell>
				<div className="min-w-0 flex-1">
					<FieldLabel>CPF / CNPJ</FieldLabel>
					{initialValue ? (
						<FieldValue>{maskCpfCnpj(initialValue)}</FieldValue>
					) : (
						<>
							<EmptyValue />
							<div className="mt-3">
								<Notice>
									Você também pode informar na finalização da compra.
								</Notice>
							</div>
						</>
					)}
				</div>
				<EditTrigger empty={!initialValue} onClick={() => setMode("edit")} />
			</CardShell>
		);
	}

	const handleAccountTypeChange = (next: AccountType) => {
		if (next === accountType) {
			return;
		}
		setAccountType(next);
		setValue("");
		setError(null);
	};

	const handleCancel = () => {
		setAccountType(detectAccountType(initialValue));
		setValue(initialValue ? maskCpfCnpj(initialValue) : "");
		setError(null);
		setMode("read");
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const parsed = documentSchema.safeParse(value);
		if (!parsed.success) {
			setError(accountType === "PJ" ? "CNPJ inválido" : "CPF inválido");
			return;
		}
		const document = normalizeDocument(value);
		setIsSaving(true);
		await authClient.updateUser(
			{
				document: document || undefined,
			} as Parameters<typeof authClient.updateUser>[0],
			{
				onSuccess: () => {
					toast.success("Documento atualizado");
					onSaved(document || null);
					setMode("read");
					router.refresh();
				},
				onError: (err) => {
					toast.error(err.error.message || "Não foi possível salvar.");
				},
			}
		);
		setIsSaving(false);
	};

	return (
		<CardShell>
			<form className="emach-field w-full" onSubmit={handleSubmit}>
				<label className="emach-field__label" htmlFor="document-input">
					{accountType === "PJ" ? "CNPJ" : "CPF"}
				</label>
				<AccountTypeSwitch
					onChange={handleAccountTypeChange}
					value={accountType}
				/>
				<input
					aria-invalid={error ? true : undefined}
					autoCapitalize={accountType === "PJ" ? "characters" : undefined}
					autoFocus
					className="emach-input"
					id="document-input"
					inputMode={accountType === "PJ" ? "text" : "numeric"}
					onChange={(e) => setValue(maskCpfCnpj(e.target.value))}
					placeholder={
						accountType === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"
					}
					value={value}
				/>
				<FieldError message={error} />
				<FormActions isSaving={isSaving} onCancel={handleCancel} />
			</form>
		</CardShell>
	);
}

const ACCOUNT_TYPES: readonly { label: string; value: AccountType }[] = [
	{ value: "PF", label: "CPF" },
	{ value: "PJ", label: "CNPJ" },
];

function AccountTypeSwitch({
	onChange,
	value,
}: {
	onChange: (next: AccountType) => void;
	value: AccountType;
}) {
	return (
		<fieldset
			aria-label="Tipo de documento"
			className="mb-1 inline-flex w-fit overflow-hidden rounded-[3px] border-[1.5px] border-line-strong"
		>
			{ACCOUNT_TYPES.map((type) => (
				<button
					aria-pressed={value === type.value}
					className={cn(
						"min-h-10 cursor-pointer px-4 font-bold text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-ink focus-visible:-outline-offset-2",
						value === type.value
							? "bg-grafite text-on-dark"
							: "bg-paper text-ink hover:bg-canteiro"
					)}
					key={type.value}
					onClick={() => onChange(type.value)}
					type="button"
				>
					{type.label}
				</button>
			))}
		</fieldset>
	);
}
