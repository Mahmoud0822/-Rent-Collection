import type {ButtonHTMLAttributes} from 'react'
import {cn} from '@/lib/utils'

type Variant='default'|'outline'|'destructive'|'secondary'|'ghost'
const variants:Record<Variant,string>={default:'bg-blue-700 text-white hover:bg-blue-800',outline:'border border-slate-300 bg-white hover:bg-slate-50',destructive:'bg-red-700 text-white hover:bg-red-800',secondary:'bg-slate-100 text-slate-900 hover:bg-slate-200',ghost:'bg-transparent text-slate-700 hover:bg-slate-100'}
export function Button({className,variant='default',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:Variant}){
 return <button className={cn('inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:pointer-events-none disabled:opacity-50',variants[variant],className)} {...props}/>
}
