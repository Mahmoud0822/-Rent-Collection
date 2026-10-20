import { prisma } from '@/lib/prisma'
import { actor, assertUuid, errorResponse, HttpError, jsonObject, requireRole } from '@/lib/auth'
import { allocate, leaseBalance, lockLease } from '@/lib/allocation'

export async function POST(req: Request, { params }: { params: Promise<{ leaseId: string }> }) {
  let slipPath: string | undefined
  try {
    const user = await actor(); requireRole(user,'manager','staff')
    const { leaseId } = await params
    assertUuid(leaseId)
    const body = await jsonObject(req); slipPath = typeof body.slipPath==='string'?body.slipPath:undefined
    if (!Number.isSafeInteger(body.amountSen) || (body.amountSen as number) <= 0 || (body.method!=='cash'&&body.method!=='bank_transfer') || typeof body.receivedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(body.receivedAt) || !Number.isFinite(Date.parse(body.receivedAt)) || new Date(`${body.receivedAt.slice(0,10)}T00:00:00.000Z`).toISOString().slice(0,10)!==body.receivedAt.slice(0,10)) throw new HttpError(400,'Invalid payment input')
    const method=body.method as 'cash'|'bank_transfer',receivedAt=body.receivedAt as string
    if (body.method === 'bank_transfer' && (typeof slipPath !== 'string' || !slipPath.startsWith(`${user.orgId}/`))) throw new HttpError(400,'Bank transfers require a slip in your organization folder')
    if (body.method === 'cash' && slipPath) throw new HttpError(400,'Cash payments cannot have a slip')
    if (body.method === 'bank_transfer') {
      const { createClient } = await import('@supabase/supabase-js')
      const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from('payment-slips')
      const {data:file,error}=await storage.download(slipPath!)
      if(error||!file) throw new HttpError(400,'Transfer slip was not found in your organization folder')
      if(file.size>5*1024*1024||!['image/jpeg','image/png','application/pdf'].includes(file.type)) throw new HttpError(400,'Transfer slip must be a JPEG, PNG or PDF up to 5 MB')
    }
    const payment = await prisma.$transaction(async tx => {
      await lockLease(tx, leaseId)
      const lease = await tx.lease.findFirst({ where:{id:leaseId,orgId:user.orgId} })
      if (!lease) throw new HttpError(404,'Lease not found')
      const pending = await tx.payment.aggregate({ where:{leaseId,status:'pending_verification'},_sum:{amountSen:true} })
      const available = await leaseBalance(tx,lease.id) - (pending._sum.amountSen ?? 0n)
      const amount = BigInt(body.amountSen as number)
      if (amount > available) throw new HttpError(422,'Payment exceeds the remaining lease balance')
      const created = await tx.payment.create({data:{orgId:user.orgId,leaseId,amountSen:amount,method,status:user.role==='manager'?'approved':'pending_verification',receivedAt:new Date(receivedAt),slipPath:slipPath??null,createdBy:user.userId}})
      if (created.status==='approved') {
        await allocate(tx,created.id)
        await tx.auditLog.create({data:{orgId:user.orgId,actorId:user.userId,action:'payment.approved',entityId:created.id,details:{source:'manager_recording'}}})
      }
      return created
    })
    return Response.json({id:payment.id,status:payment.status},{status:201})
  } catch(e) {
    if(slipPath) { try { const { createClient } = await import('@supabase/supabase-js'); await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!).storage.from('payment-slips').remove([slipPath]) } catch {} }
    return errorResponse(e)
  }
}
