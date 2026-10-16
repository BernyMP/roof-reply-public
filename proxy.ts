import { NextResponse } from "next/server"
import { indexingEnabled, shouldNoIndex } from "@/lib/seo"
import { clerkMiddleware } from "@clerk/nextjs/server"

export default clerkMiddleware((_auth, request) => {
  const response = NextResponse.next()
  if (shouldNoIndex(request.headers.get("host"), request.nextUrl.pathname, indexingEnabled())) {
    response.headers.set("X-Robots-Tag", "noindex, follow")
  }
  return response
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}

