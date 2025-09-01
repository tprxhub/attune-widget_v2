import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
)

// Insert a check-in
async function saveCheckin({ email, mood, sleep, energy }) {
  const { data, error } = await supabase
    .from('checkins')
    .insert([{ child_email: email, mood, sleep_hours: sleep, energy }])
  if (error) console.error(error)
  return data
}

// Fetch all check-ins for logged-in parent
async function getCheckins() {
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .order('checkin_date', { ascending: true })
  if (error) console.error(error)
  return data
}
