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
  const { data: rows, error: fetchErr } = await admin
    .from('registration_queue')
    .select('id, registration_id, payload')
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (fetchErr) {
    console.error('[Queue Processor] Failed to fetch queue rows:', fetchErr);
    return { processed: 0, errors: [String(fetchErr.message)] };
  }

  if (!rows || rows.length === 0) return { processed: 0 };

  let processed = 0;
  for (const row of rows) {
    try {
      const payload = row.payload || {};
      
      // Map payload to standard fields (handling both registrations table schema and potential enketo variants)
      const phone = payload.contact || payload.phone || payload.phone_number || null;
      const first = payload.first_name || payload.firstName || '';
      const last = payload.last_name || payload.lastName || '';
      const fullName = payload.full_name || [first, last].filter(Boolean).join(' ') || 'User';
      
      // Fallback email if none provided (required for our login logic)
      // We use the pattern: name.uuid@hff.local
      let email = payload.email || payload.email_address || null;
      if (!email) {
          const sanitizedName = fullName.toLowerCase().replace(/[^a-z0-9]/g, ".");
          email = `${sanitizedName}.${row.registration_id.slice(0, 4)}@hff.local`;
      }

      console.log(`[Queue Processor] Processing ${fullName} (${email})...`);

      // 1. Create user via Admin API
      const { data: authData, error: createErr } = await admin.auth.admin.createUser({
        email: email,
        password: phone || 'HFF_Temp_Pass_123!', // Fallback if no phone
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
            // We'll proceed to mark processed since they already have an account
        } else {
            console.error('[Queue Processor] Create user error:', createErr);
            errors.push(`registration_id=${row.registration_id} createUser: ${createErr.message}`);
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
            created_at: new Date().toISOString(),
          });

          if (upsertErr) {
            console.error('[Queue Processor] Failed to upsert profile:', upsertErr);
            errors.push(`registration_id=${row.registration_id} upsertProfile: ${upsertErr.message}`);
          }
      }

      // 3. Mark queue row processed
      const { error: markErr } = await admin
        .from('registration_queue')
        .update({ 
          processed: true, 
          processed_at: new Date().toISOString() 
        })
        .eq('id', row.id);

      if (markErr) {
        console.error('[Queue Processor] Failed to mark queue row processed:', markErr);
        errors.push(`registration_id=${row.registration_id} markProcessed: ${markErr.message}`);
      } else {
        processed++;
      }
    } catch (e) {
      console.error('[Queue Processor] Error processing row:', e);
      errors.push(`registration_id=${row.registration_id} exception: ${e.message}`);
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
