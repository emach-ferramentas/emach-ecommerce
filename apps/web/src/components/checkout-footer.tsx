import Image from "next/image";
import Link from "next/link";

export function CheckoutFooter() {
	return (
		<footer className="bg-grafite-deep text-on-dark-muted">
			<div className="shop-wrap flex flex-wrap items-center justify-between gap-4 py-6 text-[13.5px]">
				<Link
					aria-label="EMACH Ferramentas, página inicial"
					className="inline-flex min-h-11 items-center rounded-[3px] focus-visible:outline-2 focus-visible:outline-on-dark focus-visible:outline-offset-2"
					href="/"
				>
					<Image
						alt=""
						className="h-auto w-[110px]"
						height={377}
						src="/emach-logo.svg"
						width={2041}
					/>
				</Link>
				<p>
					EMACH Ferramentas · CNPJ{" "}
					<span className="tabular-nums">04.128.615/0001-59</span>
				</p>
			</div>
		</footer>
	);
}
