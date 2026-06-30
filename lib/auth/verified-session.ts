import type { Session } from "next-auth"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { UserRole } from "@/lib/enums"

export type VerifiedSession = Session & {
  user: Session["user"] & {
    id: string
    email: string
    name: string
    role: UserRole
  }
}

/**
 * Server-side session normalized against the current users table.
 * JWT data is intentionally not trusted for authorization decisions because
 * admins can change roles or disable accounts while a JWT is still valid.
 */
export async function getVerifiedSession(): Promise<VerifiedSession | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id, isActive: true },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!user) return null

  return {
    ...session,
    user: {
      ...session.user,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  }
}
