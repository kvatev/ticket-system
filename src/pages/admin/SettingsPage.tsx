import { useState, useEffect } from "react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { settings, loading, updateSetting } = useSystemSettings();
  const [schoolName, setSchoolName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSchoolName(settings.school_name);
    setSubtitle(settings.school_subtitle);
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
    }
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
    </div>
  );
}
