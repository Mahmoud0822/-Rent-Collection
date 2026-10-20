import Link from 'next/link'
import {redirect} from 'next/navigation'
import {actor} from '@/lib/auth'
import {prisma} from '@/lib/prisma'

export default async function ReturnPage({searchParams}:{searchParams:Promise<{bill_id?:string;paid?:string}>}){
 let user;try{user=await actor()}catch{redirect('/login')}
 const {bill_id}=await searchParams
 const bill=bill_id?await prisma.gatewayBill.findFirst({where:{id:bill_id,orgId:user.orgId,...(user.role==='tenant'?{lease:{tenant:{userId:user.userId}}}:{})}}):null
 return <main className="mx-auto max-w-xl px-5 py-16"><div className="rounded-xl border bg-white p-7"><h1 className="text-2xl font-semibold">Payment status</h1>{bill?<><p className="mt-4">Bill: <code>{bill.id}</code></p><p className="mt-2">Amount: RM {(Number(bill.amountSen)/100).toFixed(2)}</p><p className="mt-2 capitalize">Status: {bill.status}</p><p className="mt-3 text-sm text-slate-500">This page reads the saved status. The gateway webhook updates it.</p></>:<p className="mt-4 text-slate-500">Bill not found.</p>}<Link className="mt-6 inline-block" href="/">Back to dashboard</Link></div></main>
}
