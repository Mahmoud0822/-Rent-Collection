import { prisma } from '@/lib/prisma'
import { actor, assertUuid, errorResponse, HttpError, requireRole } from '@/lib/auth'
import { invoiceStatus } from '@/lib/billing'

export async function GET(_req: Request, { params }: { params: Promise<{ leaseId: string }> }) {
  try {
    const user = await actor(); requireRole(user, 'manager', 'staff', 'tenant')
    const { leaseId } = await params
    assertUuid(leaseId)
    const lease = await prisma.lease.findFirst({ where: { id: leaseId, orgId: user.orgId, ...(user.role === 'tenant' ? { tenant: { userId: user.userId } } : {}) }, include: { invoices: { include: { allocations: true }, orderBy: [{ dueDate: 'asc' }, { kind: 'asc' }, { periodIndex: 'asc' }] }, payments: { orderBy: { receivedAt: 'desc' } } } })
    if (!lease) throw new HttpError(404, 'Lease not found')
    return Response.json({
      lease: { id: lease.id, unitId: lease.unitId, tenantId: lease.tenantId, startDate: lease.startDate.toISOString().slice(0,10), endDate: lease.endDate.toISOString().slice(0,10), monthlyRentSen: Number(lease.monthlyRentSen), depositSen: Number(lease.depositSen) },
      invoices: lease.invoices.map(i => { const paidSen = i.allocations.reduce((s,a) => s+a.amountSen,0n); return { id:i.id,kind:i.kind,periodIndex:i.periodIndex,periodStart:i.periodStart?.toISOString().slice(0,10)??null,periodEnd:i.periodEnd?.toISOString().slice(0,10)??null,dueDate:i.dueDate.toISOString().slice(0,10),amountSen:Number(i.amountSen),paidSen:Number(paidSen),status:invoiceStatus({dueDate:i.dueDate.toISOString().slice(0,10),amountSen:Number(i.amountSen),paidSen:Number(paidSen)},new Date()) } }),
      payments: lease.payments.map(p => ({ id:p.id,amountSen:Number(p.amountSen),unappliedSen:Number(p.unappliedSen),method:p.method,status:p.status,receivedAt:p.receivedAt.toISOString(),slipPath:p.slipPath })),
    })
  } catch(e) { return errorResponse(e) }
}
