import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)

const fetchUser = supabase.auth.getUser.bind(supabase.auth)

supabase.auth.getUser = async (jwt) => {
  if (jwt) return fetchUser(jwt)

  const { data, error } = await supabase.auth.getSession()
  const user = data?.session?.user

  if (user) return { data: { user }, error: null }
  if (error) return { data: { user: null }, error }
  return fetchUser()
}
