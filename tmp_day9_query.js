import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.hffdashboardfinal_SUPABASE_URL
const supabaseKey = process.env.hffdashboardfinal_SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // Step 1: Get all active facilitators who did NOT attend day 9
  const { data: facilitators, error: fErr } = await supabase
    .from('registrations')
    .select('id, uuid, first_name, last_name, contact, attendance, participants_count')
    .eq('type', 'facilitator')
    .eq('is_deleted', false)

  if (fErr) { console.error("Error:", fErr.message); return; }

  const didNotAttendDay9 = facilitators.filter(r =>
    !Array.isArray(r.attendance) || r.attendance[8] !== true
  )

  const facilitatorUuids = didNotAttendDay9
    .filter(r => r.uuid !== null)
    .map(r => r.uuid)

  // Step 2: Fetch LIVE participant rows (is_deleted=false) linked to those facilitators
  const { data: linkedParticipants, error: pErr } = await supabase
    .from('registrations')
    .select('facilitator_uuid, first_name, last_name')
    .eq('type', 'participant')
    .eq('is_deleted', false)
    .in('facilitator_uuid', facilitatorUuids)

  if (pErr) { console.error("Participant error:", pErr.message); return; }

  // Step 3: Count live participants per facilitator_uuid
  const countMap = {}
  for (const p of linkedParticipants) {
    countMap[p.facilitator_uuid] = (countMap[p.facilitator_uuid] || 0) + 1
  }

  // Step 4: Build final list — only facilitators with at least 1 live participant
  const result = didNotAttendDay9
    .filter(r => countMap[r.uuid] && countMap[r.uuid] > 0)
    .map(r => ({
      name: `${r.first_name} ${r.last_name}`.trim(),
      contact: r.contact || 'N/A',
      live_participants: countMap[r.uuid]
    }))
    .sort((a, b) => b.live_participants - a.live_participants)

  console.log(`\nFacilitators who missed Day 9 WITH live participants: ${result.length}\n`)
  console.log('No. | Name                              | Contact        | Live Participants')
  console.log('----+-----------------------------------+----------------+------------------')
  result.forEach((r, i) => {
    const num = String(i + 1).padEnd(4)
    const name = r.name.padEnd(35)
    const contact = r.contact.padEnd(16)
    console.log(`${num}| ${name}| ${contact}| ${r.live_participants}`)
  })
}

run()
