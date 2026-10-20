import { prisma } from '@/lib/prisma'
import { actor,assertUuid,errorResponse,HttpError,jsonObject,requireRole } from '@/lib/auth'

export async function POST(req:Request,{params}:{params:Promise<{paymentId:string}>}) {
  try {
    const user=await actor(); requireRole(user,'manager')
    const {paymentId}=await params;assertUuid(paymentId); const body=await jsonObject(req)
    if(typeof body.reason!=='string'||body.reason.trim().length<5) throw new HttpError(400,'A rejection reason of at least 5 characters is required')
    const reason=body.reason.trim()
    await prisma.$transaction(async tx=>{
      const result=await tx.payment.updateMany({where:{id:paymentId,orgId:user.orgId,status:'pending_verification'},data:{status:'rejected',rejectionReason:reason}})
      if(result.count===0){const visible=await tx.payment.findFirst({where:{id:paymentId,orgId:user.orgId}});if(!visible)throw new HttpError(404,'Payment not found');throw new HttpError(409,'Payment is not pending verification')}
      await tx.auditLog.create({data:{orgId:user.orgId,actorId:user.userId,action:'payment.rejected',entityId:paymentId,details:{reason}}})
    })
    return Response.json({status:'rejected'})
  }catch(e){return errorResponse(e)}
}
