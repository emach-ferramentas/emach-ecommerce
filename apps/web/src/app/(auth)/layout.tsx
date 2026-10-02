import { StoreFrame } from "@/components/store-frame";

export default function AuthLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return <StoreFrame>{children}</StoreFrame>;
}
