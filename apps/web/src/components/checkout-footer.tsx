import Image from "next/image";
import Link from "next/link";

export function CheckoutFooter() {
	return (
		<footer
			className="bg-cinema-3 px-4 py-6 text-gray-60 sm:px-6 lg:px-10"
			role="contentinfo"
		>
			<div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
				<Link
					aria-label="EMACH — voltar à home"
					className="inline-flex shrink-0"
					href="/"
				>
					<Image
						alt="EMACH"
						className="h-6 w-auto"
						height={377}
						priority={false}
						src="/emach-logo-red.svg"
						width={2041}
					/>
				</Link>
				<p className="text-[12px] text-gray-55">CNPJ 04.128.615/0001-59</p>
				<p className="text-[12px] text-gray-55">
					<span className="text-emach-red">©</span> 2026 EMACH
				</p>
			</div>
		</footer>
	);
}
