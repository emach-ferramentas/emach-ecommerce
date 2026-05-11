import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/dashboard"];

const runEvlog = evlogMiddleware({
	exclude: ["/api/auth/**", "/_next/**", "/favicon/**"],
});

export async function middleware(req: NextRequest) {
	const isProtected = PROTECTED.some((p) => req.nextUrl.pathname.startsWith(p));

	if (isProtected) {
		const token = req.cookies.get("ecommerce.session_token");
		if (!token) {
			const url = req.nextUrl.clone();
			url.pathname = "/login";
			url.searchParams.set("redirect", req.nextUrl.pathname);
			return NextResponse.redirect(url);
		}
	}

	return await runEvlog(req);
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon|images|.*\\.png$|.*\\.svg$).*)",
	],
};
