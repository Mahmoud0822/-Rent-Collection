import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

export async function lockLease(tx: Tx, leaseId: string) {
  await tx.$queryRaw`SELECT id FROM leases WHERE id = ${leaseId}::uuid FOR UPDATE`
}

export async function allocatedAmount(tx: Tx, invoiceId: string): Promise<bigint> {
  const rows = await tx.paymentAllocation.aggregate({ where: { invoiceId }, _sum: { amountSen: true } })
  return rows._sum.amountSen ?? 0n
}

export async function leaseBalance(tx: Tx, leaseId: string): Promise<bigint> {
  const invoices = await tx.invoice.aggregate({ where: { leaseId }, _sum: { amountSen: true } })
  const allocations = await tx.paymentAllocation.aggregate({ where: { invoice: { leaseId } }, _sum: { amountSen: true } })
  return (invoices._sum.amountSen ?? 0n) - (allocations._sum.amountSen ?? 0n)
}

export async function allocate(tx: Tx, paymentId: string): Promise<void> {
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } })
  const invoices = await tx.invoice.findMany({
    where: { leaseId: payment.leaseId },
    orderBy: [{ dueDate: 'asc' }, { kind: 'asc' }, { periodIndex: 'asc' }],
  })
  let remaining = payment.amountSen
  for (const invoice of invoices) {
    if (remaining <= 0n) break
    const paid = await allocatedAmount(tx, invoice.id)
    const unpaid = invoice.amountSen - paid
    if (unpaid <= 0n) continue
    const amount = remaining < unpaid ? remaining : unpaid
    await tx.paymentAllocation.create({ data: { orgId: payment.orgId, paymentId, invoiceId: invoice.id, amountSen: amount } })
    remaining -= amount
  }
  await tx.payment.update({ where: { id: paymentId }, data: { unappliedSen: remaining } })
}
