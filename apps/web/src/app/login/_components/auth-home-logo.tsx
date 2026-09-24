import { cn } from "@emach/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";

const LOGO_SRC = {
	red: "/emach-logo-red.svg",
	white: "/emach-logo.svg",
} as const;

// As telas de auth não têm header; o logo é a saída para a loja.
export function AuthHomeLogo({
	className,
	tone,
}: {
	className?: string;
	tone: keyof typeof LOGO_SRC;
}) {
	return (
		<Link
			aria-label="EMACH, voltar à loja"
			className={cn(
				"inline-flex focus-visible:outline-2 focus-visible:outline-emach-red focus-visible:outline-offset-4",
				className
			)}
			href="/"
		>
			<Image
				alt=""
				className="h-full w-auto"
				height={377}
				priority
				src={LOGO_SRC[tone]}
				width={2041}
			/>
		</Link>
	);
}
