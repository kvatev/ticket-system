import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PlusCircle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  new: "Нова",
  in_progress: "В процес",
  waiting_for_user: "Чака отговор",
  resolved: "Решена",
  closed: "Затворена",
};

const priorityLabels: Record<string, string> = {
  low: "Ниска",
  normal: "Нормална",
  high: "Висока",
  urgent: "Спешна",
};

interface TicketListProps {
  mode?: "all" | "assigned" | "department";
}

export default function TicketListPage({ mode = "all" }: TicketListProps) {
  const { user, role, profile } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartments();
    fetchTickets();
  }, [mode, filterStatus, filterDept, filterPriority, user]);

  // Realtime subscription for auto-refresh
  useEffect(() => {
    const channel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode, filterStatus, filterDept, filterPriority, user]);

  const fetchDepartments = async () => {
    const { data } = await supabase.from("departments").select("*").order("name");
    if (data) setDepartments(data);
  };

  const fetchTickets = async () => {
    setLoading(true);
    let query = supabase
      .from("tickets")
      .select("*, departments(name), profiles!tickets_assigned_to_fkey(full_name)")
      .order("created_at", { ascending: false });

    if (mode === "assigned" && profile) {
      query = query.eq("assigned_to", profile.id);
    } else if (mode === "department" && profile?.department_id) {
      query = query.eq("department_id", profile.department_id);
    }

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus as any);
    }
    if (filterDept !== "all") {
      query = query.eq("department_id", filterDept);
    }
    if (filterPriority !== "all") {
      query = query.eq("priority", filterPriority as any);
    }

    const { data } = await query;
    setTickets(data ?? []);
    setLoading(false);
  };

  const filtered = tickets.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.class_name?.toLowerCase().includes(q) ||
      t.room?.toLowerCase().includes(q)
    );
  });

  const titles: Record<string, string> = {
    all: (role === "user" || role === "maintenance" || role === "support") ? "Моите заявки" : "Всички заявки",
    assigned: "Възложени на мен",
    department: "Опашка на отдела",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">{titles[mode]}</h1>
        <Link to="/tickets/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Нова заявка
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Търсене..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички статуси</SelectItem>
            <SelectItem value="new">Нова</SelectItem>
            <SelectItem value="in_progress">В процес</SelectItem>
            <SelectItem value="waiting_for_user">Чака отговор</SelectItem>
            <SelectItem value="resolved">Решена</SelectItem>
            <SelectItem value="closed">Затворена</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Отдел" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички отдели</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ticket list */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-12 text-center text-muted-foreground">Зареждане...</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">Няма намерени заявки.</p>
              <Link to="/tickets/new">
                <Button variant="outline" className="mt-4">Създай първата заявка</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/tickets/${ticket.id}`}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{ticket.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(ticket.departments as any)?.name}
                      {ticket.class_name && ` • Клас ${ticket.class_name}`}
                      {ticket.room && ` • Стая ${ticket.room}`}
                      {" • "}
                      {new Date(ticket.created_at).toLocaleDateString("bg-BG")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium priority-${ticket.priority}`}>
                      {priorityLabels[ticket.priority]}
                    </span>
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
