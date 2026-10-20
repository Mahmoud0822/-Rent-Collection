import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const requestHeaders = await headers()
  const bearer = requestHeaders.get('authorization')?.replace(/^Bearer\s+/i, '')
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : undefined,
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values) => {
          try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    },
  )
}
