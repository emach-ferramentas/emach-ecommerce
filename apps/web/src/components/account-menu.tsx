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
				aria-label="Conta"
				className="flex size-8 items-center justify-center rounded-[2px] border-[1.5px] border-gray-500/50 text-white/80 transition-colors hover:border-white/70 hover:text-white"
				href={{ pathname: "/login", query: { redirect: pathname } }}
			>
				<User className="size-4.5" />
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label="Conta"
				className="cursor-pointer text-white/80 hover:text-white"
			>
				<Avatar
					className="size-8 border-[1.5px] border-gray-500/50"
					size="default"
				>
					{session.user.image && (
						<AvatarImage
							alt={session.user.name ?? "Conta"}
							src={session.user.image}
						/>
					)}
					<AvatarFallback className="flex items-center border-emach-red bg-white/10 text-base text-white">
						{getInitials(session.user.name ?? "")}
					</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60 p-0">
				<div className="flex items-center gap-3 bg-near-black p-4 text-white">
					<Avatar className="size-9.5 shrink-0" size="default">
						{session.user.image && (
							<AvatarImage
								alt={session.user.name ?? "Conta"}
								src={session.user.image}
							/>
						)}
						<AvatarFallback className="bg-white font-semibold text-[15px] text-near-black">
							{getInitials(session.user.name ?? "")}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<div className="font-display font-semibold text-[11px] text-emach-red uppercase tracking-[0.16em]">
							Minha conta
						</div>
						<div className="truncate font-semibold text-[14px] leading-tight">
							{session.user.name}
						</div>
						<div className="truncate text-[11.5px] text-white/65">
							{session.user.email}
						</div>
					</div>
				</div>
				<div>
					<DropdownMenuItem
						className="relative gap-3 px-3 py-2.5 text-[13.5px] focus:before:absolute focus:before:inset-y-0 focus:before:left-0 focus:before:w-[3px] focus:before:bg-emach-red"
						render={<Link href="/dashboard/pedidos" />}
					>
						<Package />
						Meus pedidos
					</DropdownMenuItem>
					<DropdownMenuItem
						className="relative gap-3 px-3 py-2.5 text-[13.5px] focus:before:absolute focus:before:inset-y-0 focus:before:left-0 focus:before:w-[3px] focus:before:bg-emach-red"
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
