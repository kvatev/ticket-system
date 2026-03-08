import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (callerRole?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, user_id, role, custom_role_id, email, password, full_name, department_id } = await req.json();

    // DELETE USER
    if (action === "delete_user") {
      if (!user_id) {
        return new Response(JSON.stringify({ error: "Missing user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Get profile id for this user
      const { data: profileData } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("user_id", user_id)
        .single();
      const profileId = profileData?.id;

      // Unassign tickets assigned to this user's profile
      if (profileId) {
        await supabaseAdmin.from("tickets").update({ assigned_to: null }).eq("assigned_to", profileId);
        await supabaseAdmin.from("departments").update({ default_assignee_id: null }).eq("default_assignee_id", profileId);
      }

      // Delete tickets created by this user (and their related data)
      const { data: userTickets } = await supabaseAdmin.from("tickets").select("id").eq("created_by", user_id);
      if (userTickets && userTickets.length > 0) {
        const ticketIds = userTickets.map((t: any) => t.id);
        await supabaseAdmin.from("ticket_messages").delete().in("ticket_id", ticketIds);
        await supabaseAdmin.from("ticket_events").delete().in("ticket_id", ticketIds);
        await supabaseAdmin.from("ticket_attachments").delete().in("ticket_id", ticketIds);
        await supabaseAdmin.from("tickets").delete().in("id", ticketIds);
      }

      // Delete remaining related data (messages/events on other tickets)
      await supabaseAdmin.from("ticket_messages").delete().eq("user_id", user_id);
      await supabaseAdmin.from("ticket_events").delete().eq("user_id", user_id);
      await supabaseAdmin.from("ticket_attachments").delete().eq("user_id", user_id);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);
      
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RESET PASSWORD
    if (action === "reset_password") {
      if (!user_id || !password) {
        return new Response(JSON.stringify({ error: "Missing user_id or password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "Паролата трябва да е поне 6 символа." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      if (resetError) {
        return new Response(JSON.stringify({ error: resetError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE ROLE
    if (action === "update_role") {
      if (!user_id || !role) {
        return new Response(JSON.stringify({ error: "Missing user_id or role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const updateData: any = { role };
      if (custom_role_id) updateData.custom_role_id = custom_role_id;
      const { error } = await supabaseAdmin
        .from("user_roles")
        .update(updateData)
        .eq("user_id", user_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE USER
    if (!email?.endsWith("@edu.mon.bg")) {
      return new Response(JSON.stringify({ error: "Имейлът трябва да е @edu.mon.bg" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("profiles").insert({
      user_id: newUser.user!.id,
      full_name,
      email,
      department_id: department_id || null,
    });

    const roleInsert: any = {
      user_id: newUser.user!.id,
      role: role || "user",
    };
    if (custom_role_id) roleInsert.custom_role_id = custom_role_id;
    await supabaseAdmin.from("user_roles").insert(roleInsert);

    return new Response(JSON.stringify({ success: true, user_id: newUser.user!.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
