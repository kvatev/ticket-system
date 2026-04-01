import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, FileText, Trash2, Loader2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import { logAuditAction } from "@/lib/auditLog";

export default function OrdersListPage() {
  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canCreate = role === "admin" || hasPermission("orders.create");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch creator names
      const userIds = [...new Set(data.map((o: any) => o.created_by))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
      return data.map((o: any) => ({ ...o, creator_name: profileMap[o.created_by] ?? "—" }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Заповедта е изтрита.");
      logAuditAction("Изтриване на заповед", "order");
    },
    onError: () => toast.error("Грешка при изтриване."),
  });

  const filtered = orders?.filter((o) =>
    o.title.toLowerCase().includes(search.toLowerCase()) ||
    (o.order_number && o.order_number.toLowerCase().includes(search.toLowerCase()))
  );

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Заповеди</h1>
        {canCreate && (
          <Button onClick={() => navigate("/orders/new")}>
            <Plus className="mr-2 h-4 w-4" /> Нова заповед
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Търсене по заглавие или номер..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !filtered?.length ? (
        <p className="py-12 text-center text-muted-foreground">Няма намерени заповеди.</p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{order.title}</CardTitle>
                      {order.order_number && (
                        <p className="text-xs text-muted-foreground">№ {order.order_number}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isExpired(order.expires_at) ? (
                      <Badge variant="destructive">Изтекла</Badge>
                    ) : (
                      <Badge variant="secondary">Активна</Badge>
                    )}
                    {(role === "admin" || order.created_by === user?.id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Изтриване на заповедта?")) deleteMutation.mutate(order.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>От: {(order as any).profiles?.full_name ?? "—"}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(order.created_at), "dd MMM yyyy", { locale: bg })}
                  </span>
                  <span>Валидна до: {format(new Date(order.expires_at), "dd MMM yyyy", { locale: bg })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
