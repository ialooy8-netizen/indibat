import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, type AppRole, ROLE_LABELS, setDemoRole } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Settings as SettingsIcon, Trash2, UserPlus, Eye, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { seedDemoData, wipeDemoData } from "@/lib/demo.functions";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isReallyMaster, loading } = useRoles();

  if (loading) return <div className="text-muted-foreground p-6">جاري التحميل...</div>;
  if (!isReallyMaster) return <Navigate to="/" />;

  return (
    <div className="space-y-8 max-w-3xl">
      <h2 className="text-3xl font-bold flex items-center gap-2">
        <SettingsIcon className="h-7 w-7 text-primary" /> الإعدادات
      </h2>
      <AppNameSection />
      <AboutSection />
      <SchoolHeaderSection />
      <FeatureFlagsSection />
      <ChatRetentionSection />
      <BrandingSection />
      <DemoModeSection />
      <FacilityConfigSection />
      <ClassTeachersSection />
    </div>
  );
}

function AppNameSection() {
  const qc = useQueryClient();
  const cur = useQuery({
    queryKey: ["app-name-cfg"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "app_name").maybeSingle();
      return (data?.value as { name: string; tagline: string }) ?? { name: "EduPulse | نبض", tagline: "" };
    },
  });
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  useEffect(() => { if (cur.data) { setName(cur.data.name); setTagline(cur.data.tagline); } }, [cur.data]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("app_settings").update({ value: { name, tagline }, updated_at: new Date().toISOString() }).eq("key", "app_name");
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ اسم النظام"); qc.invalidateQueries({ queryKey: ["app-name"] }); qc.invalidateQueries({ queryKey: ["app-name-cfg"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="glass-strong rounded-2xl p-6 space-y-3 border border-primary/30">
      <h3 className="text-xl font-bold">اسم النظام والشعار النصي</h3>
      <div><Label>اسم النظام</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><Label>الشعار النصي (يظهر في الصفحة الرئيسية)</Label><Input value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="gradient-primary text-primary-foreground">حفظ</Button>
    </section>
  );
}

