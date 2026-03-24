import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const getUserCurrency = async (userId: string): Promise<{ code: string; symbol: string }> => {
  const { data } = await supabase
    .from('users')
    .select('currency, currency_symbol')
    .eq('id', userId)
    .single()
  return {
    code:   data?.currency        || 'TRY',
    symbol: data?.currency_symbol || '₺',
  }
}
