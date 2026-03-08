import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPushPayload,
  type PushSubscription,
  type VapidKeys,
} from "npm:@block65/webcrypto-web-push@1.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PushPayload {
  user_ids: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const payload: PushPayload = await req.json();
    const { user_ids, title, body, url, tag } = payload;

    if (!user_ids?.length || !title || !body) {
      return new Response(
        JSON.stringify({ error: "user_ids, title, and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", user_ids);

    if (subError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notificationPayload = JSON.stringify({
      title,
      body,
      url: url || "/",
      tag: tag || "default",
    });

    const vapidKeys: VapidKeys = {
      subject: "mailto:admin@petkanov-ticket.app",
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
    };

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        const pushSub: PushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        const { headers, body: reqBody } = await buildPushPayload(
          { data: notificationPayload, options: { ttl: 86400 } },
          pushSub,
          vapidKeys
        );

        const response = await fetch(pushSub.endpoint, { method: "POST", headers, body: reqBody });

        if (response.ok) {
          sent++;
        } else {
          failed++;
          const status = response.status;
          console.error("Push failed:", status, await response.text());
          if (status === 410 || status === 404) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      } catch (err) {
        console.error("Push failed for subscription:", sub.id, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
