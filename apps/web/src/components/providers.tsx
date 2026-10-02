"use client";

import { Toaster } from "@emach/ui/components/sonner";

import { QuickViewProvider } from "@/components/quick-view";
import { CartProvider } from "@/lib/cart-context";

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<CartProvider>
			<QuickViewProvider>{children}</QuickViewProvider>
			<Toaster
				position="bottom-right"
				toastOptions={{
					classNames: {
						toast: "emach-toast",
						title: "emach-toast__title",
					},
				}}
			/>
		</CartProvider>
	);
}
