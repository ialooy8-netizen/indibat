import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Users, GraduationCap, AlertTriangle, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { isAdmin } = useRoles();

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">مرحباً 👋</h2>
        <p className="text-muted-foreground mt-1">{user?.email}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={GraduationCap} label="إجمالي الطلاب" value={stats.data?.students ?? 0} tone="primary" />
        <StatCard icon={Users} label="عدد الصفوف" value={stats.data?.classes ?? 0} tone="accent" />
        <StatCard icon={AlertTriangle} label="غياب اليوم" value={stats.data?.absentToday ?? 0} tone="warning" />
        <StatCard icon={TrendingUp} label="سلوك منخفض" value={stats.data?.lowBehavior ?? 0} tone="destructive" />
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-2">ابدأ من هنا</h3>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "أضف الصفوف والطلاب من قسم « الطلاب والصفوف »، ثم سيتمكن المعلمون من تسجيل الحضور والتقييم مباشرة."
            : "افتح « الحضور والتقييم » لتسجيل حضور طلاب صفك بسرعة، وأضف نقاط المكافأة أو ملاحظات السلوك."}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number;
  tone: "primary" | "accent" | "warning" | "destructive";
}) {
  const toneClass = {
    primary: "text-primary",
    accent: "text-accent",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
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
