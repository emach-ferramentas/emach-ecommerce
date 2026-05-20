import { cn } from "@emach/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import Link, { type LinkProps } from "next/link";
import { SectionLabel } from "@/components/section-label";

type AnyLinkProps = LinkProps<string>;

type LinkVariant = "underline" | "arrow";

interface SectionHeaderProps {
	className?: string;
	label?: string;
	link?: {
		href: AnyLinkProps["href"];
		label: string;
		variant?: LinkVariant;
	};
	title: string;
	titleSize?: "md" | "lg";
	tone?: "default" | "accent";
}

const TITLE_SIZE: Record<
	NonNullable<SectionHeaderProps["titleSize"]>,
	string
> = {
	md: "text-[28px]",
	lg: "text-[44px] tracking-[-0.01em]",
};

/**
 * Header editorial reusado em listagens de produto/categoria.
 * Combina SectionLabel, título e link "ver mais" opcional no padrão
 * chiaroscuro das vinhetas EMACH.
 */
export function SectionHeader({
	label,
	title,
	link,
	titleSize = "lg",
	tone = "accent",
	className,
}: SectionHeaderProps) {
	return (
		<div className={cn("mb-8 flex items-end justify-between", className)}>
			<div>
				{label && <SectionLabel tone={tone}>{label}</SectionLabel>}
				<h2
					className={cn(
						"mt-2.5 font-display font-medium",
						TITLE_SIZE[titleSize]
					)}
				>
					{title}
				</h2>
			</div>
			{link &&
				(link.variant === "arrow" ? (
					<Link
						className="group inline-flex items-center gap-2 font-semibold text-[13px] text-current"
						href={link.href}
					>
						<span className="relative">
							{link.label}
							<span
								aria-hidden="true"
								className="absolute inset-x-0 -bottom-1 h-[1px] origin-left scale-x-0 bg-emach-red transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
							/>
						</span>
						<ArrowRight
							aria-hidden="true"
							className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
							size={14}
							strokeWidth={2}
						/>
					</Link>
				) : (
					<Link
						className="border-emach-red border-b-2 pb-0.5 font-semibold text-[13px]"
						href={link.href}
					>
						{link.label}
					</Link>
				))}
		</div>
	);
}
