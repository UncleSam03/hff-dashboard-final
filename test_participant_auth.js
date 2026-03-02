import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testNameLookup() {
    console.log("Testing Name Lookup...");
    // This requires a profile with this name to exist in the DB
    const testName = "Test Participant"; 
    
    try {
        const { data: profileMatch, error: lookupErr } = await supabase
            .from("profiles")
            .select("id, full_name")
            .ilike("full_name", testName)
            .single();

        if (lookupErr) {
            console.error("Lookup failed (Profile might not exist):", lookupErr.message);
        } else {
            console.log("Successfully found profile:", profileMatch);
            
            // Test RPC
            const { data: userData, error: userErr } = await supabase.rpc('get_user_email_by_id', { user_id: profileMatch.id });
            if (userErr) {
                console.error("RPC failed (Check if migration was applied):", userErr.message);
            } else {
                console.log("Successfully retrieved email via RPC:", userData);
            }
        }
    } catch (err) {
        console.error("Unexpected error:", err);
    }
}

testNameLookup();
