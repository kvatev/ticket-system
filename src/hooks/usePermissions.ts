import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function usePermissions() {
  const { user, role } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      // Get user's custom_role_id
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("custom_role_id")
        .eq("user_id", user.id)
        .single();

      if (!userRole?.custom_role_id) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      // Get permissions for the role
      const { data: rolePerms } = await supabase
        .from("role_permissions")
        .select("permission_id, permissions(key)")
        .eq("role_id", userRole.custom_role_id);

      if (rolePerms) {
        const keys = rolePerms
          .map((rp: any) => rp.permissions?.key)
          .filter(Boolean);
        setPermissions(keys);
      }
      setLoading(false);
    };

    fetchPermissions();
  }, [user]);

  const hasPermission = (key: string) => {
    // Admin always has all permissions
    if (role === "admin") return true;
    return permissions.includes(key);
  };

  return { permissions, hasPermission, loading };
}
