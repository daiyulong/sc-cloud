import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { landingPathForRole } from "@/lib/auth/landing"

export default async function HomePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  redirect(landingPathForRole(session.user.role))
}
