import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

export default function CreateTicketPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<any[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("normal");
  const [className, setClassName] = useState("");
  const [room, setRoom] = useState("");

  useEffect(() => {
    supabase.from("departments").select("*").order("name").then(({ data }) => {
      if (data) setDepartments(data);
    });
  }, []);

  // Fetch staff in selected department
  useEffect(() => {
    if (!departmentId) {
      setStaffProfiles([]);
      setAssignedTo("");
      return;
    }
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("department_id", departmentId)
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => {
        setStaffProfiles(data || []);
        // Auto-assign default assignee if department has one
        const dept = departments.find((d) => d.id === departmentId);
        if (dept?.default_assignee_id) {
          setAssignedTo(dept.default_assignee_id);
        } else {
          setAssignedTo("");
        }
      });
  }, [departmentId, departments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !description.trim() || !departmentId) {
      toast.error("Моля, попълнете всички задължителни полета.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.from("tickets").insert({
      title: title.trim(),
      description: description.trim(),
      department_id: departmentId,
      priority: priority as any,
      class_name: className.trim() || null,
      room: room.trim() || null,
      created_by: user.id,
      assigned_to: assignedTo && assignedTo !== "none" ? assignedTo : null,
    }).select().single();

    if (error) {
      toast.error("Грешка при създаване на заявка", { description: error.message });
    } else {
      // Create initial event
      await supabase.from("ticket_events").insert({
        ticket_id: data.id,
        user_id: user.id,
        event_type: "created",
        description: "Заявката е създадена.",
      });
      toast.success("Заявката е създадена успешно!");
      navigate(`/tickets/${data.id}`);
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Нова заявка</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Заглавие *</Label>
              <Input
                id="title"
                placeholder="Кратко описание на проблема"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание *</Label>
              <Textarea
                id="description"
                placeholder="Подробно описание на проблема или заявката..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={2000}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Отдел *</Label>
                <Select value={departmentId} onValueChange={setDepartmentId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Изберете отдел" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
              </Select>
                {departmentId && (
                  <p className="text-xs text-muted-foreground">
                    Заявката ще бъде видима за всички служители в този отдел.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Приоритет</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label>Назначи на (по избор)</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo} disabled={!departmentId}>
                <SelectTrigger>
                  <SelectValue placeholder={departmentId ? "Изберете служител" : "Първо изберете отдел"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без назначение</SelectItem>
                  {staffProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="class">Клас (по избор)</Label>
                <Input
                  id="class"
                  placeholder="напр. 7Б, 10В"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room">Стая (по избор)</Label>
                <Input
                  id="room"
                  placeholder="напр. 204, физкултурен салон"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  maxLength={50}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Отказ
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Изпрати заявка
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
