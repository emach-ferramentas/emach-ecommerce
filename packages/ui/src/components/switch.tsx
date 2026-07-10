"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@emach/ui/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
	return (
		<SwitchPrimitive.Root
			className={cn(
				"relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer items-center rounded-full bg-border outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary",
				className
			)}
			data-slot="switch"
			{...props}
		>
			<SwitchPrimitive.Thumb
				className="block size-3.5 translate-x-0.5 rounded-full bg-white transition-transform data-checked:translate-x-[15px]"
				data-slot="switch-thumb"
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
