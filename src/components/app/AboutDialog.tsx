import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, Mail } from "lucide-react";
import logo from "@/assets/edupulse-logo.png.asset.json";

export function AboutDialog({ variant = "ghost", size = "sm", className }: { variant?: "ghost" | "outline" | "default"; size?: "sm" | "default"; className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={`gap-1 ${className ?? ""}`}>
          <Info className="h-4 w-4" /> عن النظام
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            <img src={logo.url} alt="EduPulse | نبض" className="mx-auto h-24 object-contain mb-2" />
            <span className="text-gradient text-2xl">EduPulse | نبض</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed text-foreground/90 text-right">
          <p>يُعد <strong>EduPulse | نبض</strong> منصة رقمية تعليمية متكاملة تم تصميمها وبرمجتها بهدف دعم التحول الرقمي وتطوير بيئات العمل المؤسسية، من خلال توظيف أحدث التقنيات والذكاء الاصطناعي في إدارة العمليات التعليمية والخدمات المدرسية بكفاءة وفعالية.</p>
          <p>ويجسد اسم <strong>EduPulse | نبض</strong> مفهوم المتابعة الذكية لحيوية المدرسة، حيث تعمل المنصة كـ"نبض رقمي" يرصد مختلف مؤشرات الأداء والعمليات اليومية، ويحوّل البيانات إلى رؤى وتحليلات تساعد الإدارات التعليمية والمعلمين على اتخاذ قرارات أكثر دقة، وتعزيز جودة الأداء والتطوير المستمر.</p>
          <p>ويأتي هذا المشروع استلهاماً من الرؤية السامية لحضرة صاحب الجلالة الملك حمد بن عيسى آل خليفة، ملك مملكة البحرين المعظم، حفظه الله ورعاه، وما تحظى به مسيرة التعليم والتحول الرقمي من دعم واهتمام مستمرين، وبما ينسجم مع مشروع جلالته الرائد لمدارس المستقبل، وتوجيهات سعادة الدكتور محمد بن مبارك جمعة، وزير التربية والتعليم، الرامية إلى تعزيز الابتكار وتبني الحلول الرقمية الحديثة في القطاع التعليمي.</p>
          <p>ويمثل <strong>EduPulse | نبض</strong> مبادرة تقنية متكاملة تم تطويرها بالكامل من قبل <strong>علي يوسف علي</strong>، مدرس بوزارة التربية والتعليم، ومهتم بالذكاء الاصطناعي والتحول الرقمي وتطوير الحلول التقنية المبتكرة، إيماناً بأهمية توظيف التقنيات الحديثة في الارتقاء بالأداء المؤسسي وبناء حلول ذكية تواكب متطلبات المستقبل.</p>
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">للاستفسارات المتعلقة بالنظام:</div>
              <a href="mailto:ali.y.hassan@moe.bh" className="text-primary hover:underline" dir="ltr">ali.y.hassan@moe.bh</a>
            </div>
          </div>
          <p className="text-center italic text-accent font-semibold pt-2">
            "من فكرة تعليمية إلى نبض رقمي متكامل… نحو مستقبل تعليمي أكثر ذكاءً وكفاءة"
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
