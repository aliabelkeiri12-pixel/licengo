import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/famille", "/club", "/admin", "/panier", "/commandes", "/paiement"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/")) && !req.cookies.get("licengo_session")) {
    const url = new URL("/connexion", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg).*)"] };
