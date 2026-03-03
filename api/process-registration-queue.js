import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[Queue Processor] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const admin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function processBatch(batchSize = 10) {
  const errors = [];
  // 1. Poll directly from 'registrations' for unprocessed participants
  const { data: rows, error: fetchErr } = await admin
    .from('registrations')
    .select('*')
    .eq('processed', false)
    .eq('type', 'participant')
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (fetchErr) {
    console.error('[Queue Processor] Failed to fetch registrations:', fetchErr);
    return { processed: 0, errors: [String(fetchErr.message)] };
  }

  if (!rows || rows.length === 0) return { processed: 0 };

  let processed = 0;
  for (const row of rows) {
    try {
      const phone = row.phone || row.contact || null;
      const firstName = row.first_name || '';
      const lastName = row.last_name || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'User';

      // Fallback email if none provided
      let email = row.email || null;
      if (!email && row.uuid) {
        const sanitizedName = fullName.toLowerCase().replace(/[^a-z0-9]/g, ".");
        email = `${sanitizedName}.${row.uuid.slice(0, 4)}@hff.local`;
      }

      if (!email) {
        console.error(`[Queue Processor] Missing UUID/Email for registration: ${row.id}`);
        errors.push(`registration_id=${row.uuid} error: Missing email/uuid`);
        continue;
      }

      console.log(`[Queue Processor] Processing ${fullName} (${email})...`);

      // 1. Create user via Admin API
      const { data: authData, error: createErr } = await admin.auth.admin.createUser({
        email: email,
        password: phone || 'HFF_Temp_Pass_123!',
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone: phone,
          role: "participant",
        },
      });

      if (createErr) {
        if (createErr.message.includes("already registered")) {
          console.log(`[Queue Processor] User already exists: ${email}`);
        } else {
          console.error('[Queue Processor] Create user error:', createErr);
          errors.push(`registration_uuid=${row.uuid} createUser: ${createErr.message}`);
          continue;
        }
      }

      const userId = authData?.user?.id;

      if (userId) {
        // 2. Upsert profile
        const { error: upsertErr } = await admin.from('profiles').upsert({
          id: userId,
          full_name: fullName,
          phone: phone,
          role: "participant",
          must_change_password: true,
          created_at: row.created_at || new Date().toISOString(),
        });

        if (upsertErr) {
          console.error('[Queue Processor] Failed to upsert profile:', upsertErr);
          errors.push(`registration_uuid=${row.uuid} upsertProfile: ${upsertErr.message}`);
        }
      }

      // 3. Mark registration record as processed
      const { error: markErr } = await admin
        .from('registrations')
        .update({
          processed: true,
          updated_at: new Date().toISOString()
        })
        .eq('uuid', row.uuid);

      if (markErr) {
        console.error('[Queue Processor] Failed to mark registration processed:', markErr);
        errors.push(`registration_uuid=${row.uuid} markProcessed: ${markErr.message}`);
      } else {
        processed++;
      }
    } catch (e) {
      console.error('[Queue Processor] Error processing row:', e);
      errors.push(`registration_uuid=${row.uuid} exception: ${e.message}`);
    }
  }

  return { processed, errors: errors.length ? errors : undefined };
}

export default async function handler(req, res) {
  // Allow GET for easy testing/manual trigger, though POST is better for automation
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const batchParam = req.query.batch;
    const batch = batchParam ? Math.max(1, Math.min(500, parseInt(batchParam, 10) || 10)) : 10;

    const result = await processBatch(batch);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[Queue Processor] API Error:', err);
    return res.status(500).json({ error: String(err.message) });
  }
}
