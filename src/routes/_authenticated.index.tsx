import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles, welcomeFor } from "@/hooks/useRoles";
import { useBranding } from "@/hooks/useBranding";
import { AboutDialog } from "@/components/app/AboutDialog";
import { Users, GraduationCap, AlertTriangle, TrendingUp, Megaphone, ClipboardCheck, FileText, Printer, Sparkles, Calendar as CalendarIcon } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis, BarChart, Bar, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { isAdmin, isTeacher, isPrintManager, roles } = useRoles();
  const { homeLogoUrl } = useBranding();
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

  // 14-day attendance trend (admin)
  const trend = useQuery({
    queryKey: ["dashboard-trend"],
    enabled: isAdmin,
    queryFn: async () => {
      const from = new Date(); from.setDate(from.getDate() - 13);
      const fromIso = from.toISOString().slice(0, 10);
      const { data, error } = await supabase.from("attendance").select("date, status").gte("date", fromIso);
      if (error) throw error;
      const days = new Map<string, { date: string; present: number; absent: number; late: number }>();
      for (let i = 0; i < 14; i++) {
        const d = new Date(from); d.setDate(from.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        days.set(key, { date: key.slice(5), present: 0, absent: 0, late: 0 });
      }
      for (const r of data ?? []) {
        const k = days.get(r.date);
        if (!k) continue;
        if (r.status === "absent") k.absent++;
        else if (r.status === "late") k.late++;
        else k.present++;
      }
      return Array.from(days.values());
    },
  });

  // Behavior distribution (admin)
  const behavior = useQuery({
    queryKey: ["dashboard-behavior"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("behavior_points");
      if (error) throw error;
      const buckets = { excellent: 0, good: 0, warning: 0, risk: 0 };
      for (const s of data ?? []) {
        const p = s.behavior_points ?? 0;
        if (p >= 90) buckets.excellent++;
        else if (p >= 70) buckets.good++;
        else if (p >= 50) buckets.warning++;
        else buckets.risk++;
      }
      const total = (data?.length ?? 0) || 1;
      return [
        { name: "ممتاز (90+)", value: buckets.excellent, pct: Math.round((buckets.excellent / total) * 100), fill: "var(--success)" },
        { name: "جيد (70-89)", value: buckets.good, pct: Math.round((buckets.good / total) * 100), fill: "var(--primary)" },
        { name: "إنذار (50-69)", value: buckets.warning, pct: Math.round((buckets.warning / total) * 100), fill: "var(--warning)" },
        { name: "خطر (<50)", value: buckets.risk, pct: Math.round((buckets.risk / total) * 100), fill: "var(--destructive)" },
      ];
    },
  });

  // Class comparison (admin) — absences last 30 days
  const byClass = useQuery({
    queryKey: ["dashboard-by-class"],
    enabled: isAdmin,
    queryFn: async () => {
      const from = new Date(); from.setDate(from.getDate() - 30);
      const { data, error } = await supabase
        .from("attendance")
        .select("status, students(classes(name))")
        .gte("date", from.toISOString().slice(0, 10));
      if (error) throw error;
      const map = new Map<string, { name: string; absent: number; late: number }>();
      for (const r of (data ?? []) as Array<{ status: string; students: { classes: { name: string } | null } | null }>) {
        const cls = r.students?.classes?.name ?? "بدون صف";
        const cur = map.get(cls) ?? { name: cls, absent: 0, late: 0 };
        if (r.status === "absent") cur.absent++;
        else if (r.status === "late") cur.late++;
        map.set(cls, cur);
      }
      return Array.from(map.values()).sort((a, b) => b.absent - a.absent).slice(0, 6);
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

  const attendanceRate = (() => {
    const t = trend.data;
    if (!t?.length) return 0;
    const tot = t.reduce((a, b) => a + b.present + b.absent + b.late, 0);
    if (!tot) return 100;
    return Math.round(((tot - t.reduce((a, b) => a + b.absent, 0)) / tot) * 100);
  })();

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="glass-strong rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle at 20% 0%, var(--primary) 0%, transparent 50%), radial-gradient(circle at 80% 100%, var(--accent) 0%, transparent 50%)" }} />
        <div className="relative flex flex-wrap items-center gap-6">
          <img src={homeLogoUrl} alt="EduPulse | نبض" className="h-24 md:h-28 object-contain shrink-0" />
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-2xl md:text-3xl font-bold">{welcomeFor(role, profile.data?.full_name)} 👋</h2>
            <p className="text-muted-foreground mt-1 text-sm">{new Date().toLocaleDateString("ar-BH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            <p className="text-xs text-accent mt-1 font-semibold">EduPulse | نبض — الذكاء الذي يرصد نبض المدرسة</p>
          </div>
          <AboutDialog variant="outline" />
        </div>
      </div>

      {/* Admin stats + charts */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={GraduationCap} label="إجمالي الطلاب" value={stats.data?.students ?? 0} tone="primary" />
            <StatCard icon={Users} label="عدد الصفوف" value={stats.data?.classes ?? 0} tone="accent" />
            <StatCard icon={AlertTriangle} label="غياب اليوم" value={stats.data?.absentToday ?? 0} tone="warning" />
            <StatCard icon={TrendingUp} label="سلوك منخفض" value={stats.data?.lowBehavior ?? 0} tone="destructive" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Attendance trend */}
            <div className="lg:col-span-2 glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> اتجاه الحضور — آخر 14 يوم</h3>
                <span className="text-xs text-muted-foreground">نسبة الحضور: <span className="text-primary font-bold tabular-nums">{attendanceRate}%</span></span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend.data ?? []}>
                    <defs>
                      <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gAbsent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="present" name="حاضر" stroke="var(--primary)" fill="url(#gPresent)" strokeWidth={2} />
                    <Area type="monotone" dataKey="absent" name="غائب" stroke="var(--destructive)" fill="url(#gAbsent)" strokeWidth={2} />
                    <Area type="monotone" dataKey="late" name="متأخر" stroke="var(--warning)" fillOpacity={0} strokeWidth={2} strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Behavior radial */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> توزيع نقاط السلوك</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="25%" outerRadius="95%" data={behavior.data ?? []} startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="pct" background cornerRadius={6} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v, _n, p) => { const pl = (p as { payload?: { name?: string; value?: number } }).payload; return [`${pl?.value ?? 0} طالب (${v}%)`, pl?.name ?? ""]; }} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1 mt-2">
                {behavior.data?.map((b) => (
                  <div key={b.name} className="flex items-center gap-1 text-[10px]">
                    <span className="h-2 w-2 rounded-full" style={{ background: b.fill }} />
                    <span className="text-muted-foreground">{b.name}</span>
                    <span className="font-bold tabular-nums">{b.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* By-class comparison */}
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><BarChartIcon /> مقارنة الصفوف — الغياب والتأخر (آخر 30 يوم)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byClass.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="absent" name="غياب" fill="var(--destructive)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="late" name="تأخر" fill="var(--warning)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
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
              <div className="text-xs text-muted-foreground mt-1">{new Date(c.created_at).toLocaleDateString("ar-BH")}</div>
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
        {(isTeacher || isAdmin) && (
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold mb-3">طلباتي المعلّقة</h3>
            <div className="space-y-2 text-sm">
              <Row label="إجازات قيد المراجعة" value={myPending.data?.leaves ?? 0} />
              <Row label="مطبوعات معلقة" value={myPending.data?.prints ?? 0} />
            </div>
          </div>
        )}

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

function BarChartIcon() {
  return <TrendingUp className="h-4 w-4 text-primary" />;
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
    <div className="glass rounded-2xl p-4 relative overflow-hidden group">
      <div className="absolute -top-6 -left-6 w-20 h-20 rounded-full opacity-10 blur-xl group-hover:opacity-20 transition" style={{ background: `currentColor` }} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-5 w-5 ${toneClass}`} />
      </div>
      <div className="text-3xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}
