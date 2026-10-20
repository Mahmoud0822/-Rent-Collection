import Link from 'next/link'
import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {prisma} from '@/lib/prisma'
import {invoiceStatus} from '@/lib/billing'
import {LogoutButton} from '@/components/logout-button'
import {CreateLeaseForm} from '@/components/create-lease-form'

function money(sen:bigint|number){return new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR'}).format(Number(sen)/100)}
function malaysiaMonth(offset:number){const now=new Date(Date.now()+8*3600_000);const month=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+offset,1));return month.toISOString().slice(0,7)}

export default async function Dashboard(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login')
 const membership=await prisma.membership.findUnique({where:{userId:user.id}})
 const tenant=membership?null:await prisma.tenant.findFirst({where:{userId:user.id}})
 if(!membership&&!tenant)redirect('/login')
 const orgId=membership?.orgId??tenant!.orgId
 const orgName=await prisma.organization.findUnique({where:{id:orgId},select:{name:true}})
 const units=membership?.role==='manager'?await prisma.unit.findMany({where:{orgId},orderBy:{name:'asc'},select:{id:true,name:true}}):[]
 const tenantChoices=membership?.role==='manager'?await prisma.tenant.findMany({where:{orgId},orderBy:{fullName:'asc'},select:{id:true,fullName:true}}):[]
 const leases=await prisma.lease.findMany({where:{orgId,...(tenant?{tenantId:tenant.id}:{})},include:{unit:true,tenant:true,invoices:{include:{allocations:true},orderBy:[{dueDate:'asc'},{kind:'asc'},{periodIndex:'asc'}]},payments:{orderBy:{receivedAt:'desc'}}},orderBy:{createdAt:'desc'}})
 const today=new Date(Date.now()+8*3600_000).toISOString().slice(0,10)
 const overdue=leases.flatMap(l=>l.invoices).filter(i=>invoiceStatus({dueDate:i.dueDate.toISOString().slice(0,10),amountSen:Number(i.amountSen),paidSen:Number(i.allocations.reduce((s,a)=>s+a.amountSen,0n))},new Date())==='overdue').length
 const months=Array.from({length:6},(_,i)=>malaysiaMonth(i-5))
 const report=membership?await prisma.$queryRaw<{month_key:string,total:bigint}[]>`SELECT to_char(timezone('Asia/Kuala_Lumpur',received_at),'YYYY-MM') AS month_key,SUM(amount_sen)::bigint total FROM payments WHERE org_id=${orgId}::uuid AND status='approved' AND received_at>=${new Date(`${months[0]}-01T00:00:00+08:00`)} AND received_at<${new Date(`${malaysiaMonth(1)}-01T00:00:00+08:00`)} GROUP BY 1` : []
 const totals=new Map(report.map(x=>[x.month_key,x.total]))
 const dueNow=leases.reduce((sum,l)=>sum+l.invoices.filter(i=>i.dueDate.toISOString().slice(0,10)<=today).reduce((n,i)=>n+i.amountSen-i.allocations.reduce((s,a)=>s+a.amountSen,0n),0n),0n)
 return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 md:px-8"><header className="flex items-center justify-between"><div><p className="text-sm font-semibold uppercase tracking-widest text-blue-700">Rent Collection</p><h1 className="mt-1 text-2xl font-semibold">{membership?'Property dashboard':'Tenant portal'}</h1><p className="mt-1 text-sm text-slate-500">{membership?`Organization · ${orgName?.name}`:`Welcome, ${tenant?.fullName}`}</p></div><LogoutButton/></header>
 <section className="mt-7 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{membership?'Overdue invoices':'Amount due now'}</p><p className="mt-2 text-3xl font-semibold">{membership?overdue:money(dueNow)}</p></div><div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{membership?'Collections · last six months':'Your leases'}</p><p className="mt-2 text-3xl font-semibold">{membership?money(months.reduce((s,m)=>s+(totals.get(m)??0n),0n)):leases.length}</p></div></section>
 {membership&&<section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Collections by month</h2><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-6">{months.map(m=><div key={m} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{m}</p><p className="mt-1 font-medium">{money(totals.get(m)??0n)}</p></div>)}</div></section>}
 <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-5"><h2 className="font-semibold">Leases</h2></div>{leases.length===0?<p className="p-6 text-sm text-slate-500">No leases found.</p>:<div className="divide-y divide-slate-100">{leases.map(l=><Link key={l.id} href={`/leases/${l.id}`} className="flex flex-wrap items-center justify-between gap-2 p-5 hover:bg-slate-50"><div><p className="font-medium">{l.unit.name} <span className="text-slate-500">· {l.tenant.fullName}</span></p><p className="mt-1 text-sm text-slate-500">{l.startDate.toISOString().slice(0,10)} – {l.endDate.toISOString().slice(0,10)} · {money(l.monthlyRentSen)}/month</p></div><span className="text-sm text-blue-700">View lease →</span></Link>)}</div>}</section>
 {membership?.role==='manager'&&<CreateLeaseForm units={units} tenants={tenantChoices.map(t=>({id:t.id,name:t.fullName}))}/>}</main>
}
