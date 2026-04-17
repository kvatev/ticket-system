import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "notification-prompt-dismissed";

export default function NotificationPermissionPrompt() {
  const { user, profile, updateProfile } = useAuth();
  const { isSupported, isSubscribed, permission, subscribe, loading } = usePushNotifications();
  const { toast } = useToast();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user || !profile || !isSupported) return;
    if (loading) return;
    // Already subscribed and enabled → don't show
    if (isSubscribed && profile.push_enabled) return;
    // Permission already denied → don't nag (user must enable in browser settings)
    if (permission === "denied") return;
    // Previously dismissed in this browser → respect user's choice for 7 days
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }
    // Show prompt after a short delay so the page can settle
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, [user, profile, isSupported, isSubscribed, permission, loading]);

  if (!show) return null;

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      await updateProfile({ push_enabled: true });
      toast({ title: "Push известията са включени 🔔" });
      setShow(false);
    } else if (permission === "denied") {
      toast({
        title: "Достъпът е блокиран",
        description: "Моля, разрешете известията в настройките на браузъра.",
        variant: "destructive",
      });
      setShow(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShow(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-border bg-card p-4 shadow-2xl animate-in slide-in-from-bottom-4 fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Включете нотификациите
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Получавайте известия за нови заявки, съобщения и промени дори когато браузърът е затворен.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleEnable} disabled={loading}>
              Разреши
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              По-късно
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Затвори"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