function AboutSection() {
  const qc = useQueryClient();
  const cur = useQuery({
    queryKey: ["about-cfg"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "about").maybeSingle();
      return (data?.value as { body: string; email: string; phone?: string }) ?? { body: "", email: "", phone: "" };
    },
  });
  const [body, setBody] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  useEffect(() => { if (cur.data) { setBody(cur.data.body); setEmail(cur.data.email); setPhone(cur.data.phone ?? ""); } }, [cur.data]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("app_settings").update({ value: { body, email, phone }, updated_at: new Date().toISOString() }).eq("key", "about");
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["about-text"] }); qc.invalidateQueries({ queryKey: ["about-cfg"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="glass rounded-2xl p-6 space-y-3">
      <h3 className="text-xl font-bold">محتوى «عن النظام»</h3>
      <div><Label>النص</Label><Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>بريد التواصل</Label><Input dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label>هاتف (اختياري)</Label><Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="gradient-primary text-primary-foreground">حفظ</Button>
    </section>
  );
}

function SchoolHeaderSection() {
  const qc = useQueryClient();
  const cur = useQuery({
    queryKey: ["school-header-cfg"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "school_header").maybeSingle();
      return (data?.value as { headerUrl: string | null; schoolName: string; footerNote: string }) ?? { headerUrl: null, schoolName: "", footerNote: "" };
    },
  });
  const [schoolName, setSchoolName] = useState("");
  const [footerNote, setFooterNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (cur.data) { setSchoolName(cur.data.schoolName); setFooterNote(cur.data.footerNote); } }, [cur.data]);

  async function upload(file: File) {
    setBusy(true);
    try {
      const path = `branding/school-header-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: e1 } = await supabase.storage.from("attachments").upload(path, file, { upsert: true });
      if (e1) throw e1;
      const { data: s } = await supabase.storage.from("attachments").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      const next = { headerUrl: s?.signedUrl ?? null, schoolName, footerNote };
      const { error } = await supabase.from("app_settings").update({ value: next, updated_at: new Date().toISOString() }).eq("key", "school_header");
      if (error) throw error;
      toast.success("تم تحديث ترويسة المدرسة");
      qc.invalidateQueries({ queryKey: ["school-header-cfg"] });
      qc.invalidateQueries({ queryKey: ["school-header"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  const saveMeta = useMutation({
    mutationFn: async () => {
      const next = { headerUrl: cur.data?.headerUrl ?? null, schoolName, footerNote };
      const { error } = await supabase.from("app_settings").update({ value: next, updated_at: new Date().toISOString() }).eq("key", "school_header");
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["school-header-cfg"] }); qc.invalidateQueries({ queryKey: ["school-header"] }); },
  });

  return (
    <section className="glass rounded-2xl p-6 space-y-3">
      <h3 className="text-xl font-bold">ترويسة المدرسة (تظهر في الملفات المطبوعة)</h3>
      <div className="flex items-center justify-center bg-white/5 rounded-lg p-3" style={{ minHeight: 100 }}>
        {cur.data?.headerUrl ? <img src={cur.data.headerUrl} alt="" style={{ maxHeight: 100, objectFit: "contain" }} /> : <span className="text-xs text-muted-foreground">لم يتم الرفع</span>}
      </div>
      <Input type="file" accept="image/*" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      <div><Label>اسم المدرسة</Label><Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} /></div>
      <div><Label>نص تذييل (يظهر أسفل الصفحة)</Label><Input value={footerNote} onChange={(e) => setFooterNote(e.target.value)} /></div>
      <Button onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending} variant="outline">حفظ النصوص</Button>
    </section>
  );
}

function FeatureFlagsSection() {
  const qc = useQueryClient();
  const flags = useQuery({
    queryKey: ["feature-flags-all"],
    queryFn: async () => (await supabase.from("feature_flags").select("*").order("key")).data ?? [],
  });
  const toggle = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await supabase.from("feature_flags").update({ enabled, updated_at: new Date().toISOString() }).eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature-flags-all"] }),
  });
  const setMsg = useMutation({
    mutationFn: async ({ key, message }: { key: string; message: string }) => {
      const { error } = await supabase.from("feature_flags").update({ message, updated_at: new Date().toISOString() }).eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["feature-flags-all"] }); },
  });
  return (
    <section className="glass rounded-2xl p-6 space-y-3">
      <h3 className="text-xl font-bold">تعطيل/تفعيل الميزات</h3>
      <p className="text-xs text-muted-foreground">عند التعطيل، تظهر رسالتك المخصصة للمستخدم بدلاً من الميزة.</p>
      <div className="space-y-2">
        {flags.data?.map((f) => (
          <div key={f.key} className="glass rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{f.key}</span>
              <Switch checked={f.enabled} onCheckedChange={(v) => toggle.mutate({ key: f.key, enabled: v })} />
            </div>
            {!f.enabled && (
              <div className="flex gap-2">
                <Input defaultValue={f.message ?? ""} placeholder="رسالة للمستخدم عند التعطيل..." className="text-xs" onBlur={(e) => { if (e.target.value !== (f.message ?? "")) setMsg.mutate({ key: f.key, message: e.target.value }); }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ChatRetentionSection() {
  const qc = useQueryClient();
  const cur = useQuery({
    queryKey: ["chat-settings"],
    queryFn: async () => (await supabase.from("chat_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [mode, setMode] = useState<"manual" | "daily" | "custom">("manual");
  const [days, setDays] = useState(7);
  useEffect(() => { if (cur.data) { setMode(cur.data.retention_mode); setDays(cur.data.retention_days); } }, [cur.data]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("chat_settings").update({ retention_mode: mode, retention_days: days, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["chat-settings"] }); },
  });
  return (
    <section className="glass rounded-2xl p-6 space-y-3">
      <h3 className="text-xl font-bold">سياسة الاحتفاظ برسائل غرفة الموظفين</h3>
      <div className="flex flex-wrap gap-2">
        {(["manual","daily","custom"] as const).map((m) => (
          <Button key={m} variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}
            className={mode === m ? "gradient-primary text-primary-foreground" : ""}>
            {m === "manual" ? "يدوي" : m === "daily" ? "حذف كل 24 ساعة" : "عدد أيام محدد"}
          </Button>
        ))}
      </div>
      {mode === "custom" && <div><Label>عدد الأيام</Label><Input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} /></div>}
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="gradient-primary text-primary-foreground">حفظ</Button>
    </section>
  );
}

function BrandingSection() {
  const qc = useQueryClient();
  const current = useQuery({
    queryKey: ["branding"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "branding").maybeSingle();
      return (data?.value as { logoUrl: string | null; homeLogoUrl: string | null }) ?? { logoUrl: null, homeLogoUrl: null };
    },
  });
  const [busy, setBusy] = useState<"sidebar" | "home" | null>(null);

  async function upload(file: File, slot: "sidebar" | "home") {
    setBusy(slot);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `branding/${slot}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from("attachments").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signErr) throw signErr;
      const url = signed.signedUrl;
      const next = { ...(current.data ?? { logoUrl: null, homeLogoUrl: null }) };
      if (slot === "sidebar") next.logoUrl = url; else next.homeLogoUrl = url;
      const { error: updErr } = await supabase.from("app_settings").update({ value: next, updated_at: new Date().toISOString() }).eq("key", "branding");
      if (updErr) throw updErr;
      toast.success("تم تحديث الشعار");
      qc.invalidateQueries({ queryKey: ["branding"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  async function reset() {
    if (!confirm("إعادة الشعارات إلى الإعداد الافتراضي؟")) return;
    await supabase.from("app_settings").update({ value: { logoUrl: null, homeLogoUrl: null }, updated_at: new Date().toISOString() }).eq("key", "branding");
    qc.invalidateQueries({ queryKey: ["branding"] });
    toast.success("تمت الإعادة");
  }

  return (
    <section className="glass-strong rounded-2xl p-6 space-y-4 border border-primary/30">
      <div>
        <h3 className="text-xl font-bold">شعار النظام</h3>
        <p className="text-sm text-muted-foreground mt-1">يستخدم شعار الشريط الجانبي داخل النظام، وشعار الرئيسية في صفحتي الدخول واللوحة الرئيسية.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <LogoSlot label="شعار الشريط الجانبي (مربع/صغير)" url={current.data?.logoUrl} busy={busy === "sidebar"} onPick={(f) => upload(f, "sidebar")} previewSize={64} />
        <LogoSlot label="شعار الصفحة الرئيسية وصفحة الدخول (كبير)" url={current.data?.homeLogoUrl} busy={busy === "home"} onPick={(f) => upload(f, "home")} previewSize={128} />
      </div>
      <Button variant="outline" size="sm" onClick={reset}>إعادة إلى الافتراضي</Button>
    </section>
  );
}

function LogoSlot({ label, url, busy, onPick, previewSize }: { label: string; url: string | null | undefined; busy: boolean; onPick: (f: File) => void; previewSize: number }) {
  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center justify-center bg-white/5 rounded-lg" style={{ minHeight: previewSize + 16 }}>
        {url ? <img src={url} alt="" style={{ height: previewSize, objectFit: "contain" }} /> : <span className="text-xs text-muted-foreground py-4">الافتراضي</span>}
      </div>
      <Input type="file" accept="image/*" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }} />
      {busy && <p className="text-xs text-primary">جاري الرفع...</p>}
    </div>
  );
}

