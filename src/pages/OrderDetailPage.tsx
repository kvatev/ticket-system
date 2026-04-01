import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, FileText, Download, Calendar } from "lucide-react";
import { format } from "date-fns";
import { bg } from "date-fns/locale";

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, profiles!orders_created_by_fkey(full_name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: attachments } = useQuery({
    queryKey: ["order-attachments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_attachments")
        .select("*")
        .eq("order_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from("order-attachments").download(filePath);
    if (error || !data) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return <p className="py-12 text-center text-muted-foreground">Заповедта не е намерена.</p>;
  }

  const isExpired = new Date(order.expires_at) < new Date();

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={() => navigate("/orders")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Назад
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {order.title}
              </CardTitle>
              {order.order_number && (
                <p className="mt-1 text-sm text-muted-foreground">Номер: {order.order_number}</p>
              )}
            </div>
            {isExpired ? <Badge variant="destructive">Изтекла</Badge> : <Badge variant="secondary">Активна</Badge>}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
            <span>Издадена от: {(order as any).profiles?.full_name ?? "—"}</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(order.created_at), "dd MMM yyyy, HH:mm", { locale: bg })}
            </span>
            <span>Валидна до: {format(new Date(order.expires_at), "dd MMM yyyy", { locale: bg })}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: order.content || "<p><em>Няма съдържание.</em></p>" }}
          />

          {attachments && attachments.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Прикачени файлове</h3>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <Button
                    key={att.id}
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(att.file_path, att.file_name)}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    {att.file_name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
