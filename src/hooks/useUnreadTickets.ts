import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { pushNotification } from "@/hooks/useNotificationStore";
import { useSoundPreferences } from "@/hooks/useSoundPreferences";

const STORAGE_KEY = "last-seen-ticket-time";

export function useUnreadTickets() {
  const { user, role, profile } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const userInteractedRef = useRef(false);
  const { playPreview, isDndActive } = useSoundPreferences();
  const lastSeenRef = useRef<string>(
    localStorage.getItem(STORAGE_KEY) || new Date().toISOString()
  );

  // Unlock audio context on first user interaction (browsers require it)
  useEffect(() => {
    const unlockAudio = () => {
      userInteractedRef.current = true;
    };
    document.addEventListener("click", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });
    document.addEventListener("touchstart", unlockAudio, { once: true });

    // Listen for messages from the service worker (e.g. push received → play sound)
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "PLAY_NOTIFICATION_SOUND") {
        if (profile?.sound_enabled !== false && !isDndActive()) {
          playPreview();
        }
      } else if (event.data?.type === "NAVIGATE" && event.data?.url) {
        navigate(event.data.url);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleSWMessage);

    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
      navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
    };
  }, [navigate, profile?.sound_enabled, playPreview, isDndActive]);

  const playSound = useCallback(() => {
    if (!profile?.sound_enabled) return;
    if (isDndActive()) return; // Quiet hours
    playPreview();
  }, [profile?.sound_enabled, playPreview, isDndActive]);

  const fetchUnread = useCallback(async () => {
    if (!user || !profile) return;

    const { count } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .gt("created_at", lastSeenRef.current)
      .neq("created_by", user.id);

    setUnreadCount(count ?? 0);
  }, [user, profile]);

  // Initial fetch
  useEffect(() => {
    if (user && profile) {
      fetchUnread();
    }
  }, [user, profile, fetchUnread]);

  // Realtime listener for new tickets and messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("unread-tickets")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        (payload) => {
          const newTicket = payload.new as any;
          if (newTicket.created_by !== user.id) {
            setUnreadCount((prev) => prev + 1);
            playSound();
            const title = "📩 Нова заявка";
            const description = newTicket.title || "Получихте нова заявка";
            pushNotification({ title, description, ticketId: newTicket.id });
            toast({
              title,
              description,
              action: React.createElement(ToastAction, {
                altText: "Виж заявката",
                onClick: () => navigate(`/tickets/${newTicket.id}`),
              } as any, "Виж") as any,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets" },
        (payload) => {
          const updated = payload.new as any;
          const old = payload.old as any;
          if (updated.created_by !== user.id) {
            if (old.status !== updated.status) {
              playSound();
              const title = "🔄 Промяна на статус";
              const description = `Заявка "${updated.title}" → ${updated.status}`;
              pushNotification({ title, description, ticketId: updated.id });
              toast({
                title,
                description,
                action: React.createElement(ToastAction, {
                  altText: "Виж заявката",
                  onClick: () => navigate(`/tickets/${updated.id}`),
                } as any, "Виж") as any,
              });
            } else if (old.assigned_to !== updated.assigned_to) {
              playSound();
              const title = "👤 Промяна на изпълнител";
              const description = `Заявка "${updated.title}" е преназначена`;
              pushNotification({ title, description, ticketId: updated.id });
              toast({
                title,
                description,
                action: React.createElement(ToastAction, {
                  altText: "Виж заявката",
                  onClick: () => navigate(`/tickets/${updated.id}`),
                } as any, "Виж") as any,
              });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_messages" },
        (payload) => {
          const msg = payload.new as any;
          if (msg.user_id !== user.id) {
            setUnreadCount((prev) => prev + 1);
            playSound();
            const title = "💬 Ново съобщение";
            const description = msg.content?.substring(0, 80) || "Получихте ново съобщение по заявка";
            pushNotification({ title, description, ticketId: msg.ticket_id });
            toast({
              title,
              description,
              action: React.createElement(ToastAction, {
                altText: "Виж заявката",
                onClick: () => navigate(`/tickets/${msg.ticket_id}`),
              } as any, "Виж") as any,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, playSound, navigate]);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    lastSeenRef.current = now;
    localStorage.setItem(STORAGE_KEY, now);
    setUnreadCount(0);
  }, []);

  return { unreadCount, markAllRead, playSound };
}
