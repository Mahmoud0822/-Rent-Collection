import { prisma } from '@/lib/prisma'
import { actor, errorResponse, HttpError, jsonObject, requireRole } from '@/lib/auth'
import { generateSchedule } from '@/lib/billing'

export async function POST(req: Request) {
  try {
    const user = await actor(); requireRole(user, 'manager')
    const body = await jsonObject(req)
    if (typeof body.unitId !== 'string' || typeof body.tenantId !== 'string' || typeof body.startDate !== 'string' || typeof body.endDate !== 'string' || !Number.isSafeInteger(body.monthlyRentSen) || !Number.isSafeInteger(body.depositSen)) throw new HttpError(400, 'Invalid lease input')
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if(!uuid.test(body.unitId)||!uuid.test(body.tenantId)) throw new HttpError(400,'unitId and tenantId must be UUIDs')
    const schedule = generateSchedule({startDate:body.startDate,endDate:body.endDate,monthlyRentSen:body.monthlyRentSen as number,depositSen:body.depositSen as number})
    const monthlyRentSen=BigInt(body.monthlyRentSen as number),depositSen=BigInt(body.depositSen as number)
    const [unit, tenant] = await Promise.all([
      prisma.unit.findFirst({ where: { id: body.unitId, orgId: user.orgId } }),
      prisma.tenant.findFirst({ where: { id: body.tenantId, orgId: user.orgId } }),
    ])
    if (!unit || !tenant) throw new HttpError(404, 'Unit or tenant not found')
    const lease = await prisma.$transaction(async tx => {
      const created = await tx.lease.create({ data: {
        orgId: user.orgId, unitId: unit.id, tenantId: tenant.id,
        startDate: new Date(`${body.startDate}T00:00:00.000Z`), endDate: new Date(`${body.endDate}T00:00:00.000Z`),
        monthlyRentSen, depositSen,
      } })
      await tx.invoice.createMany({ data: schedule.map(i => ({ orgId: user.orgId, leaseId: created.id, kind: i.kind, periodIndex: i.periodIndex, periodStart: i.periodStart ? new Date(`${i.periodStart}T00:00:00.000Z`) : null, periodEnd: i.periodEnd ? new Date(`${i.periodEnd}T00:00:00.000Z`) : null, dueDate: new Date(`${i.dueDate}T00:00:00.000Z`), amountSen: BigInt(i.amountSen) })) })
      await tx.auditLog.create({ data: { orgId: user.orgId, actorId: user.userId, action: 'lease.created', entityId: created.id, details: { unitId: unit.id, tenantId: tenant.id } } })
      return created
    })
    return Response.json({ id: lease.id }, { status: 201 })
  } catch (e) {
    if (e instanceof HttpError) return errorResponse(e)
    if (typeof e === 'object' && e && 'code' in e && ['P2002','P2004','P2034'].includes((e as {code:string}).code) || e instanceof Error && /23P01|exclusion constraint/i.test(e.message)) return Response.json({ error: 'Lease overlaps another lease on this unit' }, { status: 409 })
    if (e instanceof Error && /date|integer|rent|deposit/i.test(e.message)) return Response.json({ error: e.message }, { status: 400 })
    return errorResponse(e)
  }
}
