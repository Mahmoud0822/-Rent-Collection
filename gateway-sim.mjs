import { createHmac } from 'node:crypto'

const [billId, amountSen, paid = 'true'] = process.argv.slice(2)
if (!billId || !amountSen || !['true','false'].includes(paid)) {
  console.error('Usage: node gateway-sim.mjs <bill_id> <amount_sen> [true|false]')
  process.exit(2)
}
const url = process.env.WEBHOOK_URL ?? 'http://127.0.0.1:3000/api/webhooks/gateway'
const key = process.env.GATEWAY_X_SIGNATURE_KEY
if (!key) {
  console.error('Set GATEWAY_X_SIGNATURE_KEY before running the simulator.')
  process.exit(2)
}
const myt = new Date(Date.now() + 8 * 3600_000).toISOString()
const fields = {
  id: billId,
  paid,
  paid_amount: paid === 'true' ? amountSen : '0',
  paid_at: `${myt.slice(0, 10)} ${myt.slice(11, 19)} +0800`,
  transaction_id: `TX-${Date.now()}`,
  transaction_status: paid === 'true' ? 'completed' : 'failed',
}
const source = Object.keys(fields).sort().map(k => `${k}${fields[k]}`).join('|')
fields.x_signature = createHmac('sha256', key).update(source).digest('hex')
const response = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields),
})
console.log(response.status, await response.text())
