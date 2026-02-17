import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldPlus, Pencil, Trash2, Loader2, Shield } from "lucide-react";

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  base_role: string;
  is_system: boolean;
  created_at: string;
}

interface Permission {
  id: string;
  key: string;
  label: string;
  category: string;
}

const baseRoleLabels: Record<string, string> = {
  admin: "Администратор",
  staff: "Учител ИТ",
  user: "Учител",
  maintenance: "Обслужващ персонал",
  support: "Поддръжка",
};

export default function RolesManagementPage() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formBaseRole, setFormBaseRole] = useState("user");
  const [formPermissions, setFormPermissions] = useState<string[]>([]);

  // Selected role for permissions view
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [rolesRes, permsRes, rpRes] = await Promise.all([
      supabase.from("custom_roles").select("*").order("created_at"),
      supabase.from("permissions").select("*").order("category, key"),
      supabase.from("role_permissions").select("role_id, permission_id"),
    ]);
    if (rolesRes.data) setRoles(rolesRes.data as CustomRole[]);
    if (permsRes.data) setPermissions(permsRes.data as Permission[]);
    if (rpRes.data) {
      const map: Record<string, string[]> = {};
      rpRes.data.forEach((rp: any) => {
        if (!map[rp.role_id]) map[rp.role_id] = [];
        map[rp.role_id].push(rp.permission_id);
      });
      setRolePermissions(map);
    }
  };

  const openCreate = () => {
    setEditingRole(null);
    setFormName("");
    setFormDescription("");
    setFormBaseRole("user");
    setFormPermissions([]);
    setDialogOpen(true);
  };

  const openEdit = (role: CustomRole) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormDescription(role.description || "");
    setFormBaseRole(role.base_role);
    setFormPermissions(rolePermissions[role.id] || []);
    setDialogOpen(true);
  };

  const togglePermission = (permId: string) => {
    setFormPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const toggleCategory = (category: string) => {
    const catPermIds = permissions.filter((p) => p.category === category).map((p) => p.id);
    const allSelected = catPermIds.every((id) => formPermissions.includes(id));
    if (allSelected) {
      setFormPermissions((prev) => prev.filter((id) => !catPermIds.includes(id)));
    } else {
      setFormPermissions((prev) => [...new Set([...prev, ...catPermIds])]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Моля, въведете име на ролята.");
      return;
    }
    setLoading(true);
    try {
      let roleId: string;
      if (editingRole) {
        const { error } = await supabase
          .from("custom_roles")
          .update({ name: formName, description: formDescription || null, base_role: formBaseRole as any })
          .eq("id", editingRole.id);
        if (error) throw error;
        roleId = editingRole.id;

        // Also update the base_role in user_roles for users with this custom role
        const { error: urError } = await supabase
          .from("user_roles")
          .update({ role: formBaseRole as any })
          .eq("custom_role_id", editingRole.id);
        if (urError) throw urError;
      } else {
        const { data, error } = await supabase
          .from("custom_roles")
          .insert({ name: formName, description: formDescription || null, base_role: formBaseRole as any })
          .select()
          .single();
        if (error) throw error;
        roleId = data.id;
      }

      // Sync permissions: delete all, then insert
      await supabase.from("role_permissions").delete().eq("role_id", roleId);
      if (formPermissions.length > 0) {
        const inserts = formPermissions.map((pid) => ({ role_id: roleId, permission_id: pid }));
        const { error: rpError } = await supabase.from("role_permissions").insert(inserts);
        if (rpError) throw rpError;
      }

      toast.success(editingRole ? "Ролята е обновена!" : "Ролята е създадена!");
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error("Грешка", { description: err.message });
    }
    setLoading(false);
  };

  const handleDelete = async (role: CustomRole) => {
    const { error } = await supabase.from("custom_roles").delete().eq("id", role.id);
    if (error) {
      toast.error("Грешка при изтриване", { description: error.message });
    } else {
      toast.success("Ролята е изтрита!");
      fetchData();
    }
  };

  const permissionsByCategory = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Роли и права</h1>
        <Button onClick={openCreate}>
          <ShieldPlus className="mr-2 h-4 w-4" />
          Нова роля
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Roles list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Роли</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                    selectedRoleId === role.id ? "bg-accent" : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedRoleId(role.id)}
                >
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{role.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {role.description || baseRoleLabels[role.base_role]}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {(rolePermissions[role.id] || []).length} права
                    </Badge>
                    {role.is_system && (
                      <Badge variant="secondary" className="text-xs">Системна</Badge>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(role); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!role.is_system && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Изтриване на роля</AlertDialogTitle>
                            <AlertDialogDescription>
                              Сигурни ли сте, че искате да изтриете ролята "{role.name}"? Потребителите с тази роля ще загубят правата си.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отказ</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(role)}>Изтрий</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Permissions preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedRole ? `Права на „${selectedRole.name}"` : "Изберете роля"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedRole ? (
              <div className="space-y-4">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category}>
                    <h4 className="mb-2 text-sm font-semibold text-foreground">{category}</h4>
                    <div className="space-y-1">
                      {perms.map((p) => {
                        const hasIt = (rolePermissions[selectedRole.id] || []).includes(p.id);
                        return (
                          <div key={p.id} className="flex items-center gap-2 text-sm">
                            <div className={`h-2 w-2 rounded-full ${hasIt ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                            <span className={hasIt ? "text-foreground" : "text-muted-foreground"}>{p.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Кликнете върху роля от списъка, за да видите правата.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Редактиране на роля" : "Създаване на роля"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Име на ролята *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="напр. Завуч" required />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Кратко описание..." />
            </div>
            <div className="space-y-2">
              <Label>Базово ниво на достъп</Label>
              <Select value={formBaseRole} onValueChange={setFormBaseRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор (вижда всичко)</SelectItem>
                  <SelectItem value="staff">Персонал (вижда отдела си)</SelectItem>
                  <SelectItem value="support">Поддръжка (вижда отдела си)</SelectItem>
                  <SelectItem value="maintenance">Обслужващ (вижда отдела си)</SelectItem>
                  <SelectItem value="user">Учител (вижда само своите)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Определя кои заявки вижда потребителят на ниво база данни.</p>
            </div>

            <div className="space-y-3">
              <Label>Права</Label>
              {Object.entries(permissionsByCategory).map(([category, perms]) => {
                const catPermIds = perms.map((p) => p.id);
                const allSelected = catPermIds.every((id) => formPermissions.includes(id));
                const someSelected = catPermIds.some((id) => formPermissions.includes(id));
                return (
                  <div key={category} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Checkbox
                        checked={allSelected}
                        ref={undefined}
                        onCheckedChange={() => toggleCategory(category)}
                        className={someSelected && !allSelected ? "opacity-60" : ""}
                      />
                      <span className="text-sm font-semibold text-foreground">{category}</span>
                    </div>
                    <div className="ml-6 space-y-1.5">
                      {perms.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={formPermissions.includes(p.id)}
                            onCheckedChange={() => togglePermission(p.id)}
                          />
                          <span className="text-sm text-foreground">{p.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingRole ? "Запази промените" : "Създай роля"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
