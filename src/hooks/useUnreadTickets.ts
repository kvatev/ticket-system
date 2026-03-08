import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import React from "react";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "last-seen-ticket-time";

export function useUnreadTickets() {
  const { user, role, profile } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userInteractedRef = useRef(false);
  const lastSeenRef = useRef<string>(
    localStorage.getItem(STORAGE_KEY) || new Date().toISOString()
  );

  // Create audio element once
  useEffect(() => {
    const audio = new Audio("/notification.mp3");
    audio.volume = 0.5;
    audioRef.current = audio;

    // Track user interaction to unlock audio playback
    const unlockAudio = () => {
      userInteractedRef.current = true;
      // Pre-load audio after first interaction
      if (audioRef.current) {
        audioRef.current.load();
      }
    };

    document.addEventListener("click", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });
    document.addEventListener("touchstart", unlockAudio, { once: true });

    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  const playSound = useCallback(() => {
    if (!profile?.sound_enabled) return;
    if (!audioRef.current) return;

    // Clone the audio to allow overlapping plays
    const sound = audioRef.current.cloneNode() as HTMLAudioElement;
    sound.volume = 0.5;
    sound.play().catch(() => {
      // Autoplay blocked – ignored
    });
  }, [profile?.sound_enabled]);

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
            toast({
              title: "📩 Нова заявка",
              description: newTicket.title || "Получихте нова заявка",
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
              toast({
                title: "🔄 Промяна на статус",
                description: `Заявка "${updated.title}" → ${updated.status}`,
              });
            } else if (old.assigned_to !== updated.assigned_to) {
              playSound();
              toast({
                title: "👤 Промяна на изпълнител",
                description: `Заявка "${updated.title}" е преназначена`,
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
            toast({
              title: "💬 Ново съобщение",
              description: msg.content?.substring(0, 80) || "Получихте ново съобщение по заявка",
            });
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
