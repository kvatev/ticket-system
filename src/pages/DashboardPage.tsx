import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, Clock, CheckCircle2, AlertTriangle, Inbox, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Stats {
  total: number;
  new: number;
  inProgress: number;
  resolved: number;
}

export default function DashboardPage() {
  const { role, profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, new: 0, inProgress: 0, resolved: 0 });
  const [recentTickets, setRecentTickets] = useState<any[]>([]);

  const fetchData = async () => {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, title, status, priority, created_at, departments(name)")
      .order("created_at", { ascending: false })
      .limit(5);

    if (tickets) {
      setRecentTickets(tickets);
    }

    // Get full counts
    const [totalRes, newRes, ipRes, resRes] = await Promise.all([
      supabase.from("tickets").select("*", { count: "exact", head: true }),
      supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
      supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "resolved"),
    ]);

    setStats({
      total: totalRes.count ?? 0,
      new: newRes.count ?? 0,
      inProgress: ipRes.count ?? 0,
      resolved: resRes.count ?? 0,
    });
  };

  useEffect(() => {
    fetchData();
  }, [role]);

  // Real-time updates for dashboard
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role]);

  const statCards = [
    { label: "Общо заявки", value: stats.total, icon: Ticket, color: "text-primary" },
    { label: "Нови", value: stats.new, icon: Inbox, color: "text-info" },
    { label: "В процес", value: stats.inProgress, icon: Clock, color: "text-accent" },
    { label: "Решени", value: stats.resolved, icon: CheckCircle2, color: "text-success" },
  ];

  const statusLabels: Record<string, string> = {
    new: "Нова",
    in_progress: "В процес",
    waiting_for_user: "Чака отговор",
    resolved: "Решена",
    closed: "Затворена",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Табло</h1>
          <p className="text-sm text-muted-foreground">
            Добре дошли, {profile?.full_name ?? "..."}
          </p>
        </div>
        <Link to="/tickets/new">
          <Button>Нова заявка</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-3 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Последни заявки</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTickets.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Няма заявки все още.</p>
          ) : (
            <div className="space-y-3">
              {recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/tickets/${ticket.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {(ticket.departments as any)?.name} • {new Date(ticket.created_at).toLocaleDateString("bg-BG")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium status-badge-${ticket.status === "in_progress" ? "in-progress" : ticket.status}`}>
                      {statusLabels[ticket.status]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
