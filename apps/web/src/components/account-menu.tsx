"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@emach/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@emach/ui/components/dropdown-menu";
import { LogOut, Package, User, UserCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut, useSession } from "@/lib/auth-client";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function AccountMenu() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  if (isPending || !session?.user) {
    return (
      <Link
        aria-label="Conta"
        className="text-white/80 hover:text-white"
        href="/login"
      >
        <User className="size-6" />
      </Link>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sessão encerrada");
    router.push("/");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Conta"
        className="cursor-pointer text-white/80 hover:text-white"
      >
        <Avatar
          className="size-8 border-gray-500/50 border-[1.5px]"
          size="default"
        >
          {session.user.image && (
            <AvatarImage
              alt={session.user.name ?? "Conta"}
              src={session.user.image}
            />
          )}
          <AvatarFallback className="bg-white/10 border-emach-red text-md flex items-center text-white">
            {getInitials(session.user.name ?? "")}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{session.user.name}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard/pedidos" />}>
          <Package />
          Meus pedidos
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/dashboard/dados-pessoais" />}>
          <UserCog />
          Meus dados
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} variant="destructive">
          <LogOut />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
