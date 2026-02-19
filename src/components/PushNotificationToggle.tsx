import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function PushNotificationToggle() {
  const { isSubscribed, isSupported, loading, permission, subscribe, unsubscribe } =
    usePushNotifications();
  const { toast } = useToast();

  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast({ title: "Известията са изключени" });
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast({ title: "Известията са включени", description: "Ще получавате push нотификации за нови заявки и промени." });
      } else if (permission === "denied") {
        toast({
          title: "Достъпът е блокиран",
          description: "Моля, разрешете известията в настройките на браузъра.",
          variant: "destructive",
        });
      }
    }
  };

  const Icon = isSubscribed ? BellRing : loading ? Bell : BellOff;
  const label = isSubscribed ? "Изключи известията" : "Включи известията";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          disabled={loading}
          className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
