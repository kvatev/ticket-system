import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "last-seen-ticket-time";

export function useUnreadTickets() {
  const { user, role, profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSeenRef = useRef<string>(
    localStorage.getItem(STORAGE_KEY) || new Date().toISOString()
  );

  // Create audio element once
  useEffect(() => {
    const audio = new Audio("/notification.mp3");
    audio.volume = 0.5;
    audioRef.current = audio;
  }, []);

  const playSound = useCallback(() => {
    audioRef.current?.play().catch(() => {
      // Autoplay blocked – ignore silently
    });
  }, []);

  const fetchUnread = useCallback(async () => {
    if (!user || !profile) return;

    let query = supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .gt("created_at", lastSeenRef.current)
      .neq("created_by", user.id);

    // Staff/maintenance/support see their dept or assigned tickets
    // Admin sees all; regular users see nothing extra
    // RLS will filter anyway, so just count what's visible

    const { count } = await query;
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
            if (
              old.assigned_to !== updated.assigned_to ||
              old.status !== updated.status
            ) {
              playSound();
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
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, playSound]);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    lastSeenRef.current = now;
    localStorage.setItem(STORAGE_KEY, now);
    setUnreadCount(0);
  }, []);

  return { unreadCount, markAllRead, playSound };
}
