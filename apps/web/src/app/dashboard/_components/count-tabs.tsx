import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@emach/ui/components/tabs";
import type { ReactNode } from "react";

export interface CountTab<K extends string> {
	count: number;
	label: string;
	value: K;
}

export function CountTabs<K extends string>({
	children,
	defaultValue,
	tabs,
}: {
	children: (value: K) => ReactNode;
	defaultValue: K;
	tabs: readonly CountTab<K>[];
}) {
	return (
		<Tabs defaultValue={defaultValue}>
			<div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
				<TabsList
					className="w-max min-w-full justify-start gap-6 border-line"
					variant="line"
				>
					{tabs.map((tab) => (
						<TabsTrigger
							className="h-auto min-h-12 flex-none border-none px-0 text-[15px] text-ink-2"
							key={tab.value}
							value={tab.value}
						>
							<span>{tab.label}</span>
							<span className="font-normal text-ink-muted tabular-nums">
								{tab.count}
							</span>
						</TabsTrigger>
					))}
				</TabsList>
			</div>

			{tabs.map((tab) => (
				<TabsContent className="mt-6" key={tab.value} value={tab.value}>
					{children(tab.value)}
				</TabsContent>
			))}
		</Tabs>
	);
}
