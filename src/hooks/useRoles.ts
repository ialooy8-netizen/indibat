import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "master" | "principal" | "teacher" | "print_manager";

export function useRoles() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
  const roles = query.data ?? [];
  return {
    roles,
    loading: query.isLoading,
    isMaster: roles.includes("master"),
    isPrincipal: roles.includes("principal"),
    isTeacher: roles.includes("teacher"),
    isPrintManager: roles.includes("print_manager"),
    isAdmin: roles.includes("master") || roles.includes("principal"),
    hasAnyRole: roles.length > 0,
  };
}
