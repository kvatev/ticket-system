import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Megaphone, Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { format } from "date-fns";

const typeLabels: Record<string, string> = {
  info: "Информация",
  warning: "Предупреждение",
  task: "Задача",
  urgent: "Спешно",
};

const typeColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  task: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("info");

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("*, profiles!announcements_created_by_fkey(full_name)")
      .order("created_at", { ascending: false });
    if (data) setAnnouncements(data);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !user) return;
    setLoading(true);
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      content: content.trim(),
      type,
      created_by: user.id,
    });
    setLoading(false);
    if (error) {
      toast.error("Грешка при създаване на съобщение.");
    } else {
      toast.success("Съобщението е създадено!");
      setDialogOpen(false);
      setTitle("");
      setContent("");
      setType("info");
      fetchAnnouncements();
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: !isActive })
      .eq("id", id);
    if (!error) {
      toast.success(isActive ? "Съобщението е скрито." : "Съобщението е активирано.");
      fetchAnnouncements();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (!error) {
      toast.success("Съобщението е изтрито.");
      fetchAnnouncements();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Съобщения</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Ново съобщение</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ново глобално съобщение</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Заглавие *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Кратко заглавие" required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>Съдържание *</Label>
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Текст на съобщението..." required rows={4} />
              </div>
              <div className="space-y-2">
                <Label>Тип</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Информация</SelectItem>
                    <SelectItem value="warning">Предупреждение</SelectItem>
                    <SelectItem value="task">Задача</SelectItem>
                    <SelectItem value="urgent">Спешно</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Публикувай
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {announcements.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">Няма съобщения.</p>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[a.type]}`}>
                        {typeLabels[a.type]}
                      </span>
                      {!a.is_active && <Badge variant="outline" className="text-xs">Скрито</Badge>}
                    </div>
                    <p className="font-medium text-foreground">{a.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{a.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "dd.MM.yyyy HH:mm")}
                      {(a as any).profiles?.full_name && ` · ${(a as any).profiles.full_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleToggleActive(a.id, a.is_active)}
                      title={a.is_active ? "Скрий" : "Покажи"}
                    >
                      {a.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Изтриване на съобщение</AlertDialogTitle>
                          <AlertDialogDescription>Сигурни ли сте, че искате да изтриете това съобщение?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отказ</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(a.id)}>Изтрий</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
