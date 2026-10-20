import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { actor,assertUuid,errorResponse,HttpError,requireRole } from '@/lib/auth'
import { allocatedAmount } from '@/lib/allocation'

export async function POST(_req:Request,{params}:{params:Promise<{leaseId:string}>}) {
  try {
    const user=await actor(); requireRole(user,'tenant')
    const {leaseId}=await params
    assertUuid(leaseId)
    const bill=await prisma.$transaction(async tx=>{
      const lease=await tx.lease.findFirst({where:{id:leaseId,orgId:user.orgId,tenant:{userId:user.userId}}})
      if(!lease) throw new HttpError(404,'Lease not found')
      const today=new Date(new Date().getTime()+8*3600_000).toISOString().slice(0,10)
      const invoices=await tx.invoice.findMany({where:{leaseId,dueDate:{lte:new Date(`${today}T00:00:00.000Z`)}}})
      let due=0n
      for(const invoice of invoices) due+=invoice.amountSen-await allocatedAmount(tx,invoice.id)
      if(due<=0n) throw new HttpError(422,'There is nothing due now')
      const billId=`bill_${randomBytes(24).toString('hex')}`
      return tx.gatewayBill.create({data:{id:billId,orgId:user.orgId,leaseId,amountSen:due,status:'pending'}})
    })
    return Response.json({billId:bill.id,amountSen:Number(bill.amountSen)},{status:201})
  }catch(e){return errorResponse(e)}
}
