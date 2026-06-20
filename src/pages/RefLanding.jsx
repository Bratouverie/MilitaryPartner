/**
 * /join/:linkCode — ИНФОРМАЦИОННАЯ страница партнёрской программы.
 * НЕ собирает контактные данные.
 * После нажатия "Получить кабинет" → instant регистрация и редирект в дашборд.
 */
import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, AlertTriangle, RefreshCw, Key, Eye, EyeOff, Copy, CheckCircle, ChevronRight, Star, Users, TrendingUp } from "lucide-react";
import { setStoredProfile } from "@/lib/profileSession";
import { toast } from "@/components/ui/use-toast";
import { genUniqueLinkCode, genUniqueCandidateCode, validateQuota, MIN_QUOTA } from "@/lib/programUtils";

const genSecretCode = () => {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 28 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const genRefCode = () => {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const maskCode = (code) => code.slice(0, 4) + "••••••••••••••••••••" + code.slice(-4);

export default function RefLanding() {
  const { code } = useParams();
  const [program, setProgram] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [step, setStep] = useState("info"); // info | register | success
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [createdProfile, setCreatedProfile] = useState(null);
  const [showCode, setShowCode] = useState(false);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      // Поиск по link_code программы
      const programs = await base44.entities.ReferralProgram.filter({ link_code: code, is_active: true });
      if (programs.length > 0) { setProgram(programs[0]); setLoadState("ready"); return; }
      setLoadState("not_found");
    } catch { setLoadState("error"); }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const handleGetCabinet = async () => {
    setFormError("");
    if (!quickName.trim()) { setFormError("Введите ваше имя"); return; }
    if (!quickPhone.trim()) { setFormError("Введите телефон для связи"); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      // Генерируем уникальный secret_code
      let secretCode;
      for (let i = 0; i < 5; i++) {
        secretCode = genSecretCode();
        const conflict = await base44.entities.ReferralProfile.filter({ secret_code: secretCode });
        if (conflict.length === 0) break;
      }
      const maskedCode = maskCode(secretCode);
      const now = new Date().toISOString();
      const referralCode = genRefCode();

      // Создаём реферальный профиль
      const profile = await base44.entities.ReferralProfile.create({
        full_name: quickName.trim(),
        phone: quickPhone.trim(),
        role: "referrer",
        status: "active",
        referral_code: referralCode,
        secret_code: secretCode,
        masked_secret_code: maskedCode,
        secret_code_last_sent_at: now,
        parent_user_id: program?.owner_user_id,
        level: "L0_novice",
        total_earned: 0, total_paid: 0, total_pending: 0,
        active_referrals_count: 0, total_candidates_count: 0,
        referral_reward: program?.reward_quota || MIN_QUOTA,
        personal_max_reward_snapshot: program?.reward_quota,
      });

      // Создаём дочернюю программу
      const childQuota = program?.reward_quota || MIN_QUOTA;
      const [linkCode, formCode] = await Promise.all([genUniqueLinkCode(), genUniqueCandidateCode()]);

      let ancestryIds = [];
      try { ancestryIds = JSON.parse(program?.ancestry_path_ids || "[]"); } catch {}
      ancestryIds.push(program?.id);

      await base44.entities.ReferralProgram.create({
        title: `Команда: ${quickName.trim()}`,
        link_code: linkCode,
        candidate_form_code: formCode,
        owner_user_id: profile.id,
        parent_program_id: program?.id,
        root_program_id: program?.root_program_id || program?.id,
        root_master_link_id: program?.root_master_link_id,
        assigned_moderator_id: program?.assigned_moderator_id,
        reward_quota: childQuota,
        parent_reward_quota: program?.reward_quota,
        depth: (program?.depth || 0) + 1,
        ancestry_path_ids: JSON.stringify(ancestryIds),
        ancestry_path_text: (program?.ancestry_path_text || program?.title || "") + " / " + quickName.trim(),
        program_kind: "child",
        is_root: false, is_active: true, is_archived: false,
        can_create_child: childQuota > MIN_QUOTA,
        direct_children_count: 0, children_count: 0, candidates_count: 0,
      });

      // Обновляем счётчик у parent
      await base44.entities.ReferralProgram.update(program.id, {
        direct_children_count: (program.direct_children_count || 0) + 1,
        children_count: (program.children_count || 0) + 1,
      }).catch(() => {});

      await base44.entities.ActionLog.create({
        action_type: "PROFILE_CREATED_FROM_PROGRAM_LINK",
        entity_type: "ReferralProfile",
        entity_id: profile.id,
        action_payload: JSON.stringify({ link_code: code, parent_program_id: program?.id, quota: childQuota }),
      }).catch(() => {});

      setStoredProfile({ ...profile, secret_code: secretCode });
      setCreatedProfile({ ...profile, secret_code: secretCode, masked_secret_code: maskedCode });
      setStep("success");
    } catch (err) {
      setFormError("Ошибка регистрации. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (createdProfile?.secret_code) {
      await navigator.clipboard.writeText(createdProfile.secret_code);
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
      <p className="text-muted-foreground max-w-sm">Реферальная ссылка недействительна или истекла.</p>
      <Link to="/"><Button>На главную</Button></Link>
    </div>
  );
  if (loadState === "error") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
      <AlertTriangle className="w-16 h-16 text-destructive" />
      <h1 className="font-heading text-2xl font-bold">Ошибка загрузки</h1>
      <Button onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Повторить</Button>
    </div>
  );

  // Экран успеха — показываем секретный код
  if (step === "success" && createdProfile) return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" /><span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-2">Кабинет создан!</h1>
          <p className="text-muted-foreground text-sm mb-6">Сохраните секретный код — это единственный способ войти в кабинет</p>
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="bg-muted rounded-xl p-4 font-mono text-center text-sm mb-3 break-all min-h-[52px] flex items-center justify-center">
              {showCode ? createdProfile.secret_code : createdProfile.masked_secret_code}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={() => setShowCode(v => !v)} className="h-10 text-xs">
                {showCode ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                {showCode ? "Скрыть" : "Показать"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="h-10 text-xs">
                <Copy className="w-3.5 h-3.5 mr-1" />Копировать
              </Button>
            </div>
            <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mb-4">
              ⚠️ Запомните или скопируйте код сейчас. Без него войти не получится.
            </div>
            <Button onClick={() => { window.location.href = "/dashboard"; }} className="w-full bg-primary font-bold h-12 rounded-xl">
              Я сохранил — войти в кабинет →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Информационная страница + форма быстрой регистрации
  const perks = [
    { icon: TrendingUp, text: `Вознаграждение до ${(program.reward_quota || 0).toLocaleString()} ₽ за успешный контракт` },
    { icon: Users, text: "Приглашайте партнёров и получайте каскадные выплаты" },
    { icon: Star, text: "Собственный кабинет с аналитикой и ссылками" },
    { icon: Shield, text: "Прозрачная история начислений и выплат" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" /><span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* Информационный блок */}
          <div>
            <div className="text-sm text-accent font-semibold uppercase tracking-widest mb-3">Партнёрская программа</div>
            <h1 className="font-heading text-3xl font-black mb-4 leading-tight">{program.title}</h1>

            <div className="bg-card border border-border rounded-2xl p-5 mb-6">
              <div className="text-sm text-muted-foreground mb-1">Вознаграждение за контракт по вашей ветке</div>
              <div className="font-heading text-4xl font-black text-accent">{(program.reward_quota || 0).toLocaleString()} ₽</div>
              {program.parent_reward_quota && (
                <div className="text-xs text-muted-foreground mt-1">
                  Суммарная цепочка: {(program.parent_reward_quota).toLocaleString()} ₽
                </div>
              )}
            </div>

            <div className="space-y-3 mb-6">
              <h2 className="font-heading font-bold text-base">Что вы получите:</h2>
              {perks.map((p, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <p.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground leading-relaxed">{p.text}</span>
                </div>
              ))}
            </div>

            <div className="bg-muted rounded-xl p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground mb-1">Как это работает?</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />Получите свой кабинет и реферальные ссылки</div>
                <div className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />Направляйте кандидатов через вашу ссылку анкеты</div>
                <div className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />При подписании контракта — выплата вознаграждения</div>
                <div className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />Стройте свою сеть партнёров для каскадных выплат</div>
              </div>
            </div>
          </div>

          {/* Форма быстрой регистрации */}
          <div>
            <div className="bg-card border-2 border-primary/20 rounded-2xl p-6 sticky top-8">
              <h2 className="font-heading font-bold text-xl mb-1">Получить кабинет партнёра</h2>
              <p className="text-sm text-muted-foreground mb-5">Кабинет создаётся мгновенно — без долгих анкет</p>

              <div className="space-y-4">
                <div>
                  <Label>Ваше имя *</Label>
                  <Input
                    value={quickName}
                    onChange={e => setQuickName(e.target.value)}
                    placeholder="Иванов Иван"
                    className="mt-1"
                    autoFocus
                  />
                </div>
                <div>
                  <Label>Телефон *</Label>
                  <Input
                    type="tel"
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                    placeholder="+7 900 123 45 67"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Для связи с куратором программы</p>
                </div>

                {formError && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">{formError}</div>
                )}

                <Button
                  onClick={handleGetCabinet}
                  disabled={submitting}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-12 rounded-xl text-base"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Получить кабинет →"}
                </Button>

                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Нажимая кнопку, вы соглашаетесь на обработку персональных данных в соответствии с законодательством РФ
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">
                  Уже есть кабинет?{" "}
                  <Link to="/secret-login" className="text-primary hover:underline font-medium">Войти по коду</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}