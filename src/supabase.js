import { createClient } from '@supabase/supabase-js'

// These would normally come from environment variables
const supabaseUrl = 'https://your-project-url.supabase.co'
const supabaseKey = 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseKey)
