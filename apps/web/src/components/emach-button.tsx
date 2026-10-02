import { cn } from "@emach/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

const buttonVariants = cva(
	"inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[3px] border-[1.5px] font-bold no-underline transition-colors focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60 aria-busy:pointer-events-none",
	{
		variants: {
			variant: {
				cta: "border-transparent bg-emach-red text-white hover:bg-emach-red-hover",
				dark: "border-transparent bg-grafite text-on-dark hover:bg-black",
				line: "border-line-strong bg-paper text-ink hover:border-ink",
				danger: "border-error-text bg-paper text-error-text hover:bg-canteiro",
				link: "border-transparent bg-transparent text-ink-2 underline underline-offset-[3px] hover:text-ink",
			},
			size: {
				md: "min-h-11 px-5 text-[15px]",
				lg: "min-h-[52px] px-7 text-[16px]",
			},
			full: {
				true: "w-full",
			},
		},
		compoundVariants: [{ variant: "link", class: "px-0" }],
		defaultVariants: {
			size: "md",
		},
	}
);

export type ButtonVariant = NonNullable<
	VariantProps<typeof buttonVariants>["variant"]
>;
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

interface ButtonStyle {
	full?: boolean;
	size?: ButtonSize;
	variant: ButtonVariant;
}

export function emachButtonVariants({
	className,
	...style
}: ButtonStyle & { className?: string }): string {
	return cn(buttonVariants(style), className);
}

interface EmachButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		ButtonStyle {
	icon?: React.ReactNode;
	/** Trabalho em curso: troca o ícone por spinner, trava o clique e anuncia aria-busy. */
	isLoading?: boolean;
}

export function EmachButton({
	children,
	variant,
	size,
	full,
	icon,
	isLoading: busy = false,
	className,
	onClick,
	...props
}: EmachButtonProps) {
	// aria-busy em vez de `disabled`: o botão segue focável (leitor de tela não
	// perde o foco no meio da ação) e o rótulo mantém contraste cheio.
	return (
		<button
			{...props}
			aria-busy={busy || undefined}
			aria-disabled={busy || undefined}
			className={cn(buttonVariants({ variant, size, full }), className)}
			onClick={busy ? undefined : onClick}
			type={props.type ?? "button"}
		>
			{busy ? (
				<Loader2 aria-hidden="true" className="size-4 animate-spin" />
			) : (
				icon
			)}
			{children}
		</button>
	);
}

interface EmachLinkButtonProps
	extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">,
		ButtonStyle {
	href: Route;
	icon?: React.ReactNode;
}

// CTA que navega: o próprio <a> recebe o visual do EmachButton. Envolver
// <EmachButton> num <Link> aninha <button> em <a> (HTML inválido, duas paradas
// de foco e "link, botão" no leitor de tela).
export function EmachLinkButton({
	children,
	variant,
	size,
	full,
	icon,
	className,
	href,
	...props
}: EmachLinkButtonProps) {
	return (
		<Link
			{...props}
			className={cn(buttonVariants({ variant, size, full }), className)}
			href={href}
		>
			{icon}
			{children}
		</Link>
	);
}
