import { createHmac,timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { allocate,lockLease } from '@/lib/allocation'

export async function POST(req:Request) {
  let fields:Record<string,string>
  try{const form=await req.formData();fields=Object.fromEntries(form.entries()) as Record<string,string>}
  catch{return Response.json({error:'Invalid signature'},{status:401})}
  const supplied=fields.x_signature
  if(!supplied) return Response.json({error:'Invalid signature'},{status:401})
  const source=Object.keys(fields).filter(k=>k!=='x_signature').sort().map(k=>`${k}${fields[k]}`).join('|')
  const expected=createHmac('sha256',process.env.GATEWAY_X_SIGNATURE_KEY??'').update(source).digest('hex')
  const a=Buffer.from(supplied,'utf8'), b=Buffer.from(expected,'utf8')
  if(a.length!==b.length||!timingSafeEqual(a,b)) return Response.json({error:'Invalid signature'},{status:401})
  const billId=fields.id
  if(!billId) return Response.json({error:'Unknown bill'},{status:404})
  try {
    const outcome=await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM gateway_bills WHERE id=${billId} FOR UPDATE`
      const bill=await tx.gatewayBill.findUnique({where:{id:billId}})
      if(!bill) return 'unknown' as const
      if(fields.paid!=='true'&&fields.paid!=='false') return 'invalid-paid' as const
      if(fields.paid==='true') {
        if(!/^\d+$/.test(fields.paid_amount??'')||BigInt(fields.paid_amount)!==bill.amountSen) return 'amount' as const
        if(bill.status==='paid') return 'ok' as const
        if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{4}$/.test(fields.paid_at??'')) return 'invalid-date' as const
        const receivedAt=Date.parse(fields.paid_at??'')
        if(!Number.isFinite(receivedAt)) return 'invalid-date' as const
        await lockLease(tx,bill.leaseId)
        await tx.gatewayBill.update({where:{id:bill.id},data:{status:'paid'}})
        const payment=await tx.payment.create({data:{orgId:bill.orgId,leaseId:bill.leaseId,amountSen:bill.amountSen,method:'online',status:'approved',receivedAt:new Date(receivedAt),gatewayBillId:bill.id}})
        await allocate(tx,payment.id)
        await tx.auditLog.create({data:{orgId:bill.orgId,actorId:null,action:'payment.gateway_settled',entityId:payment.id,details:{billId:bill.id}}})
        return 'ok' as const
      }
      if(bill.status==='pending') await tx.gatewayBill.update({where:{id:bill.id},data:{status:'failed'}})
      return 'ok' as const
    })
    if(outcome==='unknown') return Response.json({error:'Unknown bill'},{status:404})
    if(outcome==='invalid-paid') return Response.json({error:'paid must be true or false'},{status:422})
    if(outcome==='amount') return Response.json({error:'Paid amount does not match bill'},{status:422})
    if(outcome==='invalid-date') return Response.json({error:'Invalid paid_at'},{status:422})
    return Response.json({ok:true})
  }catch(e){console.error('Gateway webhook failed',e instanceof Error?e.message:'unknown error');return Response.json({error:'Webhook processing failed'},{status:500})}
}
