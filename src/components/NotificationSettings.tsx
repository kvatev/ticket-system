import { Volume2, VolumeX, Bell, BellOff, Settings2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

export default function NotificationSettings() {
  const { profile, updateProfile } = useAuth();
  const { isSubscribed, isSupported, loading, permission, subscribe, unsubscribe } =
    usePushNotifications();
  const { toast } = useToast();

  if (!profile) return null;

  const handleSoundToggle = async (checked: boolean) => {
    await updateProfile({ sound_enabled: checked });
    toast({ title: checked ? "Звукът е включен" : "Звукът е изключен" });
  };

  const handlePushToggle = async (checked: boolean) => {
    if (checked) {
      const success = await subscribe();
      if (success) {
        await updateProfile({ push_enabled: true });
        toast({ title: "Push известията са включени" });
      } else if (permission === "denied") {
        toast({
          title: "Достъпът е блокиран",
          description: "Моля, разрешете известията в настройките на браузъра.",
          variant: "destructive",
        });
      }
    } else {
      const success = await unsubscribe();
      if (success) {
        await updateProfile({ push_enabled: false });
        toast({ title: "Push известията са изключени" });
      }
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 p-3 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Известия
        </p>

        <label className="flex items-center justify-between gap-2 cursor-pointer">
          <span className="flex items-center gap-2 text-xs">
            {profile.sound_enabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            Звукови известия
          </span>
          <Switch checked={profile.sound_enabled} onCheckedChange={handleSoundToggle} className="scale-75" />
        </label>

        {isSupported && (
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="flex items-center gap-2 text-xs">
              {isSubscribed && profile.push_enabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              Push нотификации
            </span>
            <Switch
              checked={isSubscribed && profile.push_enabled}
              onCheckedChange={handlePushToggle}
              disabled={loading}
              className="scale-75"
            />
          </label>
        )}
      </PopoverContent>
    </Popover>
  );
}
