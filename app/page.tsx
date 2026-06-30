import { redirect } from "next/navigation"
import { getVerifiedSession } from "@/lib/auth/verified-session"
import { landingPathForRole } from "@/lib/auth/landing"

export default async function HomePage() {
  const session = await getVerifiedSession()
  if (!session) redirect("/login")
  redirect(landingPathForRole(session.user.role))
}
