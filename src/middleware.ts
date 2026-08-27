import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const STUDENT_PREFIX = "/dashboard/student";
const TEACHER_PREFIX = "/dashboard/teacher";
const ADMIN_PREFIX = "/dashboard/admin";
const PUBLIC_PATHS = ["/", "/login", "/signup", "/join"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.includes(path) || path.startsWith("/api/public");

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    // Role is fetched once per request; RLS is still the real enforcement
    // boundary for data access, this just avoids showing the wrong shell.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    const roleHome =
      role === "teacher" ? TEACHER_PREFIX : role === "admin" ? ADMIN_PREFIX : STUDENT_PREFIX;

    const wrongSection =
      (path.startsWith(STUDENT_PREFIX) && role !== "student") ||
      (path.startsWith(TEACHER_PREFIX) && role !== "teacher") ||
      (path.startsWith(ADMIN_PREFIX) && role !== "admin");

    if (wrongSection) {
      return NextResponse.redirect(new URL(roleHome, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and the OpenNext/Cloudflare
     * asset handler paths, to keep the Worker's request volume (and Free
     * plan usage) down.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|mp3|wav)$).*)",
  ],
};
