import { cn } from "@emach/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const sectionLabelVariants = cva(
	"font-display font-semibold text-md uppercase tracking-[0.14em]",
	{
		variants: {
			tone: {
				default: "text-gray-50",
				light: "text-white/70",
				accent: "text-emach-red",
			},
		},
		defaultVariants: {
			tone: "default",
		},
	}
);

interface SectionLabelProps
	extends React.HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof sectionLabelVariants> {}

export function SectionLabel({
	children,
	tone,
	className,
	...props
}: SectionLabelProps) {
	return (
		<span className={cn(sectionLabelVariants({ tone }), className)} {...props}>
			{children}
		</span>
	);
}

export { sectionLabelVariants };
