import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const hostname = req.headers.get("host") ?? "";
  const isHelpdesk = hostname.startsWith("helpdesk.");

  if (isHelpdesk) {
    const url = req.nextUrl.clone();
    if (!url.pathname.startsWith("/helpdesk")) {
      url.pathname =
        url.pathname === "/" ? "/helpdesk/portal" : `/helpdesk${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.png|banner.png|helpdesk.banner.png|pixa.png).*)"],
};
