// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const RE = (x: string) => new RegExp(`^\\/(?:auth\\/)?${x}(?:\\/)?$`, "i");

const PUBLIC_ROUTES = [
  /^\/$/i,
  RE("signin"),
  RE("signup"),
  RE("reset-password"),
  RE("update-password"),
  RE("forgot-password"),
  /^\/favicon\.ico$/i,
];

function createSb(req: NextRequest, res: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        // <- options: any, a voláme ResponseCookies.set s (name, value, options)
        set(name: string, value: string, options?: any) {
          res.cookies.set(name, value, options);
        },
        remove(name: string, options?: any) {
          res.cookies.set(name, "", options);
        },
      },
    }
  );
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const res = NextResponse.next();

  const sb = createSb(req, res);
  const {
    data: { session },
  } = await sb.auth.getSession();

  const isPublic = PUBLIC_ROUTES.some((re) => re.test(url.pathname));

  if (isPublic) {
    if (
      session &&
      (RE("signin").test(url.pathname) || RE("signup").test(url.pathname))
    ) {
      url.pathname = "/dashboard";
      return NextResponse.redirect(url, { headers: res.headers });
    }
    return res;
  }

  if (!session) {
    const login = new URL("/signin", req.url);
    login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login, { headers: res.headers });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/|static/|images/|favicon.ico).*)"],
};
