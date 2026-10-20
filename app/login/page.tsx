'use client'
import {useState,FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {toast} from 'sonner'
import {createClient} from '@/lib/supabase/browser'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'

export default function LoginPage(){
 const [busy,setBusy]=useState(false);const router=useRouter()
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);const form=new FormData(event.currentTarget);const {error}=await createClient().auth.signInWithPassword({email:String(form.get('email')),password:String(form.get('password'))});setBusy(false);if(error){toast.error(error.message);return}toast.success('Signed in');router.push('/');router.refresh()}
 return <main className="grid min-h-screen place-items-center p-5"><form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><div><p className="text-sm font-semibold uppercase tracking-widest text-blue-700">EzyFusion Rent</p><h1 className="mt-2 text-2xl font-semibold">Sign in</h1><p className="mt-1 text-sm text-slate-500">Use your seeded assessment account.</p></div><label className="block space-y-1 text-sm font-medium">Email<Input required type="email" name="email" autoComplete="username"/></label><label className="block space-y-1 text-sm font-medium">Password<Input required type="password" name="password" autoComplete="current-password"/></label><Button disabled={busy} className="w-full">{busy?'Signing in…':'Sign in'}</Button></form></main>
}
