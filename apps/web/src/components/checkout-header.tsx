import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { EmachLinkButton } from "@/components/emach-button";

export function CheckoutHeader() {
	return (
		<header className="border-line border-b bg-paper">
			<div className="shop-wrap flex min-h-16 items-center justify-between gap-4">
				<Link
					aria-label="EMACH Ferramentas, página inicial"
					className="inline-flex min-h-11 items-center rounded-[3px] focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
					href="/"
				>
					<Image
						alt=""
						className="h-auto w-[118px] md:w-[140px]"
						height={377}
						priority
						src="/emach-logo-black.svg"
						width={2041}
					/>
				</Link>
				<EmachLinkButton
					href="/cart"
					icon={<ArrowLeft aria-hidden="true" className="size-4" />}
					variant="link"
				>
					Voltar ao carrinho
				</EmachLinkButton>
			</div>
		</header>
	);
}
