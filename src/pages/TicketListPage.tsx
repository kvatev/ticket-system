import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PlusCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

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
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [filterStatus, filterDept, filterPriority, search, mode]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [mode, filterStatus, filterDept, filterPriority, search, page, user]);

  useEffect(() => {
    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchTickets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [mode, filterStatus, filterDept, filterPriority, search, page, user]);

  const fetchDepartments = async () => {
    const { data } = await supabase.from("departments").select("*").order("name");
    if (data) setDepartments(data);
  };

  const buildQuery = (countOnly: boolean) => {
    let query = countOnly
      ? supabase.from("tickets").select("id", { count: "exact", head: true })
      : supabase.from("tickets").select("*, departments(name), profiles!tickets_assigned_to_fkey(full_name)").order("created_at", { ascending: false });

    if (mode === "assigned" && profile) query = query.eq("assigned_to", profile.id);
    else if (mode === "department" && profile?.department_id) query = query.eq("department_id", profile.department_id);

    if (filterStatus !== "all") query = query.eq("status", filterStatus as any);
    if (filterDept !== "all") query = query.eq("department_id", filterDept);
    if (filterPriority !== "all") query = query.eq("priority", filterPriority as any);

    if (search) {
      const q = `%${search}%`;
      query = query.or(`title.ilike.${q},description.ilike.${q},class_name.ilike.${q},room.ilike.${q}`);
    }

    return query;
  };

  const fetchTickets = async () => {
    setLoading(true);

    const countQuery = buildQuery(true);
    const { count } = await countQuery;
    setTotalCount(count ?? 0);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const dataQuery = buildQuery(false).range(from, to);
    const { data } = await dataQuery;

    setTickets(data ?? []);
    setLoading(false);
  };

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
          <Button><PlusCircle className="mr-2 h-4 w-4" />Нова заявка</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Търсене по заглавие, описание, клас, стая..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Статус" /></SelectTrigger>
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
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Отдел" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички отдели</SelectItem>
            {departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Приоритет" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички приоритети</SelectItem>
            <SelectItem value="low">Ниска</SelectItem>
            <SelectItem value="normal">Нормална</SelectItem>
            <SelectItem value="high">Висока</SelectItem>
            <SelectItem value="urgent">Спешна</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ticket list */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-12 text-center text-muted-foreground">Зареждане...</p>
          ) : tickets.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">Няма намерени заявки.</p>
              <Link to="/tickets/new"><Button variant="outline" className="mt-4">Създай първата заявка</Button></Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tickets.map((ticket) => (
                <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{ticket.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(ticket.departments as any)?.name}
                      {ticket.class_name && ` • Клас ${ticket.class_name}`}
                      {ticket.room && ` • Стая ${ticket.room}`}
                      {" • "}{new Date(ticket.created_at).toLocaleDateString("bg-BG")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium priority-${ticket.priority}`}>{priorityLabels[ticket.priority]}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium status-badge-${ticket.status === "in_progress" ? "in-progress" : ticket.status}`}>{statusLabels[ticket.status]}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {totalCount} заявки • Страница {page + 1} от {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />Назад
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Напред<ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
