import { prisma } from '@/lib/prisma'
import { actor,assertUuid,errorResponse,HttpError,jsonObject,requireRole } from '@/lib/auth'
import { lockLease } from '@/lib/allocation'

export async function POST(req:Request,{params}:{params:Promise<{paymentId:string}>}) {
  try {
    const user=await actor(); requireRole(user,'manager')
    const {paymentId}=await params;assertUuid(paymentId); const body=await jsonObject(req)
    if(typeof body.reason!=='string'||body.reason.trim().length<5) throw new HttpError(400,'A void reason of at least 5 characters is required')
    const reason=body.reason.trim()
    await prisma.$transaction(async tx=>{
      const payment=await tx.payment.findFirst({where:{id:paymentId,orgId:user.orgId}})
      if(!payment) throw new HttpError(404,'Payment not found')
      await lockLease(tx,payment.leaseId)
      if(payment.status!=='approved') throw new HttpError(409,'Payment is not approved')
      const changed=await tx.payment.updateMany({where:{id:paymentId,status:'approved'},data:{status:'voided',unappliedSen:0n}})
      if(changed.count!==1) throw new HttpError(409,'Payment is not approved')
      await tx.paymentAllocation.deleteMany({where:{paymentId}})
      await tx.auditLog.create({data:{orgId:user.orgId,actorId:user.userId,action:'payment.voided',entityId:paymentId,details:{reason}}})
    })
    return Response.json({status:'voided'})
  }catch(e){return errorResponse(e)}
}
