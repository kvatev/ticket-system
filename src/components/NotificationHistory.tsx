import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificationStore } from "@/hooks/useNotificationStore";
import { cn } from "@/lib/utils";
import { useState } from "react";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "сега";
  if (mins < 60) return `преди ${mins} мин`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `преди ${hrs} ч`;
  const days = Math.floor(hrs / 24);
  return `преди ${days} д`;
}

export default function NotificationHistory() {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotificationStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Известия</h3>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={markAllRead} title="Маркирай всички като прочетени">
                <CheckCheck className="h-3.5 w-3.5" />
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={clearAll} title="Изчисти всички">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Няма известия
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                    !n.read && "bg-accent/20"
                  )}
                  onClick={() => {
                    markRead(n.id);
                    if (n.ticketId) {
                      navigate(`/tickets/${n.ticketId}`);
                      setOpen(false);
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", !n.read ? "font-semibold text-foreground" : "text-foreground/80")}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {n.description}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/60">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
