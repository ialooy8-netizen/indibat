import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function LiveClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("ar-BH", { hour: "2-digit", minute: "2-digit", second: compact ? undefined : "2-digit", hour12: true });
  const date = now.toLocaleDateString("ar-BH", { weekday: "short", day: "numeric", month: "short" });
  return (
    <div className="flex items-center gap-2 text-xs">
      <Clock className="h-3.5 w-3.5 text-primary" />
      <span className="tabular-nums font-semibold">{time}</span>
      {!compact && <span className="text-muted-foreground hidden sm:inline">· {date}</span>}
    </div>
  );
}
