import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Clock,
  Send,
  MessageSquare,
  Lock,
  User,
  Building2,
  Tag,
  AlertTriangle,
  Pencil,
  Check,
  X,
  Trash2,
} from "lucide-react";

const statusLabels: Record<string, string> = {
  new: "Нова", in_progress: "В процес", waiting_for_user: "Чака отговор",
  resolved: "Решена", closed: "Затворена",
};
const priorityLabels: Record<string, string> = {
  low: "Ниска", normal: "Нормална", high: "Висока", urgent: "Спешна",
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    const [ticketRes, messagesRes, eventsRes] = await Promise.all([
      supabase.from("tickets").select("*, departments(name), profiles!tickets_assigned_to_fkey(id, full_name)").eq("id", id!).single(),
      supabase.from("ticket_messages").select("*, profiles:user_id(full_name)").eq("ticket_id", id!).order("created_at", { ascending: true }),
      supabase.from("ticket_events").select("*, profiles:user_id(full_name)").eq("ticket_id", id!).order("created_at", { ascending: true }),
    ]);

    // The creator join may fail due to FK naming - handle gracefully
    if (ticketRes.data) setTicket(ticketRes.data);
    if (messagesRes.data) setMessages(messagesRes.data);
    if (eventsRes.data) setEvents(eventsRes.data);

    // Fetch staff for assignment
    if (role === "admin" || role === "staff") {
      const { data: staff } = await supabase.from("profiles").select("id, full_name");
      if (staff) setStaffMembers(staff);
    }

    setLoading(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !id) return;
    setSending(true);
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: id,
      user_id: user.id,
      content: newMessage.trim(),
      is_internal: isInternal,
    });
    if (error) {
      toast.error("Грешка при изпращане на съобщението");
    } else {
      setNewMessage("");
      fetchAll();
    }
    setSending(false);
  };

  const updateStatus = async (newStatus: string) => {
    if (!user || !id) return;
    const { error } = await supabase.from("tickets").update({ status: newStatus as any }).eq("id", id);
    if (error) {
      toast.error("Грешка при промяна на статуса");
    } else {
      await supabase.from("ticket_events").insert({
        ticket_id: id,
        user_id: user.id,
        event_type: "status_change",
        description: `Статусът е променен на: ${statusLabels[newStatus]}`,
      });
      toast.success("Статусът е обновен");
      fetchAll();
    }
  };

  const assignTicket = async (profileId: string) => {
    if (!user || !id) return;
    const { error } = await supabase.from("tickets").update({ assigned_to: profileId }).eq("id", id);
    if (error) {
      toast.error("Грешка при възлагане");
    } else {
      const assignee = staffMembers.find(s => s.id === profileId);
      await supabase.from("ticket_events").insert({
        ticket_id: id,
        user_id: user.id,
        event_type: "assigned",
        description: `Заявката е възложена на: ${assignee?.full_name ?? "неизвестен"}`,
      });
      toast.success("Заявката е възложена");
      fetchAll();
    }
  };

  if (loading) {
    return <p className="py-12 text-center text-muted-foreground">Зареждане...</p>;
  }

  if (!ticket) {
    return <p className="py-12 text-center text-muted-foreground">Заявката не е намерена.</p>;
  }

  const canManage = role === "admin" || role === "staff" || role === "maintenance" || role === "support";
  const isOwner = ticket && user && ticket.created_by === user.id;
  const canEdit = role === "admin" || isOwner;

  const startEditing = () => {
    setEditTitle(ticket.title);
    setEditDescription(ticket.description);
    setEditPriority(ticket.priority);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveEdits = async () => {
    if (!user || !id || !editTitle.trim() || !editDescription.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("tickets").update({
      title: editTitle.trim(),
      description: editDescription.trim(),
      priority: editPriority as any,
    }).eq("id", id);
    if (error) {
      toast.error("Грешка при запазване на промените");
    } else {
      await supabase.from("ticket_events").insert({
        ticket_id: id,
        user_id: user.id,
        event_type: "edited",
        description: "Заявката е редактирана",
      });
      toast.success("Заявката е обновена");
      setEditing(false);
      fetchAll();
    }
    setSaving(false);
  };

  const deleteTicket = async () => {
    if (!id) return;
    // Delete related data first, then ticket
    await Promise.all([
      supabase.from("ticket_messages").delete().eq("ticket_id", id),
      supabase.from("ticket_events").delete().eq("ticket_id", id),
      supabase.from("ticket_attachments").delete().eq("ticket_id", id),
    ]);
    const { error } = await supabase.from("tickets").delete().eq("id", id);
    if (error) {
      toast.error("Грешка при изтриване на заявката");
    } else {
      toast.success("Заявката е изтрита");
      navigate("/tickets");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-2">
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-xl font-bold" />
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Ниска</SelectItem>
                    <SelectItem value="normal">Нормална</SelectItem>
                    <SelectItem value="high">Висока</SelectItem>
                    <SelectItem value="urgent">Спешна</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{ticket.title}</h1>
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEditing}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium status-badge-${ticket.status === "in_progress" ? "in-progress" : ticket.status}`}>
                    {statusLabels[ticket.status]}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium priority-${ticket.priority}`}>
                    {priorityLabels[ticket.priority]}
                  </span>
                  <span>•</span>
                  <span>{(ticket.departments as any)?.name}</span>
                  {ticket.class_name && <><span>•</span><span>Клас {ticket.class_name}</span></>}
                  {ticket.room && <><span>•</span><span>Стая {ticket.room}</span></>}
                </div>
              </>
            )}
          </div>
          {editing && (
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdits} disabled={saving}>
                <Check className="mr-1 h-4 w-4" /> Запази
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEditing}>
                <X className="mr-1 h-4 w-4" /> Откажи
              </Button>
            </div>
          )}
        </div>
        {role === "admin" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Изтриване на заявка</AlertDialogTitle>
                <AlertDialogDescription>
                  Сигурни ли сте, че искате да изтриете тази заявка? Това действие е необратимо.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Откажи</AlertDialogCancel>
                <AlertDialogAction onClick={deleteTicket} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Изтрий
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Описание</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={5} />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.description}</p>
              )}
            </CardContent>
          </Card>

          {/* Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Разговор
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Няма съобщения.</p>
              ) : (
                messages
                  .filter((m) => !m.is_internal || canManage)
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg border p-3 ${msg.is_internal ? "border-accent/30 bg-accent/5" : "border-border"}`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="font-medium">{(msg.profiles as any)?.full_name ?? "..."}</span>
                        {msg.is_internal && (
                          <span className="flex items-center gap-1 text-accent">
                            <Lock className="h-3 w-3" />
                            Вътрешна бележка
                          </span>
                        )}
                        <span>•</span>
                        <span>{new Date(msg.created_at).toLocaleString("bg-BG")}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{msg.content}</p>
                    </div>
                  ))
              )}

              <Separator />

              {/* New message form */}
              <div className="space-y-3">
                <Textarea
                  placeholder="Напишете съобщение..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                  maxLength={2000}
                />
                <div className="flex items-center justify-between">
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="internal"
                        checked={isInternal}
                        onCheckedChange={setIsInternal}
                      />
                      <Label htmlFor="internal" className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Вътрешна бележка
                      </Label>
                    </div>
                  )}
                  <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="sm">
                    <Send className="mr-2 h-4 w-4" />
                    Изпрати
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Действия</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Статус</Label>
                  <Select value={ticket.status} onValueChange={updateStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Нова</SelectItem>
                      <SelectItem value="in_progress">В процес</SelectItem>
                      <SelectItem value="waiting_for_user">Чака отговор</SelectItem>
                      <SelectItem value="resolved">Решена</SelectItem>
                      <SelectItem value="closed">Затворена</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Възложена на</Label>
                  <Select
                    value={ticket.assigned_to ?? "unassigned"}
                    onValueChange={(v) => v !== "unassigned" && assignTicket(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Не е възложена" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Не е възложена</SelectItem>
                      {staffMembers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Детайли</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Създадена</span>
                <span className="text-foreground">{new Date(ticket.created_at).toLocaleString("bg-BG")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Обновена</span>
                <span className="text-foreground">{new Date(ticket.updated_at).toLocaleString("bg-BG")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Възложена на</span>
                <span className="text-foreground">{(ticket.profiles as any)?.full_name ?? "—"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Хронология
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Няма събития.</p>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="flex gap-3 text-sm">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="text-foreground">{event.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {(event.profiles as any)?.full_name} • {new Date(event.created_at).toLocaleString("bg-BG")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
