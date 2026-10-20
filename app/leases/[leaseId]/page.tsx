import {redirect,notFound} from 'next/navigation'
import Link from 'next/link'
import {actor,assertUuid,HttpError} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {invoiceStatus} from '@/lib/billing'
import {LeaseActions,PaymentReview} from '@/components/lease-actions'
import {LogoutButton} from '@/components/logout-button'

function money(sen:bigint|number){return new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR'}).format(Number(sen)/100)}
export default async function LeasePage({params}:{params:Promise<{leaseId:string}>}){
 let user;try{user=await actor()}catch{redirect('/login')}
 const {leaseId}=await params
 try{assertUuid(leaseId)}catch(error){if(error instanceof HttpError)notFound();throw error}
 const lease=await prisma.lease.findFirst({where:{id:leaseId,orgId:user.orgId,...(user.role==='tenant'?{tenant:{userId:user.userId}}:{})},include:{unit:true,tenant:true,invoices:{include:{allocations:true},orderBy:[{dueDate:'asc'},{kind:'asc'},{periodIndex:'asc'}]},payments:{orderBy:{receivedAt:'desc'}}}})
 if(!lease)notFound()
 const now=new Date(),nowMyt=new Date(now.getTime()+8*3600_000)
 return <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-5 py-8 md:px-8"><header className="flex items-center justify-between"><div><Link href="/" className="text-sm">← Dashboard</Link><h1 className="mt-2 text-2xl font-semibold">{lease.unit.name} · {lease.tenant.fullName}</h1><p className="text-sm text-slate-500">{lease.startDate.toISOString().slice(0,10)} – {lease.endDate.toISOString().slice(0,10)}</p></div><LogoutButton/></header>
  <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><h2 className="p-5 font-semibold">Invoices</h2><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Period','Due date','Amount','Paid','Status'].map(x=><th key={x} className="px-4 py-3 font-medium">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{lease.invoices.map(i=>{const paid=i.allocations.reduce((s,a)=>s+a.amountSen,0n);const status=invoiceStatus({dueDate:i.dueDate.toISOString().slice(0,10),amountSen:Number(i.amountSen),paidSen:Number(paid)},now);return <tr key={i.id}><td className="px-4 py-3">{i.kind==='deposit'?'Deposit':`${i.periodStart?.toISOString().slice(0,10)} – ${i.periodEnd?.toISOString().slice(0,10)}`}</td><td className="px-4 py-3">{i.dueDate.toISOString().slice(0,10)}</td><td className="px-4 py-3">{money(i.amountSen)}</td><td className="px-4 py-3">{money(paid)}</td><td className="px-4 py-3 capitalize">{status.replace('_',' ')}</td></tr>})}</tbody></table></section>
  <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><h2 className="p-5 font-semibold">Payments</h2>{lease.payments.length===0?<p className="px-5 pb-5 text-sm text-slate-500">No payments yet.</p>:<table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Received (MYT)','Method','Amount','Status','Slip / action'].map(x=><th key={x} className="px-4 py-3 font-medium">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{lease.payments.map(p=><tr key={p.id}><td className="px-4 py-3">{new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'}).format(p.receivedAt)}</td><td className="px-4 py-3 capitalize">{p.method.replace('_',' ')}</td><td className="px-4 py-3">{money(p.amountSen)}</td><td className="px-4 py-3 capitalize">{p.status.replace('_',' ')}</td><td className="flex items-center gap-3 px-4 py-3">{p.slipPath&&user.role!=='tenant'&&<Link href={`/api/payments/${p.id}/slip`} target="_blank">View slip</Link>}<PaymentReview paymentId={p.id} status={p.status} role={user.role}/></td></tr>)}</tbody></table>}</section>
  <LeaseActions leaseId={lease.id} orgId={lease.orgId} role={user.role} tenantId={lease.tenantId} phone={lease.tenant.phone} defaultReceivedAt={new Date(Date.now()+8*3600_000).toISOString().slice(0,16)}/>
  <p className="text-xs text-slate-400">Malaysia time · {new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium'}).format(nowMyt)}</p>
 </main>
}
