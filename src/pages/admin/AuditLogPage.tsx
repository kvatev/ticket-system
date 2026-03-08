import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
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
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">Журнал на действията</h1>

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
                      <Badge variant="outline" className="text-xs">{log.entity_type}</Badge>
                      <span className="text-sm font-medium text-foreground">{log.action}</span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-muted-foreground truncate max-w-lg">
                        {typeof log.details === "object" ? JSON.stringify(log.details) : log.details}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    <span>{profiles[log.user_id] || "Система"}</span>
                    <span className="mx-1">·</span>
                    <span>{format(new Date(log.created_at), "dd.MM.yyyy HH:mm")}</span>
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
