import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Loader2, Pencil } from "lucide-react";

const roleLabels: Record<string, string> = {
  admin: "Администратор",
  staff: "Учител ИТ",
  user: "Учител",
};

export default function UsersManagementPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // New user form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newDeptId, setNewDeptId] = useState("");

  // Role edit
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [profilesRes, deptRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("departments").select("*").order("name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
    if (rolesRes.data) {
      const map: Record<string, string> = {};
      rolesRes.data.forEach((r: any) => { map[r.user_id] = r.role; });
      setRoles(map);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName || !newPassword) {
      toast.error("Моля, попълнете всички полета.");
      return;
    }
    if (!newEmail.endsWith("@edu.mon.bg")) {
      toast.error("Имейлът трябва да завършва с @edu.mon.bg");
      return;
    }
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            email: newEmail,
            password: newPassword,
            full_name: newName,
            role: newRole,
            department_id: newDeptId || null,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        toast.error("Грешка при създаване", { description: result.error });
      } else {
        toast.success("Потребителят е създаден успешно!");
        setDialogOpen(false);
        setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("user"); setNewDeptId("");
        fetchData();
      }
    } catch (err: any) {
      toast.error("Грешка при създаване", { description: err.message });
    }
    setLoading(false);
  };

  const handleUpdateRole = async (userId: string) => {
    setSavingRole(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "update_role", user_id: userId, role: editRole }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        toast.error("Грешка при промяна на роля", { description: result.error });
      } else {
        toast.success("Ролята е променена успешно!");
        setEditingUserId(null);
        fetchData();
      }
    } catch (err: any) {
      toast.error("Грешка", { description: err.message });
    }
    setSavingRole(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Потребители</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" />Нов потребител</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Създаване на потребител</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label>Име *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Иван Иванов" required />
              </div>
              <div className="space-y-2">
                <Label>Имейл *</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="krasimir.vatev@edu.mon.bg" required />
              </div>
              <div className="space-y-2">
                <Label>Парола *</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Роля</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Учител</SelectItem>
                      <SelectItem value="staff">Учител ИТ</SelectItem>
                      <SelectItem value="admin">Администратор</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Отдел</Label>
                  <Select value={newDeptId} onValueChange={setNewDeptId}>
                    <SelectTrigger><SelectValue placeholder="Без отдел" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Създай
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {profiles.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">Няма потребители.</p>
            ) : (
              profiles.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {p.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingUserId === p.user_id ? (
                      <div className="flex items-center gap-2">
                        <Select value={editRole} onValueChange={setEditRole}>
                          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Учител</SelectItem>
                            <SelectItem value="staff">Учител ИТ</SelectItem>
                            <SelectItem value="admin">Администратор</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => handleUpdateRole(p.user_id)} disabled={savingRole}>
                          {savingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : "Запази"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>Отказ</Button>
                      </div>
                    ) : (
                      <>
                        <Badge variant={roles[p.user_id] === "admin" ? "default" : roles[p.user_id] === "staff" ? "outline" : "secondary"}>
                          {roleLabels[roles[p.user_id]] ?? "Без роля"}
                        </Badge>
                        {p.user_id !== user?.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => { setEditingUserId(p.user_id); setEditRole(roles[p.user_id] || "user"); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                    {!p.is_active && (
                      <Badge variant="destructive">Деактивиран</Badge>
                    )}
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
