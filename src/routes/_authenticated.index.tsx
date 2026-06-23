import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles, welcomeFor } from "@/hooks/useRoles";
import { Users, GraduationCap, AlertTriangle, TrendingUp, Megaphone, ClipboardCheck, FileText, Printer, Sparkles, Calendar as CalendarIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { isAdmin, isTeacher, isPrintManager, roles } = useRoles();
  const today = new Date().toISOString().slice(0, 10);
  const role = roles[0] ?? null;

  const profile = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    enabled: isAdmin,
    queryFn: async () => {
      const [students, classes, absentToday, lowBehavior] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "absent"),
        supabase.from("students").select("id", { count: "exact", head: true }).lt("behavior_points", 70),
      ]);
      return {
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        absentToday: absentToday.count ?? 0,
        lowBehavior: lowBehavior.count ?? 0,
      };
    },
  });

  const circulars = useQuery({
    queryKey: ["latest-circulars-home"],
    queryFn: async () => {
      const { data, error } = await supabase.from("circulars").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(3);
      if (error) throw error;
      return data;
    },
  });

  const myPending = useQuery({
    queryKey: ["my-pending", user?.id],
    enabled: !!user && (isTeacher || isAdmin),
    queryFn: async () => {
      const [leaves, prints] = await Promise.all([
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", user!.id).eq("status", "pending"),
        supabase.from("print_requests").select("id", { count: "exact", head: true }).eq("employee_id", user!.id).in("status", ["pending", "pending_principal"]),
      ]);
      return { leaves: leaves.count ?? 0, prints: prints.count ?? 0 };
    },
  });

  const upcoming = useQuery({
    queryKey: ["upcoming-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("resource_bookings")
        .select("id, resource, booking_date, period, employee_id")
        .gte("booking_date", today).order("booking_date").limit(5);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="glass-strong rounded-2xl p-6">
        <h2 className="text-3xl font-bold">{welcomeFor(role, profile.data?.full_name)} 👋</h2>
        <p className="text-muted-foreground mt-2 text-sm">{new Date().toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {/* Admin stats */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={GraduationCap} label="إجمالي الطلاب" value={stats.data?.students ?? 0} tone="primary" />
          <StatCard icon={Users} label="عدد الصفوف" value={stats.data?.classes ?? 0} tone="accent" />
          <StatCard icon={AlertTriangle} label="غياب اليوم" value={stats.data?.absentToday ?? 0} tone="warning" />
          <StatCard icon={TrendingUp} label="سلوك منخفض" value={stats.data?.lowBehavior ?? 0} tone="destructive" />
        </div>
      )}

      {/* Latest announcements */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Megaphone className="h-5 w-5 text-accent" /> آخر التعاميم</h3>
          <Link to="/circulars" className="text-sm text-primary hover:underline">الكل ←</Link>
        </div>
        {circulars.data?.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد تعاميم.</p>}
        <div className="space-y-3">
          {circulars.data?.map((c) => (
            <div key={c.id} className="border-r-2 border-accent/40 pr-3">
              <div className="font-semibold">{c.title}</div>
              {c.body && <p className="text-sm text-muted-foreground line-clamp-2">{c.body}</p>}
              <div className="text-xs text-muted-foreground mt-1">{new Date(c.created_at).toLocaleDateString("ar")}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions per role */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isTeacher && <QuickAction to="/attendance" icon={ClipboardCheck} label="تسجيل الحضور" tone="primary" />}
        {isTeacher && <QuickAction to="/lesson-planner" icon={Sparkles} label="مخطط دروس AI" tone="accent" />}
        {(isTeacher || isAdmin) && <QuickAction to="/leaves" icon={FileText} label="طلب إجازة" tone="warning" />}
        {(isTeacher || isAdmin) && <QuickAction to="/print" icon={Printer} label="طلب طباعة" tone="primary" />}
        {isPrintManager && <QuickAction to="/print" icon={Printer} label="قائمة الطباعة" tone="primary" />}
        {isAdmin && <QuickAction to="/students" icon={GraduationCap} label="إدارة الطلاب" tone="accent" />}
        {isAdmin && <QuickAction to="/circulars" icon={Megaphone} label="نشر تعميم" tone="warning" />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* My pending */}
        {(isTeacher || isAdmin) && (
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold mb-3">طلباتي المعلّقة</h3>
            <div className="space-y-2 text-sm">
              <Row label="إجازات قيد المراجعة" value={myPending.data?.leaves ?? 0} />
              <Row label="مطبوعات معلقة" value={myPending.data?.prints ?? 0} />
            </div>
          </div>
        )}

        {/* Upcoming bookings */}
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-primary" /> الحجوزات القادمة</h3>
          {upcoming.data?.length === 0 && <p className="text-sm text-muted-foreground">لا توجد حجوزات قادمة.</p>}
          <div className="space-y-2 text-sm">
            {upcoming.data?.map((b) => (
              <div key={b.id} className="flex justify-between glass rounded-lg px-3 py-2">
                <span>{b.resource}</span>
                <span className="text-muted-foreground text-xs">{b.booking_date} · {b.period}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/30">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, tone }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; tone: "primary" | "accent" | "warning" }) {
  const toneClass = { primary: "text-primary", accent: "text-accent", warning: "text-warning" }[tone];
  return (
    <Link to={to} className="glass rounded-xl p-4 hover:bg-white/5 transition flex flex-col items-center gap-2 text-center">
      <Icon className={`h-6 w-6 ${toneClass}`} />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: "primary" | "accent" | "warning" | "destructive" }) {
  const toneClass = { primary: "text-primary", accent: "text-accent", warning: "text-warning", destructive: "text-destructive" }[tone];
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-5 w-5 ${toneClass}`} />
      </div>
      <div className="text-3xl font-extrabold">{value}</div>
    </div>
  );
}
