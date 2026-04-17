import { Volume2, VolumeX, Bell, BellOff, Settings2, Moon, Play } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";
import { useSoundPreferences } from "@/hooks/useSoundPreferences";
import { SoundChoice } from "@/lib/notificationSounds";

const SOUND_LABELS: Record<SoundChoice, string> = {
  pop: "Pop",
  ding: "Ding",
  chime: "Chime",
  classic: "Класически",
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function NotificationSettings() {
  const { profile, updateProfile } = useAuth();
  const { isSubscribed, isSupported, loading, permission, subscribe, unsubscribe } =
    usePushNotifications();
  const { toast } = useToast();
  const { sound, setSound, dnd, setDnd, playPreview, isDndActive } = useSoundPreferences();

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

  const handleSoundChange = (value: SoundChoice) => {
    setSound(value);
    playPreview(value);
  };

  const dndActiveNow = isDndActive();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-3 space-y-3">
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

        {profile.sound_enabled && (
          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground">Звук на нотификация</label>
            <div className="flex gap-1.5">
              <Select value={sound} onValueChange={(v) => handleSoundChange(v as SoundChoice)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOUND_LABELS) as SoundChoice[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">{SOUND_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => playPreview()}
                aria-label="Тествай звука"
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

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

        <div className="border-t border-border pt-2 space-y-2">
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="flex items-center gap-2 text-xs">
              <Moon className="h-3.5 w-3.5" />
              Не безпокой
              {dndActiveNow && (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                  Активен
                </span>
              )}
            </span>
            <Switch
              checked={dnd.enabled}
              onCheckedChange={(checked) => setDnd({ ...dnd, enabled: checked })}
              className="scale-75"
            />
          </label>

          {dnd.enabled && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">От</label>
                <Select
                  value={String(dnd.startHour)}
                  onValueChange={(v) => setDnd({ ...dnd, startHour: parseInt(v, 10) })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)} className="text-xs">
                        {String(h).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">До</label>
                <Select
                  value={String(dnd.endHour)}
                  onValueChange={(v) => setDnd({ ...dnd, endHour: parseInt(v, 10) })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)} className="text-xs">
                        {String(h).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
