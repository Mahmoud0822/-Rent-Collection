'use client'
import {useState,FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {toast} from 'sonner'
import {parseRinggitToSen} from '@/lib/billing'
import {createClient} from '@/lib/supabase/browser'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'

type Props={leaseId:string;orgId:string;role:'manager'|'staff'|'tenant';tenantId?:string;phone?:string|null;defaultReceivedAt?:string}
async function post(url:string,body?:unknown){const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();if(!res.ok)throw new Error(data.error??'Request failed');return data}
export function LeaseActions({leaseId,orgId,role,tenantId,phone,defaultReceivedAt}:Props){
 const [busy,setBusy]=useState(false);const [bill,setBill]=useState<{billId:string;amountSen:number}|null>(null);const router=useRouter()
 async function manual(event:FormEvent<HTMLFormElement>){event.preventDefault();const formElement=event.currentTarget;setBusy(true);const form=new FormData(formElement);let path:string|undefined
  try{const amountSen=parseRinggitToSen(String(form.get('amount')));const method=String(form.get('method'));let receivedAt=String(form.get('receivedAt'));if(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(receivedAt))receivedAt+=':00';receivedAt+='+08:00'
   if(method==='bank_transfer'){const file=form.get('slip');if(!(file instanceof File)||file.size===0)throw new Error('Choose a transfer slip');if(file.size>5*1024*1024||!['image/jpeg','image/png','application/pdf'].includes(file.type))throw new Error('Slip must be a JPEG, PNG or PDF up to 5 MB');path=`${orgId}/${crypto.randomUUID()}-${file.name}`;const {error}=await createClient().storage.from('payment-slips').upload(path,file,{contentType:file.type,upsert:false});if(error)throw new Error(error.message)}
   await post(`/api/leases/${leaseId}/payments`,{amountSen,method,receivedAt,...(path?{slipPath:path}:{})});toast.success('Payment recorded');formElement.reset();router.refresh()
  }catch(error){if(path){try{await createClient().storage.from('payment-slips').remove([path])}catch{}}toast.error(error instanceof Error?error.message:'Could not record payment')}finally{setBusy(false)}}
 async function createBill(){setBusy(true);try{const data=await post(`/api/leases/${leaseId}/gateway-bills`);setBill(data);toast.success('Gateway bill created')}catch(error){toast.error(error instanceof Error?error.message:'Could not create bill')}finally{setBusy(false)}}
 async function updatePhone(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!tenantId)return;setBusy(true);try{const phoneValue=String(new FormData(event.currentTarget).get('phone'));const {error}=await createClient().from('tenants').update({phone:phoneValue}).eq('id',tenantId);if(error)throw error;toast.success('Phone number updated');router.refresh()}catch(error){toast.error(error instanceof Error?error.message:'Could not update phone number')}finally{setBusy(false)}}
 return <div className="space-y-4">
  {role!=='tenant'&&<form onSubmit={manual} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">Record a payment</h2><label className="space-y-1 text-sm">Amount (RM)<Input name="amount" required inputMode="decimal" placeholder="1,500.00"/></label><label className="space-y-1 text-sm">Method<select name="method" className="w-full rounded-lg border px-3 py-2"><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option></select></label><label className="space-y-1 text-sm">Received at (Malaysia time)<Input name="receivedAt" type="datetime-local" required defaultValue={defaultReceivedAt}/></label><label className="space-y-1 text-sm">Transfer slip<Input name="slip" type="file" accept="image/jpeg,image/png,application/pdf" className="h-auto"/></label><Button disabled={busy} className="sm:col-span-2">{busy?'Saving…':'Record payment'}</Button></form>}
  {role==='tenant'&&<div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"><Button disabled={busy} onClick={createBill}>Pay now</Button>{bill&&<p className="text-sm">Gateway bill <code>{bill.billId}</code> · RM {(bill.amountSen/100).toFixed(2)} · <a href={`/payments/return?bill_id=${encodeURIComponent(bill.billId)}`}>View payment status</a></p>}<form onSubmit={updatePhone} className="flex flex-wrap gap-2"><Input name="phone" defaultValue={phone??''} placeholder="Phone number" className="max-w-xs"/><Button variant="outline" disabled={busy}>Update phone</Button></form></div>}
 </div>
}

export function PaymentReview({paymentId,status,role}:{paymentId:string;status:string;role:'manager'|'staff'|'tenant'}){
 const [busy,setBusy]=useState(false);const router=useRouter();if(role!=='manager')return null
 async function run(action:'approve'|'reject'|'void'){if(action==='void'&&!window.confirm('Void this payment and reopen its invoices?'))return;const reason=action==='approve'?undefined:window.prompt(`Reason to ${action} (at least 5 characters)`);if(action!=='approve'&&!reason)return;setBusy(true);try{const res=await fetch(`/api/payments/${paymentId}/${action}`,{method:'POST',headers:{'content-type':'application/json'},...(reason?{body:JSON.stringify({reason})}:{})});const data=await res.json();if(!res.ok)throw new Error(data.error);toast.success(`Payment ${action}d`);router.refresh()}catch(error){toast.error(error instanceof Error?error.message:'Action failed')}finally{setBusy(false)}}
 return <span className="flex gap-2">{status==='pending_verification'&&<><button disabled={busy} onClick={()=>run('approve')} className="rounded bg-green-700 px-2 py-1 text-xs text-white">Approve</button><button disabled={busy} onClick={()=>run('reject')} className="rounded border px-2 py-1 text-xs">Reject</button></>}{status==='approved'&&<button disabled={busy} onClick={()=>run('void')} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Void</button>}</span>
}