function DemoModeSection() {
  const { demoRole } = useRoles();
  const seed = useServerFn(seedDemoData);
  const wipe = useServerFn(wipeDemoData);
  const [busy, setBusy] = useState(false);

  const PREVIEW_ROLES: AppRole[] = ["principal", "vice_principal", "teacher", "print_manager"];

  async function doSeed() {
    setBusy(true);
    try { const r = await seed(); toast.success(`تم إنشاء ${r.classes} صفوف و ${r.students} طلاب تجريبيين`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  async function doWipe() {
    if (!confirm("حذف كل البيانات التجريبية؟")) return;
    setBusy(true);
    try { await wipe(); toast.success("تم حذف البيانات التجريبية"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="glass-strong rounded-2xl p-6 space-y-4 border border-accent/30">
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /> وضع المعاينة والتجربة</h3>
        <p className="text-sm text-muted-foreground mt-1">جرّب النظام بعيون أدوار مختلفة، وأنشئ بيانات تجريبية بضغطة زر.</p>
      </div>

      <div>
        <Label className="mb-2 block">معاينة النظام كـ:</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PREVIEW_ROLES.map((r) => (
            <Button key={r} variant={demoRole === r ? "default" : "outline"}
              onClick={() => setDemoRole(demoRole === r ? null : r)}
              className={demoRole === r ? "gradient-primary text-primary-foreground gap-1" : "gap-1"}>
              <Eye className="h-3.5 w-3.5" /> {ROLE_LABELS[r]}
            </Button>
          ))}
        </div>
        {demoRole && (
          <p className="text-xs text-accent mt-2">تعاين النظام الآن كـ <strong>{ROLE_LABELS[demoRole]}</strong>. صلاحيات الكتابة تبقى على دورك الحقيقي.</p>
        )}
      </div>

      <div className="border-t border-border/30 pt-4">
        <Label className="mb-2 block">بيانات تجريبية</Label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={doSeed} disabled={busy} className="gradient-primary text-primary-foreground gap-2">
            <RefreshCw className="h-4 w-4" /> إنشاء/تحديث بيانات تجريبية
          </Button>
          <Button onClick={doWipe} disabled={busy} variant="outline" className="text-destructive gap-2">
            <Trash2 className="h-4 w-4" /> حذف البيانات التجريبية
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">ينشئ 2 صفوف و12 طالب تجريبي مع نقاط سلوك متنوعة. لن يؤثر على بيانات المدرسة الحقيقية.</p>
      </div>
    </section>
  );
}

function FacilityConfigSection() {
  const qc = useQueryClient();
  const cfg = useQuery({
    queryKey: ["facility-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facility_config").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [periods, setPeriods] = useState(7);
  const [workingDays, setWorkingDays] = useState("");
  const [resources, setResources] = useState("");

  useEffect(() => {
    if (cfg.data) {
      setPeriods(cfg.data.periods_per_day);
      setWorkingDays(cfg.data.working_days.join("، "));
      setResources(cfg.data.resources.join("، "));
    }
  }, [cfg.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("facility_config").update({
        periods_per_day: periods,
        working_days: workingDays.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
        resources: resources.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["facility-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="glass rounded-2xl p-6 space-y-4">
      <h3 className="text-xl font-bold">إعدادات اليوم الدراسي</h3>
      <div><Label>عدد الحصص في اليوم</Label><Input type="number" min={1} max={12} value={periods} onChange={(e) => setPeriods(Number(e.target.value))} /></div>
      <div><Label>أيام العمل (مفصولة بفاصلة)</Label><Input value={workingDays} onChange={(e) => setWorkingDays(e.target.value)} /></div>
      <div><Label>المرافق المتاحة (مفصولة بفاصلة)</Label><Input value={resources} onChange={(e) => setResources(e.target.value)} /></div>
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full gradient-primary text-primary-foreground">حفظ</Button>
    </section>
  );
}

function ClassTeachersSection() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");

  const classes = useQuery({
    queryKey: ["classes-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const teachers = useQuery({
    queryKey: ["teachers-list"],
    queryFn: async () => {
      const { data: roleRows, error: rolesErr } = await supabase
        .from("user_roles").select("user_id").eq("role", "teacher");
      if (rolesErr) throw rolesErr;
      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles").select("id, full_name, email").in("id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignments = useQuery({
    queryKey: ["class-teachers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_teachers").select("*");
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!classId || !teacherId) throw new Error("اختر الصف والمعلم");
      const { error } = await supabase.from("class_teachers").insert({ class_id: classId, teacher_id: teacherId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم التعيين"); setClassId(""); setTeacherId(""); qc.invalidateQueries({ queryKey: ["class-teachers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("class_teachers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-teachers"] }),
  });

  const nameForClass = (id: string) => classes.data?.find((c) => c.id === id)?.name ?? "—";
  const nameForTeacher = (id: string) => {
    const t = teachers.data?.find((x) => x.id === id);
    return t?.full_name ?? t?.email ?? "—";
  };

  return (
    <section className="glass rounded-2xl p-6 space-y-4">
      <h3 className="text-xl font-bold flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> توزيع المعلمين على الصفوف</h3>
      <p className="text-sm text-muted-foreground">يحدد أي صفوف تظهر للمعلم في صفحة الحضور.</p>
      <div className="flex flex-wrap gap-2">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="الصف" /></SelectTrigger>
          <SelectContent>{classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="المعلم" /></SelectTrigger>
          <SelectContent>
            {teachers.data?.length === 0 && <div className="p-2 text-xs text-muted-foreground">لا يوجد معلمون. عيّن دور "معلم" أولاً.</div>}
            {teachers.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name ?? t.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => add.mutate()} disabled={add.isPending} className="gradient-primary text-primary-foreground">إضافة</Button>
      </div>
      <div className="space-y-2 pt-2">
        {assignments.data?.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد تعيينات بعد.</p>}
        {assignments.data?.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
            <span className="flex-1 text-sm">
              <span className="font-semibold">{nameForClass(a.class_id)}</span>
              <span className="text-muted-foreground mx-2">←</span>
              {nameForTeacher(a.teacher_id)}
            </span>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate(a.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
