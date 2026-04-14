
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Camera, Loader2 } from "lucide-react";
import PasswordStrengthIndicator, { validatePasswordRequirements } from "@/components/PasswordStrengthIndicator";
import { useSearchParams } from "react-router-dom";

export default function ProfilePage() {
  const { profile, user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const mustChangePassword = searchParams.get("change_password") === "true";

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [nameLoading, setNameLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile?.full_name]);

  useEffect(() => {
    if (mustChangePassword) {
      toast({
        title: "Смяна на парола",
        description: "Моля, задайте нова парола за вашия акаунт.",
        variant: "destructive",
      });
    }
  }, [mustChangePassword]);

  const getAvatarUrl = () => {
    if (!profile?.avatar_url) return null;
    const { data } = supabase.storage.from("avatars").getPublicUrl(profile.avatar_url);
    return data.publicUrl;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Грешка", description: "Моля, изберете изображение.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Грешка", description: "Файлът трябва да е до 2MB.", variant: "destructive" });
      return;
    }

    setAvatarLoading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;

    if (profile?.avatar_url) {
      await supabase.storage.from("avatars").remove([profile.avatar_url]);
    }

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Грешка", description: "Неуспешно качване на снимката.", variant: "destructive" });
    } else {
      await updateProfile({ avatar_url: filePath });
      toast({ title: "Успешно", description: "Профилната снимка е обновена." });
    }
    setAvatarLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !fullName.trim()) return;
    setNameLoading(true);
    try {
      await updateProfile({ full_name: fullName.trim() });
      toast({ title: "Успешно", description: "Името е обновено." });
    } catch {
      toast({ title: "Грешка", description: "Неуспешна промяна на името.", variant: "destructive" });
    }
    setNameLoading(false);
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validatePasswordRequirements(newPassword);
    if (errors.length > 0) {
      toast({ title: "Грешка", description: errors.join(", "), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Грешка", description: "Паролите не съвпадат.", variant: "destructive" });
      return;
    }

    setPassLoading(true);

    // If came from PIN login, skip current password verification
    if (!mustChangePassword) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email ?? "",
        password: currentPassword,
      });
      if (signInError) {
        setPassLoading(false);
        toast({ title: "Грешка", description: "Текущата парола е грешна.", variant: "destructive" });
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPassLoading(false);
    if (error) {
      toast({ title: "Грешка", description: "Неуспешна промяна на паролата.", variant: "destructive" });
    } else {
      toast({ title: "Успешно", description: "Паролата е обновена." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // Remove the query param
      if (mustChangePassword) {
        window.history.replaceState({}, "", "/profile");
      }
    }
  };

  const avatarUrl = getAvatarUrl();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Профил</h1>

      {mustChangePassword && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          ⚠️ Влязохте с ПИН код. Моля, задайте нова парола преди да продължите.
        </div>
      )}

      {/* Avatar */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Профилна снимка</CardTitle>
          </div>
          <CardDescription>Качете снимка до 2MB (JPG, PNG, WebP).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-2xl font-bold text-primary ring-2 ring-border">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Аватар" className="h-full w-full object-cover" />
                ) : (
                  profile?.full_name?.charAt(0) ?? "?"
                )}
              </div>
              {avatarLoading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
              >
                <Camera className="mr-2 h-4 w-4" />
                {avatarUrl ? "Смени снимката" : "Качи снимка"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal data */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Лични данни</CardTitle>
          </div>
          <CardDescription>Променете показваното име в системата.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNameUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Имейл</Label>
              <Input id="email" value={profile?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Име</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
            <Button type="submit" disabled={nameLoading}>
              {nameLoading ? "Запазване..." : "Запази"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card className={mustChangePassword ? "ring-2 ring-destructive" : ""}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">
              {mustChangePassword ? "Задайте нова парола" : "Смяна на парола"}
            </CardTitle>
          </div>
          <CardDescription>
            {mustChangePassword
              ? "Задължително е да зададете нова парола."
              : "Въведете текущата и новата парола."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            {!mustChangePassword && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Текуща парола</Label>
                <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPassword">Нова парола</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required />
              <PasswordStrengthIndicator password={newPassword} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Потвърдете новата парола</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Паролите не съвпадат</p>
              )}
            </div>
            <Button type="submit" disabled={passLoading}>
              {passLoading ? "Промяна..." : "Промени парола"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
