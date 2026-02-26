import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Initialize admin client with Service Role Key
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request) {
  try {
    const { firstName, lastName, phone, uuid } = await request.json();

    if (!firstName || !lastName || !phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const fullName = `${firstName} ${lastName}`;
    const sanitizedName = fullName.toLowerCase().replace(/[^a-z0-9]/g, ".");
    const email = `${sanitizedName}.${uuid.slice(0, 4)}@hff.local`;

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: phone,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone,
        role: "participant",
      },
    });

    if (authError) {
      // If user already exists, we might just want to update or ignore
      if (authError.message.includes("already registered")) {
        return NextResponse.json({ message: "User already exists", email });
      }
      throw authError;
    }

    const authUser = authData.user;

    // 2. Create/Update Profile with must_change_password = true
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authUser.id,
        full_name: fullName,
        phone: phone,
        role: "participant",
        must_change_password: true,
      });

    if (profileError) throw profileError;

    // 3. Link registration/participant record to the new Auth User ID if possible
    // (Optional: depending on schema, we might need to update the registrations table)

    return NextResponse.json({ 
      success: true, 
      userId: authUser.id,
      email 
    });

  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
