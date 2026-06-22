import { type ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles, type AppRole } from "@/hooks/useRoles";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Users, GraduationCap, ClipboardCheck, Calendar, Building2,
  Printer, FileText, BarChart3, Settings, UserCog, LogOut, Menu, Brain, Megaphone, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRealtimeBadges } from "@/hooks/useRealtimeBadges";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: "leaves" | "prints" | "bookings" };

const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  master: [
    { to: "/", label: "لوحة التحكم", icon: LayoutDashboard },
    { to: "/students", label: "الطلاب والصفوف", icon: GraduationCap },
    { to: "/attendance", label: "الحضور والتقييم", icon: ClipboardCheck },
    { to: "/timetables", label: "الجداول", icon: Calendar },
    { to: "/facilities", label: "حجز المرافق", icon: Building2 },
    { to: "/leaves", label: "الإجازات", icon: FileText, badge: "leaves" },
    { to: "/print", label: "المطبوعات", icon: Printer, badge: "prints" },
    { to: "/predictor", label: "المتنبئ السلوكي", icon: Brain },
    { to: "/circulars", label: "التعاميم", icon: Megaphone },
    { to: "/reports", label: "التقارير", icon: BarChart3 },
    { to: "/settings", label: "الإعدادات", icon: Settings },
    { to: "/users", label: "حسابات المستخدمين", icon: UserCog },
  ],
  principal: [
    { to: "/", label: "لوحة التحكم", icon: LayoutDashboard },
    { to: "/attendance", label: "الحضور", icon: ClipboardCheck },
    { to: "/leaves", label: "اعتماد الإجازات", icon: FileText, badge: "leaves" },
    { to: "/facilities", label: "اعتماد الحجوزات", icon: Building2, badge: "bookings" },
    { to: "/predictor", label: "المتنبئ السلوكي", icon: Brain },
    { to: "/print", label: "اعتماد المطبوعات", icon: Printer, badge: "prints" },
    { to: "/reports", label: "التقارير", icon: BarChart3 },
    { to: "/circulars", label: "التعاميم", icon: Megaphone },
    { to: "/timetables", label: "الجداول", icon: Calendar },
    { to: "/students", label: "الطلاب", icon: GraduationCap },
  ],
  teacher: [
    { to: "/attendance", label: "الحضور والتقييم", icon: ClipboardCheck },
    { to: "/students", label: "الطلاب", icon: GraduationCap },
    { to: "/timetables", label: "جدولي", icon: Calendar },
    { to: "/facilities", label: "حجز المرافق", icon: Building2 },
    { to: "/print", label: "طلب طباعة", icon: Printer },
    { to: "/leaves", label: "طلب إجازة", icon: FileText },
  ],
  print_manager: [
    { to: "/print", label: "قائمة الطباعة", icon: Printer, badge: "prints" },
  ],
};

function useBadgeCounts(enabled: boolean) {
  return useQuery({
    queryKey: ["badge-counts"],
    enabled,
    refetchInterval: 30000,
    queryFn: async () => {
      const [leaves, prints, bookings] = await Promise.all([
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending").eq("unseen_admin", true),
        supabase.from("print_requests").select("id", { count: "exact", head: true }).eq("status", "pending").eq("unseen_admin", true),
        supabase.from("resource_bookings").select("id", { count: "exact", head: true }).eq("status", "pending").eq("unseen_admin", true),
      ]);
      return { leaves: leaves.count ?? 0, prints: prints.count ?? 0, bookings: bookings.count ?? 0 };
    },
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { roles, isAdmin, loading: rolesLoading } = useRoles();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const role: AppRole | null = roles[0] ?? null;
  const navItems = role ? NAV_BY_ROLE[role] : [];
  const badges = useBadgeCounts(isAdmin);
  useRealtimeBadges(isAdmin);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (rolesLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-strong rounded-2xl p-8 max-w-md text-center space-y-4">
          <h2 className="text-2xl font-bold">حسابك بانتظار التفعيل</h2>
          <p className="text-muted-foreground">
            تم إنشاء حسابك بنجاح. يجب على الماستر تعيين دورك (معلم / مدير / مسؤول طباعة) قبل أن تتمكن من استخدام النظام.
          </p>
          <p className="text-xs text-muted-foreground">
            {user?.email}
          </p>
          <Button onClick={signOut} variant="outline" className="w-full">تسجيل الخروج</Button>
        </div>
      </div>
    );
  }

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border/50">
        <h1 className="text-3xl font-extrabold text-gradient">انضباط</h1>
        <p className="text-xs text-muted-foreground mt-1">نظام إدارة المدرسة الذكي</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
          const count = item.badge && badges.data ? badges.data[item.badge] : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "gradient-primary text-primary-foreground glow"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && count > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning text-warning-foreground animate-pulse">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border/50 space-y-2">
        <div className="text-xs">
          <div className="font-semibold truncate">{user?.email}</div>
          <div className="text-muted-foreground">{roleLabel(role)}</div>
        </div>
        <Button onClick={signOut} variant="outline" size="sm" className="w-full gap-2">
          <LogOut className="h-3.5 w-3.5" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-72 glass-strong border-l border-border/50 flex-col fixed top-0 bottom-0 right-0">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-72 glass-strong h-full mr-auto">
            <button className="absolute top-4 left-4 p-2" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      <main className="flex-1 lg:mr-72 min-w-0">
        <header className="lg:hidden glass border-b border-border/50 p-3 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setOpen(true)} className="p-2"><Menu className="h-5 w-5" /></button>
          <h1 className="text-xl font-bold text-gradient">انضباط</h1>
          <div className="w-9" />
        </header>
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function roleLabel(r: AppRole): string {
  return { master: "الماستر", principal: "مدير المدرسة", teacher: "معلم", print_manager: "مسؤول الطباعة" }[r];
}
