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

interface WebhookPayload {
  type: string;
  table: string;
  record: Record<string, unknown>;
  schema: string;
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

    const payload: WebhookPayload = await req.json();
    const message = payload.record;

    const ticketId = message.ticket_id as string;
    const senderId = message.user_id as string;
    const isInternal = message.is_internal as boolean;
    const content = (message.content as string).substring(0, 100);

    // Get ticket info
    const { data: ticket } = await supabase
      .from("tickets")
      .select("title, created_by, assigned_to, department_id")
      .eq("id", ticketId)
      .single();

    if (!ticket) {
      return new Response(
        JSON.stringify({ sent: 0, message: "Ticket not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine who to notify
    const userIdsToNotify: string[] = [];

    // Always notify ticket creator (if not the sender)
    if (ticket.created_by !== senderId && !isInternal) {
      userIdsToNotify.push(ticket.created_by);
    }

    // Notify assigned staff (if not the sender)
    if (ticket.assigned_to) {
      const { data: assignee } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("id", ticket.assigned_to)
        .single();
      if (assignee && assignee.user_id !== senderId) {
        userIdsToNotify.push(assignee.user_id);
      }
    }

    // For internal messages, notify department staff
    if (isInternal) {
      const { data: deptStaff } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("department_id", ticket.department_id);
      if (deptStaff) {
        for (const s of deptStaff) {
          if (s.user_id !== senderId) {
            userIdsToNotify.push(s.user_id);
          }
        }
      }
    }

    const uniqueIds = [...new Set(userIdsToNotify)];

    if (uniqueIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No one to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get sender name
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", senderId)
      .single();

    const senderName = senderProfile?.full_name || "Потребител";

    const title = isInternal
      ? `Вътрешна бележка: ${ticket.title}`
      : `Нов коментар: ${ticket.title}`;
    const body = `${senderName}: ${content}${content.length >= 100 ? "..." : ""}`;

    const notificationPayload = JSON.stringify({
      title,
      body,
      url: `/tickets/${ticketId}`,
      tag: `message-${ticketId}`,
    });

    // Get push subscriptions
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", uniqueIds);

    if (!subscriptions?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vapidKeys: VapidKeys = {
      subject: "mailto:admin@petkanov-ticket.app",
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
    };

    let sent = 0;
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

        const response = await fetch(pushSub.endpoint, {
          method: "POST",
          headers,
          body: reqBody,
        });

        if (response.ok) {
          sent++;
        } else {
          const status = response.status;
          if (status === 410 || status === 404) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      } catch (err) {
        console.error("Push error for sub:", sub.id, err);
      }
    }

    return new Response(
      JSON.stringify({ sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
