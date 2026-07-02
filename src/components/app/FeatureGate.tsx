import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { AlertTriangle, Lock } from "lucide-react";

/** Wraps a route to enforce the feature_flags toggle. */
export function FeatureGate({ featureKey, children }: { featureKey: string; children: React.ReactNode }) {
  const { enabled, message, loading } = useFeatureFlag(featureKey);
  if (loading) return <div className="text-muted-foreground p-6">جاري التحميل...</div>;
  if (enabled) return <>{children}</>;
  return (
    <div className="glass-strong rounded-2xl p-8 max-w-lg mx-auto text-center space-y-3 mt-10">
      <div className="mx-auto h-14 w-14 rounded-full bg-warning/20 flex items-center justify-center">
        <Lock className="h-7 w-7 text-warning" />
      </div>
      <h2 className="text-xl font-bold">هذه الميزة معطّلة مؤقتاً</h2>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {message ?? "قام مسؤول النظام بإيقاف هذه الميزة حالياً."}
      </p>
      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 pt-2">
        <AlertTriangle className="h-3 w-3" /> للتفاصيل تواصل مع الماستر.
      </div>
    </div>
  );
}
