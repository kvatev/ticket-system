import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Loader2, Pencil, Ban, CheckCircle, Search, Trash2, KeyRound } from "lucide-react";
import { logAuditAction } from "@/lib/auditLog";

interface CustomRole {
  id: string;
  name: string;
  base_role: string;
}

export default function UsersManagementPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, { role: string; custom_role_id: string | null }>>({});
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // New user form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newCustomRoleId, setNewCustomRoleId] = useState("");
  const [newDeptId, setNewDeptId] = useState("");

  // Role & dept edit
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editCustomRoleId, setEditCustomRoleId] = useState("");
  const [editDeptId, setEditDeptId] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  // Password reset
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordName, setResetPasswordName] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [profilesRes, deptRes, rolesRes, customRolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("departments").select("*").order("name"),
      supabase.from("user_roles").select("user_id, role, custom_role_id"),
      supabase.from("custom_roles").select("id, name, base_role").order("name"),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
    if (customRolesRes.data) {
      setCustomRoles(customRolesRes.data as CustomRole[]);
      // Set default new role to first custom role
      if (customRolesRes.data.length > 0 && !newCustomRoleId) {
        const userRole = customRolesRes.data.find((r: any) => r.base_role === "user");
        setNewCustomRoleId(userRole?.id || customRolesRes.data[0].id);
      }
    }
    if (rolesRes.data) {
      const map: Record<string, { role: string; custom_role_id: string | null }> = {};
      rolesRes.data.forEach((r: any) => {
        map[r.user_id] = { role: r.role, custom_role_id: r.custom_role_id };
      });
      setUserRoles(map);
    }
  };

  const getCustomRoleName = (userId: string) => {
    const ur = userRoles[userId];
    if (!ur?.custom_role_id) return ur?.role || "Без роля";
    const cr = customRoles.find((r) => r.id === ur.custom_role_id);
    return cr?.name || ur.role || "Без роля";
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
    const selectedRole = customRoles.find((r) => r.id === newCustomRoleId);
    if (!selectedRole) {
      toast.error("Моля, изберете роля.");
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
            role: selectedRole.base_role,
            custom_role_id: newCustomRoleId,
            department_id: newDeptId || null,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        toast.error("Грешка при създаване", { description: result.error });
      } else {
        toast.success("Потребителят е създаден успешно!");
        logAuditAction("Създаване на потребител", "user", undefined, { email: newEmail, name: newName });
        setDialogOpen(false);
        setNewEmail(""); setNewName(""); setNewPassword(""); setNewDeptId("");
        fetchData();
      }
    } catch (err: any) {
      toast.error("Грешка при създаване", { description: err.message });
    }
    setLoading(false);
  };

  const handleUpdateRoleAndDept = async (userId: string, profileId: string) => {
    const selectedRole = customRoles.find((r) => r.id === editCustomRoleId);
    if (!selectedRole) return;
    setSavingRole(true);
    try {
      // Update role
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
            action: "update_role",
            user_id: userId,
            role: selectedRole.base_role,
            custom_role_id: editCustomRoleId,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        toast.error("Грешка при промяна на роля", { description: result.error });
        setSavingRole(false);
        return;
      }

      // Update department
      const { error: deptError } = await supabase
        .from("profiles")
        .update({ department_id: editDeptId === "none" ? null : editDeptId || null })
        .eq("id", profileId);
      if (deptError) {
        toast.error("Грешка при промяна на отдел", { description: deptError.message });
      } else {
        toast.success("Данните са променени успешно!");
        setEditingUserId(null);
        fetchData();
      }
    } catch (err: any) {
      toast.error("Грешка", { description: err.message });
    }
    setSavingRole(false);
  };

  const handleToggleActive = async (profile: any) => {
    const newStatus = !profile.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: newStatus })
      .eq("id", profile.id);
    if (error) {
      toast.error("Грешка при промяна на статус", { description: error.message });
    } else {
      toast.success(newStatus ? "Потребителят е активиран!" : "Потребителят е деактивиран!");
      fetchData();
    }
  };

  const handleDeleteUser = async (profile: any) => {
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
          body: JSON.stringify({ action: "delete_user", user_id: profile.user_id }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        toast.error("Грешка при изтриване", { description: result.error });
      } else {
        toast.success("Потребителят е изтрит успешно!");
        fetchData();
      }
    } catch (err: any) {
      toast.error("Грешка", { description: err.message });
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUserId || !resetNewPassword) return;
    if (resetNewPassword.length < 6) {
      toast.error("Паролата трябва да е поне 6 символа.");
      return;
    }
    setResetLoading(true);
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
            action: "reset_password",
            user_id: resetPasswordUserId,
            password: resetNewPassword,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        toast.error("Грешка при смяна на парола", { description: result.error });
      } else {
        toast.success("Паролата е променена успешно!");
        setResetPasswordUserId(null);
        setResetNewPassword("");
      }
    } catch (err: any) {
      toast.error("Грешка", { description: err.message });
    }
    setResetLoading(false);
  };

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
    const matchesRole = filterRole === "all" || userRoles[p.user_id]?.custom_role_id === filterRole;
    const matchesStatus = filterStatus === "all" || (filterStatus === "active" ? p.is_active : !p.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

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
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="ivan@edu.mon.bg" required />
              </div>
              <div className="space-y-2">
                <Label>Парола *</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Роля</Label>
                  <Select value={newCustomRoleId} onValueChange={setNewCustomRoleId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {customRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Търсене по име или имейл..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички роли</SelectItem>
            {customRoles.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички статуси</SelectItem>
            <SelectItem value="active">Активни</SelectItem>
            <SelectItem value="inactive">Деактивирани</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filteredProfiles.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">Няма намерени потребители.</p>
            ) : (
              filteredProfiles.map((p) => (
                <div key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {p.full_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{p.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {departments.find((d) => d.id === p.department_id)?.name || "Без отдел"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {editingUserId === p.user_id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={editCustomRoleId} onValueChange={setEditCustomRoleId}>
                          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {customRoles.map((r) => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={editDeptId} onValueChange={setEditDeptId}>
                          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Без отдел" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Без отдел</SelectItem>
                            {departments.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => handleUpdateRoleAndDept(p.user_id, p.id)} disabled={savingRole}>
                          {savingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : "Запази"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>Отказ</Button>
                      </div>
                    ) : (
                      <>
                        <Badge variant={userRoles[p.user_id]?.role === "admin" ? "default" : "secondary"}>
                          {getCustomRoleName(p.user_id)}
                        </Badge>
                        {p.user_id !== user?.id && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingUserId(p.user_id);
                                setEditCustomRoleId(userRoles[p.user_id]?.custom_role_id || "");
                                setEditDeptId(p.department_id || "none");
                              }}
                              title="Редактирай"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                setResetPasswordUserId(p.user_id);
                                setResetPasswordName(p.full_name);
                                setResetNewPassword("");
                              }}
                              title="Смяна на парола"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className={`h-8 w-8 ${p.is_active ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-700"}`}
                                >
                                  {p.is_active ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {p.is_active ? "Деактивиране на потребител" : "Активиране на потребител"}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {p.is_active
                                      ? `Сигурни ли сте, че искате да деактивирате ${p.full_name}? Потребителят няма да може да влиза в системата.`
                                      : `Сигурни ли сте, че искате да активирате ${p.full_name}?`}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отказ</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleToggleActive(p)}>
                                    {p.is_active ? "Деактивирай" : "Активирай"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Изтриване на потребител</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Сигурни ли сте, че искате да изтриете {p.full_name}? Това действие е необратимо и ще премахне всички данни на потребителя.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отказ</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDeleteUser(p)}
                                  >
                                    Изтрий
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
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

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUserId} onOpenChange={(open) => { if (!open) setResetPasswordUserId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Смяна на парола за {resetPasswordName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Нова парола</Label>
              <Input
                type="password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="Минимум 6 символа"
                minLength={6}
              />
            </div>
            <Button className="w-full" onClick={handleResetPassword} disabled={resetLoading || resetNewPassword.length < 6}>
              {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Смени паролата
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
