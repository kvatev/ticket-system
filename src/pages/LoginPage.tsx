
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, School, KeyRound, UserPlus, Hash } from "lucide-react";

type Mode = "login" | "register" | "forgot" | "pin";

export default function LoginPage() {
  const { signIn } = useAuth();
  const { settings } = useSystemSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("login");

  const validateEmail = (val: string) => {
    if (!val.endsWith("@edu.mon.bg")) {
      toast.error("Имейлът трябва да завършва с @edu.mon.bg");
      return false;
    }
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      const desc = error.message.includes("деактивиран") ? error.message : "Невалиден имейл или парола.";
      toast.error("Грешка при вход", { description: desc });
    }
    setLoading(false);
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pin) {
      toast.error("Моля, въведете имейл и ПИН код.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pin-login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ email, pin }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        toast.error("Грешка при вход с ПИН", { description: result.error });
      } else if (result.session) {
        // Set the session from the edge function response
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        toast.success("Вход успешен!", {
          description: "Моля, сменете паролата си веднага от профила.",
        });
        // Navigate to profile for password change
        window.location.href = "/profile?change_password=true";
      }
    } catch (err: any) {
      toast.error("Грешка при вход с ПИН", { description: err.message });
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) return;
    if (!fullName.trim()) {
      toast.error("Моля, въведете вашето име.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName.trim() },
      },
    });
    if (error) {
      toast.error("Грешка при регистрация", { description: error.message });
    } else {
      toast.success("Регистрацията е успешна!", {
        description: "Проверете имейла си за потвърждение.",
      });
      setMode("login");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Моля, въведете имейл адрес.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      toast.error("Грешка", { description: error.message });
    } else {
      toast.success("Изпратихме линк за нулиране на паролата на вашия имейл.");
      setMode("login");
    }
    setLoading(false);
  };

  const titles: Record<Mode, string> = {
    login: "Вход в системата",
    register: "Регистрация",
    forgot: "Забравена парола",
    pin: "Вход с ПИН код",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary overflow-hidden">
            {settings.school_logo_url ? (
              <img src={settings.school_logo_url} alt="Лого" className="h-full w-full object-cover" />
            ) : (
              <School className="h-8 w-8 text-primary-foreground" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {settings.school_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{settings.school_subtitle}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Само с <span className="font-semibold text-foreground">@edu.mon.bg</span> акаунт
          </p>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="pb-4 pt-6">
            <h2 className="text-center text-lg font-semibold text-foreground">
              {titles[mode]}
            </h2>
          </CardHeader>
          <CardContent>
            {mode === "forgot" && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">Имейл адрес</Label>
                  <Input id="forgotEmail" type="email" placeholder="krasimir.vatev@edu.mon.bg" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Изпрати линк
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("login")}>
                  Обратно към вход
                </Button>
              </form>
            )}

            {mode === "pin" && (
              <form onSubmit={handlePinLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pinEmail">Имейл адрес</Label>
                  <Input id="pinEmail" type="email" placeholder="krasimir.vatev@edu.mon.bg" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pinCode">ПИН код</Label>
                  <Input id="pinCode" placeholder="Въведете 6-цифрения ПИН" value={pin} onChange={(e) => setPin(e.target.value)} required maxLength={6} className="text-center text-lg tracking-widest" />
                  <p className="text-xs text-muted-foreground">ПИН кодът е предоставен от администратор</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Hash className="mr-2 h-4 w-4" />
                  Вход с ПИН
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("login")}>
                  Обратно към вход
                </Button>
              </form>
            )}

            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Пълно име *</Label>
                  <Input id="fullName" placeholder="Красимир Ватев" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regEmail">Имейл адрес *</Label>
                  <Input id="regEmail" type="email" placeholder="krasimir.vatev@edu.mon.bg" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">Задължително @edu.mon.bg</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regPassword">Парола *</Label>
                  <Input id="regPassword" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <UserPlus className="mr-2 h-4 w-4" />
                  Регистрация
                </Button>
                <Button type="button" variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => setMode("login")}>
                  Вече имате акаунт? Вход
                </Button>
              </form>
            )}

            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loginEmail">Имейл адрес</Label>
                  <Input id="loginEmail" type="email" placeholder="krasimir.vatev@edu.mon.bg" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loginPassword">Парола</Label>
                  <Input id="loginPassword" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <KeyRound className="mr-2 h-4 w-4" />
                  Вход
                </Button>
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => setMode("pin")}>
                    <Hash className="mr-2 h-4 w-4" />
                    Вход с ПИН код
                  </Button>
                  <Button type="button" variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => setMode("register")}>
                    Нямате акаунт? Регистрация
                  </Button>
                  <Button type="button" variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => setMode("forgot")}>
                    Забравена парола?
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Администратор: <strong>Красимир Ватев</strong>
          <br />
          За връзка: <a href="mailto:kvatev@outlook.com" className="font-medium text-primary hover:underline">kvatev@outlook.com</a>
        </p>
      </div>
    </div>
  );
}
