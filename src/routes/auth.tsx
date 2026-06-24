import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useBranding } from "@/hooks/useBranding";
import { AboutDialog } from "@/components/app/AboutDialog";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — EduPulse | نبض" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { homeLogoUrl } = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+973");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم تسجيل الدخول");
    navigate({ to: "/" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { full_name: fullName },
      },
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    if (data.user && phone) {
      await supabase.from("profiles").update({ phone }).eq("id", data.user.id);
    }
    setBusy(false);
    toast.success("تم إنشاء الحساب. سيقوم الماستر بتعيين دورك.");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={homeLogoUrl} alt="EduPulse | نبض" className="mx-auto h-32 object-contain mb-3" />
          <h1 className="text-4xl font-extrabold text-gradient mb-1">EduPulse | نبض</h1>
          <p className="text-muted-foreground text-sm">الذكاء الذي يرصد نبض المدرسة</p>
        </div>
        <div className="glass-strong rounded-2xl p-6 glow">
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="signin">دخول</TabsTrigger>
              <TabsTrigger value="signup">حساب جديد</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4">
                <div><Label>البريد الإلكتروني</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></div>
                <div><Label>كلمة المرور</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></div>
                <Button type="submit" disabled={busy} className="w-full gradient-primary text-primary-foreground font-semibold">
                  {busy ? "جاري الدخول..." : "تسجيل الدخول"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4">
                <div><Label>الاسم الكامل</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div><Label>البريد الإلكتروني (الوزاري)</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></div>
                <div>
                  <Label>رقم الهاتف</Label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="+9733XXXXXXX" />
                </div>
                <div><Label>كلمة المرور</Label><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></div>
                <Button type="submit" disabled={busy} className="w-full gradient-primary text-primary-foreground font-semibold">
                  {busy ? "..." : "إنشاء الحساب"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  سيقوم الماستر بتفعيل حسابك وتعيين دورك بعد التسجيل.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
        <div className="flex items-center justify-center gap-3 mt-6 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">العودة للصفحة الرئيسية</Link>
          <span>·</span>
          <AboutDialog variant="ghost" size="sm" className="text-xs h-auto py-0" />
        </div>
      </div>
    </div>
  );
}
