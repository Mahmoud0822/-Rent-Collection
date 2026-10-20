export type InvoiceKind = 'deposit' | 'rent'

export interface ScheduledInvoice {
  kind: InvoiceKind
  periodIndex: number | null
  periodStart: string | null
  periodEnd: string | null
  dueDate: string
  amountSen: number
}

const DAY = 86_400_000

function utcEpoch(year: number, month: number, day: number): number {
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month, day)
  return date.getTime()
}

function parseCalendarDate(value: string): { year: number; month: number; day: number; epoch: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date must use YYYY-MM-DD')
  const [year, month, day] = value.split('-').map(Number)
  const epoch = utcEpoch(year, month - 1, day)
  const date = new Date(epoch)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Date is not a real calendar date')
  }
  return { year, month, day, epoch }
}

function dateString(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10)
}

function anchor(start: { year: number; month: number; day: number }, index: number): number {
  const absoluteMonth = start.year * 12 + start.month - 1 + index
  const year = Math.floor(absoluteMonth / 12)
  const month = absoluteMonth % 12
  const lastDay = new Date(utcEpoch(year, month + 1, 0)).getUTCDate()
  return utcEpoch(year, month, Math.min(start.day, lastDay))
}

export function generateSchedule(lease: {
  startDate: string
  endDate: string
  monthlyRentSen: number
  depositSen: number
}): ScheduledInvoice[] {
  const start = parseCalendarDate(lease.startDate)
  const end = parseCalendarDate(lease.endDate)
  if (end.epoch < start.epoch) throw new Error('endDate must not be before startDate')
  if (!Number.isSafeInteger(lease.monthlyRentSen) || lease.monthlyRentSen <= 0) throw new Error('monthlyRentSen must be a positive integer')
  if (!Number.isSafeInteger(lease.depositSen) || lease.depositSen < 0) throw new Error('depositSen must be a non-negative integer')

  const result: ScheduledInvoice[] = []
  if (lease.depositSen > 0) result.push({ kind: 'deposit', periodIndex: null, periodStart: null, periodEnd: null, dueDate: lease.startDate, amountSen: lease.depositSen })
  for (let k = 0; ; k++) {
    const begin = anchor(start, k)
    if (begin > end.epoch) break
    const next = anchor(start, k + 1)
    const fullDays = (next - begin) / DAY
    const usedDays = (Math.min(end.epoch, next - DAY) - begin) / DAY + 1
    // Integer arithmetic with half-up rounding. Safe integer input validation avoids float money.
    const amountSen = usedDays < fullDays
      ? Number((BigInt(lease.monthlyRentSen) * BigInt(usedDays) * 2n + BigInt(fullDays)) / (2n * BigInt(fullDays)))
      : lease.monthlyRentSen
    result.push({ kind: 'rent', periodIndex: k, periodStart: dateString(begin), periodEnd: dateString(Math.min(end.epoch, next - DAY)), dueDate: dateString(begin), amountSen })
  }
  return result
}

export type InvoiceStatus = 'paid' | 'partially_paid' | 'unpaid' | 'overdue'

export function invoiceStatus(invoice: { dueDate: string; amountSen: number; paidSen: number }, now: Date): InvoiceStatus {
  if (invoice.paidSen >= invoice.amountSen) return 'paid'
  const todayMyt = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (todayMyt > invoice.dueDate) return 'overdue'
  if (invoice.paidSen > 0) return 'partially_paid'
  return 'unpaid'
}

export function parseRinggitToSen(input: string): number {
  const value = input.trim()
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) throw new Error('Enter a valid ringgit amount')
  const [whole, fraction = ''] = value.replaceAll(',', '').split('.')
  const sen = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
  if (sen > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large')
  return Number(sen)
}
