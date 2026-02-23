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
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
  schema: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Нова",
  in_progress: "В изпълнение",
  waiting_for_user: "Очаква потребител",
  resolved: "Решена",
  closed: "Затворена",
};

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
    const { type, record, old_record } = payload;

    let title = "";
    let body = "";
    const userIdsToNotify: string[] = [];
    const ticketId = record.id as string;
    const ticketTitle = record.title as string;

    if (type === "INSERT") {
      title = "Нова заявка";
      body = `"${ticketTitle}" беше създадена`;

      const departmentId = record.department_id as string;
      const { data: deptStaff } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("department_id", departmentId);
      if (deptStaff) userIdsToNotify.push(...deptStaff.map((s: { user_id: string }) => s.user_id));

      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (admins) userIdsToNotify.push(...admins.map((a: { user_id: string }) => a.user_id));

      if (record.assigned_to) {
        const { data: assignee } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", record.assigned_to as string)
          .single();
        if (assignee) userIdsToNotify.push(assignee.user_id);
      }

      const creatorId = record.created_by as string;
      const filtered = [...new Set(userIdsToNotify)].filter((id) => id !== creatorId);
      userIdsToNotify.length = 0;
      userIdsToNotify.push(...filtered);
    } else if (type === "UPDATE") {
      const oldStatus = old_record?.status as string;
      const newStatus = record.status as string;

      if (oldStatus !== newStatus) {
        title = "Промяна на статус";
        body = `"${ticketTitle}" → ${STATUS_LABELS[newStatus] || newStatus}`;
        userIdsToNotify.push(record.created_by as string);

        if (record.assigned_to) {
          const { data: assignee } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("id", record.assigned_to as string)
            .single();
          if (assignee) userIdsToNotify.push(assignee.user_id);
        }
      }

      const oldAssigned = old_record?.assigned_to as string | null;
      const newAssigned = record.assigned_to as string | null;
      if (oldAssigned !== newAssigned && newAssigned) {
        if (!title) {
          title = "Назначена заявка";
          body = `"${ticketTitle}" ви беше назначена`;
        }
        const { data: assignee } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", newAssigned)
          .single();
        if (assignee) userIdsToNotify.push(assignee.user_id);
      }
    }

    if (!title || userIdsToNotify.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No notifications needed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uniqueIds = [...new Set(userIdsToNotify)];

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

    const notificationPayload = JSON.stringify({
      title,
      body,
      url: `/tickets/${ticketId}`,
      tag: `ticket-${ticketId}`,
    });

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
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const { headers, body: reqBody } = await buildPushPayload(
          {
            data: notificationPayload,
            options: { ttl: 86400 },
          },
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
          const responseText = await response.text();
          console.error("Push failed:", status, responseText);
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
