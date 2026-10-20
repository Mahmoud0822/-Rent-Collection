'use client'
import {useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/browser'
import {toast} from 'sonner'
import {Button} from '@/components/ui/button'

export function LogoutButton(){
 const router=useRouter()
 return <Button variant="ghost" className="text-sm text-slate-600 hover:text-slate-950" onClick={async()=>{const {error}=await createClient().auth.signOut();if(error)toast.error(error.message);else{toast.success('Signed out');router.push('/login');router.refresh()}}}>Sign out</Button>
}
