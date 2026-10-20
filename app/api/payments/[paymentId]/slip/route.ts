import {createClient as createSupabaseClient} from '@supabase/supabase-js'
import {actor,assertUuid,errorResponse,HttpError,requireRole} from '@/lib/auth'
import {prisma} from '@/lib/prisma'

export async function GET(_req:Request,{params}:{params:Promise<{paymentId:string}>}){
 try{
  const user=await actor();requireRole(user,'manager','staff')
  const {paymentId}=await params
  assertUuid(paymentId)
  const payment=await prisma.payment.findFirst({where:{id:paymentId,orgId:user.orgId}})
  if(!payment)throw new HttpError(404,'Payment not found')
  if(!payment.slipPath||!payment.slipPath.startsWith(`${user.orgId}/`))throw new HttpError(404,'Slip not found')
  const storage=createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from('payment-slips')
  const {data,error}=await storage.createSignedUrl(payment.slipPath,60)
  if(error||!data)throw new HttpError(404,'Slip not found')
  return Response.redirect(data.signedUrl)
 }catch(e){return errorResponse(e)}
}
