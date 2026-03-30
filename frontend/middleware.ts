import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  let deathSentence = false; // Flag pre zmazanie cookie
  let debugMessage = "N/A"; // Správa od servera

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          
          cookiesToSet.forEach(({ name, value, options }) => {
            if (!value || value === "") {
               // 🚨 Server chce zmazať cookie!
               deathSentence = true;
               debugMessage = `SMRTEĽNÝ PRÍKAZ: Zmazanie cookie ${name}`;
            }
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();
  
  if (error) {
     debugMessage = `getUser() ZLYHAL: ${error.message}`;
  } else if (!deathSentence) {
     debugMessage = `getUser() OK. ID: ${data?.user?.id}`;
  }

  // 🕵️ Vložíme naše zistenia do hlavičiek odpovede, aby sme to videli v F12!
  supabaseResponse.headers.set('X-Debug-Death-Sentence', deathSentence ? "YES" : "NO");
  supabaseResponse.headers.set('X-Debug-Message', encodeURIComponent(debugMessage));

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
