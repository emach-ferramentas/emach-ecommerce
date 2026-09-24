import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";

// Espelha a anatomia de CartContent (linhas de item + resumo escuro) pra troca
// skeleton→dados não piscar claro↔escuro nem deslocar o layout.
export default function Loading() {
	return (
		<>
			<SiteHeader />
			<PageContainer className="max-w-[1080px] animate-pulse pt-10 pb-20">
				<div className="mb-2 h-10 w-40 bg-gray-20" />
				<div className="mb-8 h-4 w-16 bg-gray-20" />
				<div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_360px]">
					<div>
						{[0, 1, 2].map((i) => (
							<div
								className="grid grid-cols-[120px_1fr_auto] items-center gap-5 border-border border-b py-5 last:border-b-0"
								key={i}
							>
								<div className="emach-shimmer size-[120px]" />
								<div className="space-y-2">
									<div className="h-3 w-20 bg-gray-20" />
									<div className="h-4 w-60 max-w-full bg-gray-20" />
									<div className="h-9 w-28 bg-gray-20" />
								</div>
								<div className="h-4 w-20 bg-gray-20" />
							</div>
						))}
					</div>
					<div className="bg-near-black p-7">
						<div className="h-3 w-32 bg-white/15" />
						<div className="mt-5 space-y-2.5">
							<div className="h-3.5 w-full bg-white/10" />
							<div className="h-3.5 w-full bg-white/10" />
						</div>
						<div className="mt-4 h-px w-full bg-white/25" />
						<div className="mt-4 h-8 w-full bg-white/10" />
						<div className="mt-5 h-13 w-full bg-white/15" />
						<div className="mt-2 h-11 w-full bg-white/[0.06]" />
					</div>
				</div>
			</PageContainer>
		</>
	);
}
