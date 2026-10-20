import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata:Metadata={title:'Rent Collection',description:'Property rent collection portal'}
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><Toaster richColors position="top-right"/>{children}</body></html>
}
