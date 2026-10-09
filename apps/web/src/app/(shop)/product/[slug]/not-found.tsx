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
			lede="Ele pode ter saído de linha ou mudado de categoria. Procure um modelo parecido no catálogo."
			title="Produto não encontrado"
		/>
	);
}
