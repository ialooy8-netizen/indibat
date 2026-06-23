import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "master" | "principal" | "vice_principal" | "teacher" | "print_manager";

const DEMO_KEY = "indibat.demo-role";

function readDemo(): AppRole | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(DEMO_KEY);
  return v ? (v as AppRole) : null;
}

export function setDemoRole(role: AppRole | null) {
  if (typeof window === "undefined") return;
  if (role) window.localStorage.setItem(DEMO_KEY, role);
  else window.localStorage.removeItem(DEMO_KEY);
  window.dispatchEvent(new Event("indibat-demo-changed"));
}

export function useRoles() {
  const { user, loading: authLoading } = useAuth();
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
  const realRoles = query.data ?? [];

  const [demo, setDemo] = useState<AppRole | null>(readDemo());
  useEffect(() => {
    const h = () => setDemo(readDemo());
    window.addEventListener("indibat-demo-changed", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("indibat-demo-changed", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const isReallyMaster = realRoles.includes("master");
  const effective: AppRole[] = isReallyMaster && demo ? [demo] : realRoles;

  return {
    roles: effective,
    realRoles,
    demoRole: isReallyMaster ? demo : null,
    isReallyMaster,
    loading: authLoading || (!!user && query.isPending),
    isMaster: effective.includes("master"),
    isPrincipal: effective.includes("principal"),
    isVicePrincipal: effective.includes("vice_principal"),
    isTeacher: effective.includes("teacher"),
    isPrintManager: effective.includes("print_manager"),
    isAdmin: effective.includes("master") || effective.includes("principal") || effective.includes("vice_principal"),
    hasAnyRole: effective.length > 0,
  };
}

export const ROLE_LABELS: Record<AppRole, string> = {
  master: "الماستر",
  principal: "مدير المدرسة",
  vice_principal: "مساعد المدير",
  teacher: "معلم",
  print_manager: "مسؤول الطباعة",
};

export function welcomeFor(role: AppRole | null, name?: string | null): string {
  const display = name?.trim() || "";
  switch (role) {
    case "master": return `أهلاً بك يا قائد النظام${display ? "، " + display : ""}`;
    case "principal": return `مرحباً سعادة المدير${display ? "، " + display : ""}`;
    case "vice_principal": return `مرحباً مساعد المدير${display ? "، " + display : ""}`;
    case "teacher": return `أهلاً بك أستاذ${display ? "/ة " + display : ""}`;
    case "print_manager": return `مرحباً بمسؤول الطباعة${display ? "، " + display : ""}`;
    default: return `أهلاً وسهلاً${display ? "، " + display : ""}`;
  }
}
