import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const entityLabels: Record<string, string> = {
  user: "Потребител",
  role: "Роля",
  department: "Отдел",
  settings: "Настройки",
  announcement: "Съобщение",
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [logsRes, profilesRes] = await Promise.all([
      supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    if (logsRes.data) setLogs(logsRes.data);
    if (profilesRes.data) {
      const map: Record<string, string> = {};
      profilesRes.data.forEach((p: any) => {
        map[p.user_id] = p.full_name;
      });
      setProfiles(map);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("audit_log").delete().eq("id", id);
    if (error) {
      toast.error("Грешка при изтриване", { description: error.message });
    } else {
      setLogs((prev) => prev.filter((l) => l.id !== id));
      toast.success("Записът е изтрит.");
    }
  };

  const handleClearAll = async () => {
    const ids = logs.map((l) => l.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from("audit_log").delete().in("id", ids);
    if (error) {
      toast.error("Грешка при изтриване", { description: error.message });
    } else {
      setLogs([]);
      toast.success("Всички записи са изтрити.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Журнал на действията</h1>
        {logs.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />Изчисти всички
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Изчистване на журнала</AlertDialogTitle>
                <AlertDialogDescription>
                  Сигурни ли сте, че искате да изтриете всички {logs.length} записа от журнала? Това действие е необратимо.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отказ</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleClearAll}>
                  Изтрий всички
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {logs.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">Няма записани действия.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {entityLabels[log.entity_type] || log.entity_type}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">{log.action}</span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-muted-foreground truncate max-w-lg">
                        {typeof log.details === "object"
                          ? Object.entries(log.details)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")
                          : log.details}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                    <span>{profiles[log.user_id] || "Система"}</span>
                    <span>·</span>
                    <span>{format(new Date(log.created_at), "dd.MM.yyyy HH:mm")}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(log.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
