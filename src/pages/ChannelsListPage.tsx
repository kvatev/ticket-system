import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Hash, Users, KeyRound, Loader2, Trash2, Search, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logAuditAction } from "@/lib/auditLog";

export default function ChannelsListPage() {
  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canCreate = role === "admin" || hasPermission("channels.create");

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [search, setSearch] = useState("");

  const { data: channels, isLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("*, channel_members(count)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data: channel, error } = await supabase
        .from("channels")
        .insert({ name: name.trim(), description: description.trim(), created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      // Add creator as admin member
      await supabase.from("channel_members").insert({
        channel_id: channel.id,
        user_id: user.id,
        role: "admin",
      });
      return channel;
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Каналът е създаден!");
      logAuditAction("Създаване на канал", "channel", channel.id, { name: name.trim() });
      setCreateOpen(false);
      setName("");
      setDescription("");
      navigate(`/channels/${channel.id}`);
    },
    onError: (err: any) => toast.error("Грешка", { description: err.message }),
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      // Find channel by invite code
      const { data: channel, error } = await supabase
        .from("channels")
        .select("id, name")
        .eq("invite_code", inviteCode.trim())
        .eq("is_active", true)
        .single();
      if (error || !channel) throw new Error("Невалиден код за покана.");
      // Join
      const { error: joinErr } = await supabase.from("channel_members").insert({
        channel_id: channel.id,
        user_id: user.id,
      });
      if (joinErr) {
        if (joinErr.message.includes("duplicate")) throw new Error("Вече сте член на този канал.");
        throw joinErr;
      }
      return channel;
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success(`Присъединихте се към „${channel.name}"!`);
      setJoinOpen(false);
      setInviteCode("");
      navigate(`/channels/${channel.id}`);
    },
    onError: (err: any) => toast.error("Грешка", { description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("channels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Каналът е изтрит.");
      logAuditAction("Изтриване на канал", "channel");
    },
    onError: () => toast.error("Грешка при изтриване."),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Канали</h1>
        <div className="flex gap-2">
          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <KeyRound className="mr-2 h-4 w-4" /> Присъединяване
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Присъединяване с код</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); joinMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Код за покана</Label>
                  <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Въведете кода..." required />
                </div>
                <Button type="submit" disabled={joinMutation.isPending} className="w-full">
                  {joinMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Присъедини се
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          {canCreate && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Нов канал</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Нов канал</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Име *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Учителски съвет" required maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label>Описание</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Кратко описание..." maxLength={500} />
                  </div>
                  <Button type="submit" disabled={createMutation.isPending} className="w-full">
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Създай
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Търсене по име или описание..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !channels?.length ? (
        <p className="py-12 text-center text-muted-foreground">Нямате канали. Създайте нов или се присъединете с код.</p>
      ) : (() => {
        const q = search.trim().toLowerCase();
        const filtered = q ? channels.filter(ch => ch.name.toLowerCase().includes(q) || (ch.description ?? "").toLowerCase().includes(q)) : channels;
        return !filtered.length ? (
          <p className="py-12 text-center text-muted-foreground">Няма намерени канали за „{search.trim()}"</p>
        ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ch) => (
            <Card key={ch.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/channels/${ch.id}`)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Hash className="h-4 w-4 text-primary" />
                    {ch.name}
                  </CardTitle>
                  {(role === "admin" || ch.created_by === user?.id) && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Изтриване на канала?")) deleteMutation.mutate(ch.id);
                    }}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {ch.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{ch.description}</p>}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {(ch.channel_members as any)?.[0]?.count ?? 0} членове
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        );
      })()}
    </div>
  );
}
