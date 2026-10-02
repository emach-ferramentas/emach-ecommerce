"use client";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@emach/ui/components/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@emach/ui/components/dropdown-menu";
import { LogOut, Package, User, UserCog } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useSignOut } from "@/lib/use-sign-out";

const WHITESPACE_RE = /\s+/;

function getInitials(name: string) {
	const parts = name.trim().split(WHITESPACE_RE);
	const first = parts[0]?.[0] ?? "";
	const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
	return (first + last).toUpperCase() || "?";
}

export function AccountMenu() {
	const { data: session, isPending } = useSession();
	const pathname = usePathname();
	const handleSignOut = useSignOut();

	if (isPending || !session?.user) {
		return (
			<Link
				className="flex min-h-[52px] items-center gap-2.5 rounded-[3px] px-3 text-ink no-underline hover:bg-canteiro"
				href={{ pathname: "/login", query: { redirect: pathname } }}
			>
				<User aria-hidden="true" className="size-6" />
				<span>
					<b className="block font-bold text-[14.5px] leading-tight">Entrar</b>
					<small className="block whitespace-nowrap text-[12.5px] text-ink-muted leading-tight max-lg:hidden">
						Pedidos e conta
					</small>
				</span>
			</Link>
		);
	}

	const firstName = session.user.name?.trim().split(WHITESPACE_RE)[0] ?? "";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label="Minha conta"
				className="flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-[3px] px-3 text-left text-ink hover:bg-canteiro"
			>
				<Avatar className="size-8 border border-line" size="default">
					{session.user.image && (
						<AvatarImage alt="" src={session.user.image} />
					)}
					<AvatarFallback className="flex items-center bg-grafite text-[13px] text-on-dark">
						{getInitials(session.user.name ?? "")}
					</AvatarFallback>
				</Avatar>
				<span className="max-lg:hidden">
					<b className="block font-bold text-[14.5px] leading-tight">
						{firstName || "Minha conta"}
					</b>
					<small className="block whitespace-nowrap text-[12.5px] text-ink-muted leading-tight">
						Pedidos e conta
					</small>
				</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60 p-0">
				<div className="flex items-center gap-3 bg-grafite p-4 text-on-dark">
					<Avatar className="size-9.5 shrink-0" size="default">
						{session.user.image && (
							<AvatarImage
								alt={session.user.name ?? "Conta"}
								src={session.user.image}
							/>
						)}
						<AvatarFallback className="bg-paper font-semibold text-[15px] text-ink">
							{getInitials(session.user.name ?? "")}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<div className="font-bold text-[12px] text-on-dark-muted">
							Minha conta
						</div>
						<div className="truncate font-semibold text-[14px] leading-tight">
							{session.user.name}
						</div>
						<div className="truncate text-[11.5px] text-on-dark-muted">
							{session.user.email}
						</div>
					</div>
				</div>
				<div>
					<DropdownMenuItem
						className="relative gap-3 px-3 py-2.5 text-[13.5px] focus:before:absolute focus:before:inset-y-0 focus:before:left-0 focus:before:w-[3px] focus:before:bg-grafite"
						render={<Link href="/dashboard/pedidos" />}
					>
						<Package />
						Meus pedidos
					</DropdownMenuItem>
					<DropdownMenuItem
						className="relative gap-3 px-3 py-2.5 text-[13.5px] focus:before:absolute focus:before:inset-y-0 focus:before:left-0 focus:before:w-[3px] focus:before:bg-grafite"
						render={<Link href="/dashboard/dados-pessoais" />}
					>
						<UserCog />
						Meus dados
					</DropdownMenuItem>
					<DropdownMenuItem
						className="gap-3 px-3 py-2.5 text-[13.5px]"
						onClick={handleSignOut}
						variant="destructive"
					>
						<LogOut />
						Sair
					</DropdownMenuItem>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
