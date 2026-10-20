import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export type Actor = { userId: string; role: 'manager'|'staff'|'tenant'; orgId: string }
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(404,'Record not found')
}

export async function actor(): Promise<Actor> {
  const supabase = await createClient()
  const authorization=(await headers()).get('authorization')
  const token=authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Authentication required')
  const membership = await prisma.membership.findUnique({ where: { userId: data.user.id } })
  if (membership) return { userId: data.user.id, orgId: membership.orgId, role: membership.role }
  const tenant = await prisma.tenant.findFirst({ where: { userId: data.user.id } })
  if (tenant) return { userId: data.user.id, orgId: tenant.orgId, role: 'tenant' }
  throw new HttpError(403, 'No application access')
}

export function requireRole(user: Actor, ...roles: Actor['role'][]) {
  if (!roles.includes(user.role)) throw new HttpError(403, 'Forbidden')
}

export async function jsonObject(req: Request): Promise<Record<string, unknown>> {
  let value: unknown
  try { value = await req.json() } catch { throw new HttpError(400, 'Request body must be valid JSON') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Request body must be a JSON object')
  return value as Record<string, unknown>
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status })
  console.error('Request failed:', error instanceof Error ? error.message : 'unknown error')
  return Response.json({ error: 'Internal server error' }, { status: 500 })
}
