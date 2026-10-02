import type { Metadata } from "next";

import { EmachLinkButton } from "@/components/emach-button";
import { StatusScreen } from "@/components/status-screen";
import { StoreFrame } from "@/components/store-frame";

export const metadata: Metadata = {
	title: "Página não encontrada",
};

export default function NotFound() {
	return (
		<StoreFrame>
			<StatusScreen
				actions={
					<>
						<EmachLinkButton href="/" size="lg" variant="dark">
							Página inicial
						</EmachLinkButton>
						<EmachLinkButton href="/catalog" size="lg" variant="line">
							Ver catálogo
						</EmachLinkButton>
					</>
				}
				lede="Essa página pode ter sido movida, renomeada ou ainda está na oficina. Volte ao catálogo para seguir explorando."
				title="Página não encontrada"
			/>
		</StoreFrame>
	);
}
