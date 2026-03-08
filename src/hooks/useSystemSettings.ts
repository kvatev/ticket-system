import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SystemSettings {
  school_name: string;
  school_subtitle: string;
  [key: string]: string;
}

const defaults: SystemSettings = {
  school_name: 'СУ \u201EК. Петканов\u201C',
  school_subtitle: "Система за заявки",
};

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(defaults);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const { data } = await supabase.from("system_settings").select("key, value");
    if (data) {
      const map = { ...defaults };
      data.forEach((row: any) => {
        map[row.key] = row.value;
      });
      setSettings(map as SystemSettings);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (!error) {
      setSettings((prev) => ({ ...prev, [key]: value }));
    }
    return { error };
  };

  return { settings, loading, updateSetting, refetch: fetchSettings };
}
