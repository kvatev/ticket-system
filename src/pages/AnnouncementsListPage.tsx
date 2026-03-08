import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, AlertTriangle, CheckSquare, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const typeLabels: Record<string, string> = {
  info: "Информация",
  warning: "Предупреждение",
  task: "Задача",
  urgent: "Спешно",
};

const typeIcons: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  task: CheckSquare,
  urgent: AlertCircle,
};

const typeColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  task: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export default function AnnouncementsListPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("announcements")
      .select("*, profiles!announcements_created_by_fkey(full_name)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setAnnouncements(data);
      });
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">Съобщения</h1>

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Няма активни съобщения.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const Icon = typeIcons[a.type] || Info;
            return (
              <Card key={a.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[a.type]}`}>
                      <Icon className="h-3 w-3" />
                      {typeLabels[a.type]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "dd.MM.yyyy HH:mm")}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground">{a.title}</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
                  {(a as any).profiles?.full_name && (
                    <p className="text-xs text-muted-foreground">От: {(a as any).profiles.full_name}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
