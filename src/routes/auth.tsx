import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "تسجيل الدخول — انضباط" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
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
    // Save phone on the profile (trigger only sets name/email)
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
        <div className="text-center mb-8">
          <h1 className="text-5xl font-extrabold text-gradient mb-2">انضباط</h1>
          <p className="text-muted-foreground">نظام إدارة المدرسة الذكي</p>
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
                <div><Label>رقم الجوال</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="9665XXXXXXXX" /></div>
                <div><Label>كلمة المرور</Label><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></div>
                <Button type="submit" disabled={busy} className="w-full gradient-primary text-primary-foreground font-semibold">
                  {busy ? "..." : "إنشاء الحساب"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  أول حساب يصبح ماستر تلقائياً. باقي الحسابات يفعّلها الماستر بتعيين دورها.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/" className="hover:text-primary">العودة للصفحة الرئيسية</Link>
        </p>
      </div>
    </div>
  );
}
