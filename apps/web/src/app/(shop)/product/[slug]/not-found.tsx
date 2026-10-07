import { EmachLinkButton } from "@/components/emach-button";
import { StatusScreen } from "@/components/status-screen";

export default function ProductNotFound() {
	return (
		<StatusScreen
			actions={
				<>
					<EmachLinkButton href="/catalog" size="lg" variant="dark">
						Ver catálogo
					</EmachLinkButton>
					<EmachLinkButton href="/" size="lg" variant="line">
						Página inicial
					</EmachLinkButton>
				</>
			}
			lede="Pode ter sido descontinuado ou movido para outra categoria. Explore o catálogo completo para encontrar alternativas."
			title="Esse produto saiu da bancada"
		/>
	);
}
