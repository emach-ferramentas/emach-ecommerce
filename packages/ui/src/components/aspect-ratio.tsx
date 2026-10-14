import { cn } from "@emach/ui/lib/utils";

function AspectRatio({
	ratio,
	className,
	...props
}: React.ComponentProps<"div"> & { ratio: number }) {
	const ratioStyle: React.CSSProperties & { "--ratio": number } = {
		"--ratio": ratio,
	};

	return (
		<div
			className={cn("relative aspect-(--ratio)", className)}
			data-slot="aspect-ratio"
			style={ratioStyle}
			{...props}
		/>
	);
}

export { AspectRatio };
