'use client'
import {useState,FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {toast} from 'sonner'
import {parseRinggitToSen} from '@/lib/billing'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'

type Choice={id:string;name:string}
export function CreateLeaseForm({units,tenants}:{units:Choice[];tenants:Choice[]}){
 const [busy,setBusy]=useState(false);const router=useRouter()
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);try{const form=new FormData(event.currentTarget);const body={unitId:String(form.get('unitId')),tenantId:String(form.get('tenantId')),startDate:String(form.get('startDate')),endDate:String(form.get('endDate')),monthlyRentSen:parseRinggitToSen(String(form.get('rent'))),depositSen:form.get('deposit')?parseRinggitToSen(String(form.get('deposit'))):0};const response=await fetch('/api/leases',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error??'Could not create lease');toast.success('Lease created');router.push(`/leases/${result.id}`);router.refresh()}catch(error){toast.error(error instanceof Error?error.message:'Could not create lease')}finally{setBusy(false)}}
 return <details className="mt-6 rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer p-5 font-semibold">Create lease</summary><form onSubmit={submit} className="grid gap-3 border-t p-5 sm:grid-cols-2"><label className="space-y-1 text-sm">Unit<select required name="unitId" className="w-full rounded-lg border px-3 py-2"><option value="">Choose a unit</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label className="space-y-1 text-sm">Tenant<select required name="tenantId" className="w-full rounded-lg border px-3 py-2"><option value="">Choose a tenant</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="space-y-1 text-sm">Lease starts<Input required type="date" name="startDate"/></label><label className="space-y-1 text-sm">Lease ends<Input required type="date" name="endDate"/></label><label className="space-y-1 text-sm">Monthly rent (RM)<Input required name="rent" placeholder="1,500.00" inputMode="decimal"/></label><label className="space-y-1 text-sm">Deposit (RM, optional)<Input name="deposit" placeholder="3,000.00" inputMode="decimal"/></label><Button disabled={busy} className="sm:col-span-2">{busy?'Creating…':'Create lease and schedule'}</Button></form></details>
}
