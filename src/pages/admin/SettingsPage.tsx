import { useState, useEffect, useRef } from "react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Loader2, Upload, Trash2, School, Moon, Sun } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logAuditAction } from "@/lib/auditLog";
import { supabase } from "@/integrations/supabase/client";

export default function SettingsPage() {
  const { settings, loading, updateSetting } = useSystemSettings();
  const [schoolName, setSchoolName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSchoolName(settings.school_name);
    setSubtitle(settings.school_subtitle);
    if (settings.school_logo_url) {
      setLogoUrl(settings.school_logo_url);
    } else {
      // Check if logo exists in storage
      const { data } = supabase.storage.from("school-assets").getPublicUrl("logo");
      // We'll rely on the system_settings value
      setLogoUrl(null);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim()) return;
    setSaving(true);
    const r1 = await updateSetting("school_name", schoolName.trim());
    const r2 = await updateSetting("school_subtitle", subtitle.trim());
    setSaving(false);
    if (r1.error || r2.error) {
      toast.error("Грешка при запазване на настройките.");
    } else {
      toast.success("Настройките са запазени!");
      logAuditAction("Промяна на системни настройки", "settings", undefined, { school_name: schoolName.trim(), school_subtitle: subtitle.trim() });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Моля, изберете изображение.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Файлът е твърде голям (макс. 2MB).");
      return;
    }
    setUploading(true);
    // Remove old logo first
    await supabase.storage.from("school-assets").remove(["logo"]);
    const ext = file.name.split(".").pop() || "png";
    const path = `logo`;
    const { error } = await supabase.storage.from("school-assets").upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      toast.error("Грешка при качване на логото.");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("school-assets").getPublicUrl(path);
    const publicUrl = urlData.publicUrl + "?t=" + Date.now();
    await updateSetting("school_logo_url", publicUrl);
    setLogoUrl(publicUrl);
    setUploading(false);
    toast.success("Логото е обновено!");
    logAuditAction("Промяна на лого на училище", "settings");
  };

  const handleRemoveLogo = async () => {
    setUploading(true);
    await supabase.storage.from("school-assets").remove(["logo"]);
    await updateSetting("school_logo_url", "");
    setLogoUrl(null);
    setUploading(false);
    toast.success("Логото е премахнато.");
    logAuditAction("Премахване на лого на училище", "settings");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">Системни настройки</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Основни настройки</CardTitle>
          </div>
          <CardDescription>Променете името на училището и подзаглавието, които се показват в навигацията.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schoolName">Име на училище</Label>
              <Input
                id="schoolName"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Въведете името на училището"
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">Подзаглавие</Label>
              <Input
                id="subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Напр. Система за заявки"
                maxLength={100}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Запази
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <School className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Лого на училището</CardTitle>
          </div>
          <CardDescription>Логото се показва на логин страницата. Препоръчителен размер: 128×128px, макс. 2MB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Лого" className="h-full w-full object-cover" />
              ) : (
                <School className="h-10 w-10 text-primary-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Качи лого
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={handleRemoveLogo} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Премахни
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}