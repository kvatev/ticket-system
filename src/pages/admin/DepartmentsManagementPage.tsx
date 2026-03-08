import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Building2, PlusCircle, Loader2, Pencil, Trash2, Check, X } from "lucide-react";
import { logAuditAction } from "@/lib/auditLog";

export default function DepartmentsManagementPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    const { data } = await supabase.from("departments").select("*").order("name");
    if (data) setDepartments(data);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("departments").insert({ name: newName.trim() });
    if (error) {
      toast.error("Грешка", { description: error.message });
    } else {
      toast.success("Отделът е създаден.");
      logAuditAction("Създаване на отдел", "department", undefined, { name: newName.trim() });
      setDialogOpen(false);
      setNewName("");
      fetchDepartments();
    }
    setLoading(false);
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("departments").update({ name: editName.trim() }).eq("id", id);
    if (error) {
      toast.error("Грешка", { description: error.message });
    } else {
      toast.success("Отделът е обновен.");
      logAuditAction("Редактиране на отдел", "department", id, { name: editName.trim() });
      setEditingId(null);
      fetchDepartments();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    // Check if there are tickets or profiles linked to this department
    const [{ count: ticketCount }, { count: profileCount }] = await Promise.all([
      supabase.from("tickets").select("id", { count: "exact", head: true }).eq("department_id", id),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("department_id", id),
    ]);

    if ((ticketCount ?? 0) > 0) {
      toast.error("Не може да се изтрие", {
        description: `Този отдел има ${ticketCount} заявки. Преместете или изтрийте заявките първо.`,
      });
      return;
    }

    // Unlink profiles from this department before deleting
    if ((profileCount ?? 0) > 0) {
      await supabase.from("profiles").update({ department_id: null }).eq("department_id", id);
    }

    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) {
      toast.error("Грешка при изтриване", { description: error.message });
    } else {
      toast.success("Отделът е изтрит.");
      fetchDepartments();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Отдели</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-4 w-4" />Нов отдел</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Нов отдел</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Име на отдела *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="напр. Библиотека" required maxLength={100} />
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
          {departments.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">Няма отдели.</p>
          ) : (
            <div className="divide-y divide-border">
              {departments.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="h-5 w-5 shrink-0 text-primary" />
                    {editingId === d.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 max-w-[240px]"
                        maxLength={100}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdate(d.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    ) : (
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Създаден: {new Date(d.created_at).toLocaleDateString("bg-BG")}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {editingId === d.id ? (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => handleUpdate(d.id)} disabled={loading}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => { setEditingId(d.id); setEditName(d.name); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Изтриване на отдел</AlertDialogTitle>
                              <AlertDialogDescription>
                                Сигурни ли сте, че искате да изтриете „{d.name}"? Това действие не може да бъде отменено.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Отказ</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(d.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Изтрий
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
