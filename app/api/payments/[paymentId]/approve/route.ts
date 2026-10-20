import { prisma } from '@/lib/prisma'
import { actor,assertUuid,errorResponse,HttpError,requireRole } from '@/lib/auth'
import { allocate,leaseBalance,lockLease } from '@/lib/allocation'

export async function POST(_req:Request,{params}:{params:Promise<{paymentId:string}>}) {
  try {
    const user=await actor(); requireRole(user,'manager')
    const {paymentId}=await params
    assertUuid(paymentId)
    await prisma.$transaction(async tx=>{
      const payment=await tx.payment.findFirst({where:{id:paymentId,orgId:user.orgId}})
      if(!payment) throw new HttpError(404,'Payment not found')
      await lockLease(tx,payment.leaseId)
      const locked=await tx.payment.findUniqueOrThrow({where:{id:payment.id}})
      if(locked.status!=='pending_verification') throw new HttpError(409,'Payment is not pending verification')
      if(locked.amountSen>await leaseBalance(tx,locked.leaseId)) throw new HttpError(422,'Payment exceeds the remaining lease balance')
      const changed=await tx.payment.updateMany({where:{id:locked.id,status:'pending_verification'},data:{status:'approved'}})
      if(changed.count!==1) throw new HttpError(409,'Payment is not pending verification')
      await allocate(tx,locked.id)
      await tx.auditLog.create({data:{orgId:user.orgId,actorId:user.userId,action:'payment.approved',entityId:locked.id,details:{}}})
    })
    return Response.json({status:'approved'})
  } catch(e){return errorResponse(e)}
}
