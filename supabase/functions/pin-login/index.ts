
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, pin } = await req.json();

    if (!email || !pin) {
      return new Response(JSON.stringify({ error: "Имейл и ПИН код са задължителни." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the user by email
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Невалиден имейл или ПИН код." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for valid PIN
    const { data: pinRecord, error: pinError } = await supabaseAdmin
      .from("password_pins")
      .select("*")
      .eq("user_id", profile.user_id)
      .eq("pin", pin)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (pinError || !pinRecord) {
      return new Response(JSON.stringify({ error: "Невалиден или изтекъл ПИН код." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark PIN as used
    await supabaseAdmin
      .from("password_pins")
      .update({ used: true })
      .eq("id", pinRecord.id);

    // Generate a temporary password and set it
    const tempPassword = crypto.randomUUID();
    await supabaseAdmin.auth.admin.updateUser(profile.user_id, {
      password: tempPassword,
    });

    // Sign in with the temp password to get a session
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password: tempPassword,
    });

    if (signInError) {
      return new Response(JSON.stringify({ error: "Грешка при вход." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      session: signInData.session,
      must_change_password: true,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
