import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Loader2, User, AlertTriangle, RefreshCw, Key, Eye, EyeOff, Copy } from "lucide-react";
import { setStoredProfile } from "@/lib/profileSession";
import { toast } from "@/components/ui/use-toast";
import { genUniqueLinkCode, genUniqueCandidateCode } from "@/lib/programUtils";

const genRefCode = () => {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const genSecretCode = () => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const maskCode = (code) => code.slice(0, 4) + "••••••••••••••••••••" + code.slice(-4);

/**
 * Partner Join Landing — /join/:linkCode
 * Создаёт только referrer-профиль + дочернюю программу. НЕ создаёт CandidateApplication.
 */
export default function RefLanding() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [parentProgram, setParentProgram] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", consent: false });
  const [formError, setFormError] = useState("");
  const [newProfile, setNewProfile] = useState(null);
  const [showCode, setShowCode] = useState(false);

  const fetchProgram = useCallback(async () => {
    setLoadState("loading");
    try {
      // code может быть link_code программы или referral_code реферала (legacy)
      const programs = await base44.entities.ReferralProgram.filter({ link_code: code, is_active: true });
      if (programs.length > 0) {
        setParentProgram(programs[0]);
        setLoadState("ready");
        return;
      }
      // Legacy: поиск по referral_code профиля
      const profiles = await base44.entities.ReferralProfile.filter({ referral_code: code });
      if (profiles.length > 0) {
        // Ищем программу этого реферала
        const progs = await base44.entities.ReferralProgram.filter({ owner_user_id: profiles[0].id, is_active: true });
        if (progs.length > 0) {
          setParentProgram(progs[0]);
          setLoadState("ready");
          return;
        }
      }
      setLoadState("not_found");
    } catch {
      setLoadState("error");
    }
  }, [code]);

  useEffect(() => { fetchProgram(); }, [fetchProgram]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.consent) { setFormError("Необходимо согласие на обработку персональных данных"); return; }
    if (!form.full_name || !form.phone) { setFormError("Заполните обязательные поля"); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      const emailLower = form.email.trim().toLowerCase();

      if (emailLower) {
        const existing = await base44.entities.ReferralProfile.filter({ email: emailLower });
        if (existing.length > 0) {
          setFormError("Пользователь с таким email уже зарегистрирован. Войдите по секретному коду.");
          setSubmitting(false);
          return;
        }
      }

      // Генерируем уникальный secret_code
      let secretCode;
      let attempts = 0;
      while (attempts < 5) {
        secretCode = genSecretCode();
        const conflict = await base44.entities.ReferralProfile.filter({ secret_code: secretCode });
        if (conflict.length === 0) break;
        attempts++;
      }

      const referralCode = genRefCode();
      const maskedCode = maskCode(secretCode);
      const now = new Date().toISOString();

      // Создаём новый referrer-профиль
      const profile = await base44.entities.ReferralProfile.create({
        ...(emailLower ? { email: emailLower } : {}),
        full_name: form.full_name || undefined,
        phone: form.phone || undefined,
        role: "referrer",
        status: "active",
        referral_code: referralCode,
        secret_code: secretCode,
        masked_secret_code: maskedCode,
        secret_code_last_sent_at: now,
        parent_user_id: parentProgram?.owner_user_id,
        level: "L0_novice",
        total_earned: 0, total_paid: 0, total_pending: 0,
        active_referrals_count: 0, total_candidates_count: 0,
        referral_reward: parentProgram?.reward_quota || 50000,
        personal_max_reward_snapshot: parentProgram?.reward_quota,
      });

      // Создаём дочернюю ReferralProgram для нового реферала
      const childQuota = parentProgram?.reward_quota || 50000;
      const linkCode = await genUniqueLinkCode();
      const formCode = await genUniqueCandidateCode();

      const childProgram = await base44.entities.ReferralProgram.create({
        title: `Программа: ${form.full_name || "Участник"}`,
        link_code: linkCode,
        candidate_form_code: formCode,
        owner_user_id: profile.id,
        parent_program_id: parentProgram?.id,
        root_program_id: parentProgram?.root_program_id || parentProgram?.id,
        root_master_link_id: parentProgram?.root_master_link_id,
        assigned_moderator_id: parentProgram?.assigned_moderator_id,
        reward_quota: childQuota,
        parent_reward_quota: parentProgram?.reward_quota,
        depth: (parentProgram?.depth || 0) + 1,
        is_root: false,
        is_active: true,
        can_create_child: childQuota > 5000,
        children_count: 0,
        candidates_count: 0,
      });

      // Обновляем счётчик дочерних программ у родителя
      if (parentProgram) {
        await base44.entities.ReferralProgram.update(parentProgram.id, {
          children_count: (parentProgram.children_count || 0) + 1,
        }).catch(() => {});
      }

      await base44.entities.ActionLog.create({
        action_type: "PROFILE_CREATED_FROM_PROGRAM_LINK",
        entity_type: "ReferralProfile",
        entity_id: profile.id,
        action_payload: JSON.stringify({
          link_code: code,
          parent_program_id: parentProgram?.id,
          child_program_id: childProgram.id,
          quota: childQuota,
        }),
      }).catch(() => {});

      if (emailLower) {
        await base44.integrations.Core.SendEmail({
          to: emailLower,
          subject: "Вы в МилитариПартнер — ваш код входа",
          body: `<h2>Добро пожаловать!</h2>
<p>Вы присоединились к партнёрской программе <strong>${parentProgram?.title || "МилитариПартнер"}</strong>.</p>
<p><strong>Ваш секретный код для входа:</strong></p>
<p style="font-size:20px;font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${secretCode}</p>
<p>Используйте его для входа — email при входе не нужен.</p>
<p><a href="${window.location.origin}/secret-login">Войти в кабинет →</a></p>`,
        }).catch(() => {});
      }

      setStoredProfile({ ...profile, secret_code: secretCode, masked_secret_code: maskedCode });
      setNewProfile({ ...profile, secret_code: secretCode, masked_secret_code: maskedCode, email: emailLower });

    } catch (err) {
      setFormError("Произошла ошибка при регистрации. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (newProfile?.secret_code) {
      await navigator.clipboard.writeText(newProfile.secret_code);
      toast({ title: "Код скопирован!" });
    }
  };

  if (loadState === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (loadState === "not_found") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
      <Shield className="w-16 h-16 text-muted-foreground" />
      <h1 className="font-heading text-2xl font-bold">Ссылка не найдена</h1>
      <p className="text-muted-foreground max-w-sm">Реферальная ссылка недействительна или устарела.</p>
      <Link to="/"><Button>На главную</Button></Link>
    </div>
  );

  if (loadState === "error") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
      <AlertTriangle className="w-16 h-16 text-destructive" />
      <h1 className="font-heading text-2xl font-bold">Ошибка загрузки</h1>
      <Button onClick={fetchProgram} className="gap-2"><RefreshCw className="w-4 h-4" />Повторить</Button>
    </div>
  );

  // Экран показа секретного кода после регистрации
  if (newProfile) return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" />
          <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-bold mb-2">Вы в команде!</h1>
            <p className="text-muted-foreground text-sm">Сохраните секретный код — это ваш единственный способ войти</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="bg-muted rounded-xl p-4 font-mono text-center text-base mb-3 min-h-[56px] flex items-center justify-center break-all">
              {showCode ? newProfile.secret_code : newProfile.masked_secret_code}
            </div>
            {newProfile.email ? (
              <p className="text-xs text-muted-foreground text-center mb-4">Код также отправлен на <strong>{newProfile.email}</strong></p>
            ) : (
              <p className="text-xs text-amber-600 text-center mb-4 bg-amber-50 rounded-lg p-2">
                ⚠️ Email не указан — сохраните код сейчас, иначе не сможете войти повторно
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 mb-5">
              <Button variant="outline" size="sm" onClick={() => setShowCode(v => !v)} className="h-10 text-xs">
                {showCode ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                {showCode ? "Скрыть" : "Показать"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="h-10 text-xs">
                <Copy className="w-3.5 h-3.5 mr-1" /> Копировать
              </Button>
            </div>
            <Button onClick={() => { window.location.href = "/dashboard"; }} className="w-full bg-primary font-bold h-12 rounded-xl">
              Я сохранил — в кабинет →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Форма регистрации
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" />
          <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 py-12">
        {parentProgram && (
          <div className="flex items-center gap-3 mb-8 bg-card border border-border rounded-xl p-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Партнёрская программа</div>
              <div className="font-medium">{parentProgram.title}</div>
              <div className="text-xs text-accent font-bold mt-0.5">До {(parentProgram.reward_quota || 0).toLocaleString()} ₽ за контракт</div>
            </div>
          </div>
        )}

        <h1 className="font-heading text-3xl font-bold mb-2">Стать партнёром</h1>
        <p className="text-muted-foreground mb-8">Получите свой кабинет, реферальную ссылку и начните зарабатывать</p>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ваши контакты</div>
          <div><Label>Имя *</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required placeholder="Ваше имя" /></div>
          <div><Label>Телефон *</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required placeholder="+7 900 123 45 67" type="tel" /></div>
          <div>
            <Label>Email (необязательно)</Label>
            <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ваш@email.com" type="email" />
            <p className="text-xs text-muted-foreground mt-1">Если укажете — пришлём код на email дополнительно</p>
          </div>
          <div className="flex items-start gap-3 pt-2">
            <Checkbox checked={form.consent} onCheckedChange={v => setForm(f => ({ ...f, consent: v }))} id="consent" className="mt-0.5" />
            <label htmlFor="consent" className="text-sm text-muted-foreground leading-tight cursor-pointer">
              Согласен на обработку персональных данных в соответствии с законодательством РФ
            </label>
          </div>
          {formError && <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">{formError}</div>}
          <Button type="submit" disabled={submitting} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-12 rounded-xl">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Зарегистрироваться и получить кабинет"}
          </Button>
        </form>
      </div>
    </div>
  );
}