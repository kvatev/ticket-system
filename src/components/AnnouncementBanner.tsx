import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Info, AlertTriangle, CheckSquare, AlertCircle } from "lucide-react";

const typeConfig: Record<string, { icon: React.ElementType; bg: string; border: string; text: string }> = {
  info: { icon: Info, bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800", text: "text-blue-800 dark:text-blue-200" },
  warning: { icon: AlertTriangle, bg: "bg-yellow-50 dark:bg-yellow-950/40", border: "border-yellow-200 dark:border-yellow-800", text: "text-yellow-800 dark:text-yellow-200" },
  task: { icon: CheckSquare, bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-200 dark:border-green-800", text: "text-green-800 dark:text-green-200" },
  urgent: { icon: AlertCircle, bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-200 dark:border-red-800", text: "text-red-800 dark:text-red-200" },
};

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
}

export default function AnnouncementBanner() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [announcementsRes, dismissedRes] = await Promise.all([
        supabase
          .from("announcements")
          .select("id, title, content, type, created_at")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("dismissed_announcements")
          .select("announcement_id")
          .eq("user_id", user.id),
      ]);
      const dismissed = new Set((dismissedRes.data || []).map((d: any) => d.announcement_id));
      setDismissedIds(dismissed);
      setAnnouncements((announcementsRes.data as Announcement[]) || []);
    };
    fetch();
  }, [user]);

  const handleDismiss = async (announcementId: string) => {
    if (!user) return;
    setDismissedIds((prev) => new Set([...prev, announcementId]));
    await supabase.from("dismissed_announcements").insert({
      user_id: user.id,
      announcement_id: announcementId,
    });
  };

  const visible = announcements.filter((a) => !dismissedIds.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((a) => {
        const config = typeConfig[a.type] || typeConfig.info;
        const Icon = config.icon;
        return (
          <div
            key={a.id}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${config.bg} ${config.border}`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.text}`} />
            <div className={`min-w-0 flex-1 ${config.text}`}>
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="text-sm opacity-90">{a.content}</p>
            </div>
            <button
              onClick={() => handleDismiss(a.id)}
              className={`shrink-0 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 ${config.text}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
