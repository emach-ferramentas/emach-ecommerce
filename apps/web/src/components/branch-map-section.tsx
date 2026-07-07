import { cacheLife } from "next/cache";
import dynamic from "next/dynamic";
import Link from "next/link";
import { EmachButton } from "@/components/emach-button";
import { PageContainer } from "@/components/page-container";
import { SectionLabel } from "@/components/section-label";
import { BRAZIL_STATES, BRAZIL_VIEWBOX } from "@/lib/branch-map/brazil-states";
import { cityToXY } from "@/lib/branch-map/geocode";
import {
	buildMapMaskDataUri,
	buildMapSvgDataUri,
} from "@/lib/branch-map/map-svg";
import type { BranchPin, StateShape } from "@/lib/branch-map/types";
import {
	branchMapsUrl,
	formatBranchAddress,
	formatPhone,
	getActiveBranches,
} from "@/lib/branches";
import { log } from "@/lib/evlog";

const BranchMap = dynamic(
	() => import("@/components/branch-map").then((m) => m.BranchMap),
	{
		loading: () => (
			<div
				aria-hidden="true"
				className="flex flex-1 animate-pulse items-center justify-center bg-cinema-3/50"
			/>
		),
	}
);

export async function BranchMapSection() {
	"use cache";
	cacheLife({ revalidate: 600 });
	const branches = await getActiveBranches();

	const pins: BranchPin[] = [];
	for (const b of branches) {
		const xy = b.city && b.state ? cityToXY(b.city, b.state) : null;
		if (!xy) {
			log.warn({
				action: "branch_map_geocode_miss",
				branchId: b.id,
				city: b.city,
				uf: b.state,
			});
			continue;
		}
		pins.push({
			id: b.id,
			name: b.name,
			city: b.city ?? "",
			uf: (b.state ?? "").toUpperCase(),
			address: formatBranchAddress(b),
			phone: formatPhone(b.phone),
			x: xy[0],
			y: xy[1],
			mapsUrl: branchMapsUrl(b),
		});
	}

	if (pins.length === 0) {
		return null;
	}

	const ufsWithBranch = new Set(pins.map((p) => p.uf));
	const states: StateShape[] = BRAZIL_STATES.map((s) => ({
		...s,
		highlighted: ufsWithBranch.has(s.uf),
	}));
	const mapUri = buildMapSvgDataUri(states, BRAZIL_VIEWBOX);
	const mapMaskUri = buildMapMaskDataUri(states, BRAZIL_VIEWBOX);
	const [, , mapWidth, mapHeight] = BRAZIL_VIEWBOX.split(" ").map(Number);

	return (
		<section
			aria-label="Onde estamos"
			className="overflow-hidden border-t-2 border-t-emach-red border-b border-b-white/10 bg-cinema-3 text-white [color-scheme:dark]"
		>
			<PageContainer className="grid min-h-110 grid-cols-1 px-0 md:grid-cols-[36%_1fr]">
				<div className="flex flex-col justify-center gap-4 px-5 py-12 sm:px-10 sm:py-16 md:px-16">
					<SectionLabel tone="accent">Onde estamos</SectionLabel>
					<h2 className="font-display font-semibold text-[clamp(30px,6vw,42px)] leading-[1.0] tracking-[-0.01em]">
						Encontre a filial
						<br />
						mais perto
						<br />
						de você.
					</h2>
					<p className="max-w-[42ch] text-[15px] text-white/70 leading-relaxed">
						Atendimento especializado e pronta entrega em{" "}
						{pins.length === 1 ? "nossa filial" : `${pins.length} filiais`} no
						Sul e Sudeste.
					</p>
					<div className="mt-1">
						<Link href="/sobre">
							<EmachButton size="lg" variant="outline-light">
								Ver filiais →
							</EmachButton>
						</Link>
					</div>
				</div>

				<BranchMap
					mapHeight={mapHeight}
					mapMaskUri={mapMaskUri}
					mapUri={mapUri}
					mapWidth={mapWidth}
					pins={pins}
				/>
			</PageContainer>
		</section>
	);
}
