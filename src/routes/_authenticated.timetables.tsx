import { createFileRoute } from "@tanstack/react-router";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/timetables")({
  component: () => (
    <div className="space-y-4">
      <h2 className="text-3xl font-bold flex items-center gap-2"><Calendar className="h-7 w-7 text-primary" /> الجداول الدراسية</h2>
      <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
        قريباً — رفع جداول الفصول والمعلمين على شكل ملفات أو شبكات تفاعلية.
      </div>
    </div>
  ),
});
