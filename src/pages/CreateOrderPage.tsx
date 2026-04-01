import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Paperclip, X } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import { logAuditAction } from "@/lib/auditLog";

export default function CreateOrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setSaving(true);

    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          title: title.trim(),
          order_number: orderNumber.trim() || null,
          content,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Upload attachments
      for (const file of files) {
        const path = `${order.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("order-attachments")
          .upload(path, file);
        if (uploadErr) {
          console.error("Upload error:", uploadErr);
          continue;
        }
        await supabase.from("order_attachments").insert({
          order_id: order.id,
          file_name: file.name,
          file_path: path,
          file_type: file.type,
          file_size: file.size,
          user_id: user.id,
        });
      }

      logAuditAction("Създаване на заповед", "order", order.id, { title: title.trim() });
      toast.success("Заповедта е създадена!");
      navigate(`/orders/${order.id}`);
    } catch (err: any) {
      toast.error("Грешка", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={() => navigate("/orders")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Назад
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Нова заповед</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Заглавие *</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="Заглавие на заповедта" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderNumber">Номер на заповед</Label>
                <Input id="orderNumber" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="напр. РД-12-345" maxLength={50} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Съдържание</Label>
              <RichTextEditor content={content} onChange={setContent} placeholder="Напишете текста на заповедта..." />
            </div>

            <div className="space-y-2">
              <Label>Прикачени файлове</Label>
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm">
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[150px] truncate">{f.name}</span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="mr-1 h-3 w-3" /> Добави файл
                </Button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Създай заповед
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/orders")}>Отказ</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
