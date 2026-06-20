/**
 * /join/:code — ИНФОРМАЦИОННАЯ страница программы.
 * НЕ запрашивает ФИО, телефон, email.
 * Одна кнопка «Получить кабинет» → мгновенное создание профиля без контактных данных.
 * Контактные данные партнёр заполняет позже в кабинете.
 */
import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Shield, Loader2, AlertTriangle, RefreshCw,
  Eye, EyeOff, Copy, CheckCircle, ChevronRight,
  Users, TrendingUp, Star, Key, MapPin, Tag
} from "lucide-react";
import { setStoredProfile } from "@/lib/profileSession";
import { toast } from "@/components/ui/use-toast";
import { genUniqueLinkCode, genUniqueCandidateCode, MIN_QUOTA, getPublicTitle, createDefaultInviteSubprogram } from "@/lib/programUtils";
import { joinFlowDiagnostics, STEPS } from "@/lib/joinFlowDiagnostics";

const maskCode = (code) => code.slice(0, 4) + "••••••••••••••••••••" + code.slice(-4);

export default function RefLanding() {
  const { code } = useParams();
  const [program, setProgram] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [createdProfile, setCreatedProfile] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [codeSaved, setCodeSaved] = useState(false);

  // Recovery: restore success-state из sessionStorage на page load/refresh
  useEffect(() => {
    const recoveryState = sessionStorage.getItem('join_flow_recovery');
    if (recoveryState) {
      try {
        const { profile, timestamp } = JSON.parse(recoveryState);
        // Valid if less than 30 minutes old
        if (Date.now() - timestamp < 30 * 60 * 1000) {
          setCreatedProfile(profile);
          setDone(true);
          setCodeSaved(false); // Reset saved flag on page load
        } else {
          sessionStorage.removeItem('join_flow_recovery');
        }
      } catch (e) {
        console.warn('[RefLanding] Recovery parse failed:', e);
      }
    }
  }, []);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const programs = await base44.entities.ReferralProgram.filter({ link_code: code });
      const prog = programs[0];
      if (!prog) { setLoadState("not_found"); return; }
      if (prog.program_status && prog.program_status !== "active") {
        setProgram(prog); setLoadState("frozen"); return;
      }
      if (!prog.is_active) { setLoadState("not_found"); return; }
      setProgram(prog);
      setLoadState("ready");
    } catch { setLoadState("error"); }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const handleGetCabinet = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      // Вызываем безопасный server-side join-flow (идемпотентный)
      // Используем стабильный idempotency key на основе link_code
      const idempotencyKey = `join_${code}_${Date.now()}`;
      const res = await base44.functions.invoke('safeJoinFlow', { linkCode: code, idempotencyKey });
      
      if (!res.data?.success) {
        toast({
          title: "Не удалось создать кабинет",
          description: res.data?.error || "Неизвестная ошибка",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const { profile: createdProfile, childProgram } = res.data;
      setStoredProfile(createdProfile);
      
      // Recovery-state: сохраняем результат в sessionStorage перед переходом на success-screen
      sessionStorage.setItem('join_flow_recovery', JSON.stringify({
        profile: createdProfile,
        timestamp: Date.now(),
      }));
      
      setCreatedProfile(createdProfile);
      setDone(true);
      setCodeSaved(false);
    } catch (error) {
      console.error("[RefLanding] Join flow error:", error);
      toast({
        title: "Ошибка создания кабинета",
        description: "Попробуйте позже или обратитесь в поддержку.",
        variant: "destructive",
      });
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

  const Header = () => (
    <header className="bg-primary py-4 px-4">
      <div className="max-w-4xl mx-auto flex items-center gap-2">
        <Shield className="w-6 h-6 text-accent" />
        <span className="font-display font-bold text-xl text-primary-foreground">МилитариПартнер</span>
      </div>
    </header>
  );

  if (loadState === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (loadState === "not_found") return (
    <div className="min-h-screen flex flex-col"><Header />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4 text-center">
        <Shield className="w-16 h-16 text-muted-foreground" />
        <h1 className="font-heading text-2xl font-bold">Ссылка не найдена</h1>
        <p className="text-muted-foreground max-w-sm">Реферальная ссылка недействительна или программа приостановлена.</p>
        <Link to="/"><Button>На главную</Button></Link>
      </div>
    </div>
  );

  if (loadState === "frozen") return (
    <div className="min-h-screen flex flex-col"><Header />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4 text-center">
        <Shield className="w-16 h-16 text-amber-500" />
        <h1 className="font-heading text-2xl font-bold">Программа приостановлена</h1>
        <p className="text-muted-foreground max-w-sm">
          Программа «{getPublicTitle(program)}» временно не принимает новых партнёров. Обратитесь к пригласившему вас человеку.
        </p>
        <Link to="/"><Button variant="outline">На главную</Button></Link>
      </div>
    </div>
  );

  if (loadState === "error") return (
    <div className="min-h-screen flex flex-col"><Header />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive" />
        <h1 className="font-heading text-2xl font-bold">Ошибка загрузки</h1>
        <Button onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Повторить</Button>
      </div>
    </div>
  );

  // Экран успеха — показать код + onboarding + confirm сохранения
  if (done && createdProfile) return (
    <div className="min-h-screen bg-background flex flex-col"><Header />
      <div className="flex-1 px-4 py-12 w-full">
        <div className="max-w-3xl mx-auto">
          {/* Success banner */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="font-heading text-3xl font-bold mb-2">Кабинет создан!</h1>
            <p className="text-muted-foreground text-base">Начните приносить первых кандидатов прямо сейчас</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Левая часть: код + важное */}
            <div>
              <div className="bg-card border border-border rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-primary">
                  <Key className="w-4 h-4" />Секретный код для входа
                </div>
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
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  ⚠️ Сохраните код прямо сейчас. Без него войти не получится.
                </div>

                {/* Confirm сохранения кода */}
                <div className="mt-4 pt-4 border-t border-border">
                  <label className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <input 
                      type="checkbox" 
                      checked={codeSaved} 
                      onChange={(e) => setCodeSaved(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-blue-600"
                    />
                    <span className="text-xs text-blue-900">
                      ✓ Я сохранил код и понимаю, что без него войти не смогу
                    </span>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <div className="font-medium text-blue-900 mb-3">Как войти в кабинет?</div>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">1.</span>
                    <span>Перейдите на <Link to="/secret-login" className="text-blue-600 font-semibold hover:underline">/secret-login</Link></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">2.</span>
                    <span>Вставьте сохранённый код</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">3.</span>
                    <span>Готово — вы в кабинете!</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Правая часть: что делать дальше */}
            <div>
              <h2 className="font-heading font-bold text-lg mb-4">Что делать дальше</h2>
              <div className="space-y-3">
                {[
                  { num: "1", icon: "👤", title: "Заполните профиль", desc: "Добавьте ФИО, телефон, контакты в кабинете" },
                  { num: "2", icon: "🔗", title: "Найдите свои ссылки", desc: "Партнёрская ссылка и QR в разделе «Мои ссылки»" },
                  { num: "3", icon: "📤", title: "Поделитесь ссылкой", desc: "Отправьте в Telegram, WhatsApp, скопируйте QR" },
                  { num: "4", icon: "🎯", title: "Смотрите кандидатов", desc: "Все анкеты будут в разделе «Кандидаты»" },
                  { num: "5", icon: "💰", title: "Получайте выплаты", desc: "При подписании контракта выплаты приходят автоматически" },
                ].map((step, i) => (
                  <div key={i} className="bg-muted/50 border border-border rounded-lg p-4 hover:bg-muted transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl mt-0.5">{step.icon}</div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{step.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{step.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA — доступна только после подтверждения кода */}
          <div className="text-center">
            <Button 
              onClick={() => { window.location.href = "/dashboard"; }} 
              disabled={!codeSaved}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-12 rounded-xl px-8 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Перейти в кабинет →
            </Button>
            {!codeSaved && (
              <p className="text-xs text-muted-foreground mt-2">
                Сначала подтвердите, что код сохранён ↑
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Информационная страница — БЕЗ формы с контактами
  const perks = [
    { icon: TrendingUp, text: `Вознаграждение ${(program.reward_quota || 0).toLocaleString()} ₽ за успешный контракт по вашей ветке` },
    { icon: Users, text: "Приглашайте партнёров — каскадные выплаты на всех уровнях цепочки" },
    { icon: Star, text: "Личный кабинет с аналитикой, ссылками и историей начислений" },
    { icon: Shield, text: "Прозрачная система — вы всегда видите статус кандидатов и выплат" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-12 w-full">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* Левая колонка — только информация */}
          <div>
            <div className="text-sm text-accent font-semibold uppercase tracking-widest mb-3">Партнёрская программа</div>
            <h1 className="font-heading text-3xl font-black mb-4 leading-tight">{getPublicTitle(program)}</h1>

            {/* Регион и категория */}
            {(program.region_name || program.program_category) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {program.region_name && (
                  <span className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
                    <MapPin className="w-3 h-3 text-primary" />{program.region_name}
                  </span>
                )}
                {program.program_category && (
                  <span className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
                    <Tag className="w-3 h-3 text-primary" />{program.program_category}
                  </span>
                )}
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl p-5 mb-6">
              <div className="text-sm text-muted-foreground mb-1">Вознаграждение за успешный контракт по вашей ветке</div>
              <div className="font-heading text-4xl font-black text-accent">{(program.reward_quota || 0).toLocaleString()} ₽</div>
              {program.ancestry_path_text && (
                <div className="text-xs text-muted-foreground mt-2">Ветка: {program.ancestry_path_text}</div>
              )}
            </div>

            <div className="space-y-3 mb-6">
              <h2 className="font-heading font-bold">Что вы получаете:</h2>
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
              <div className="font-medium text-foreground mb-2">Как это работает?</div>
              {[
                "Нажмите «Получить кабинет» — профиль создаётся мгновенно",
                "Вам выдаётся секретный код для входа — запишите его",
                "ФИО, телефон и другие данные заполняете в кабинете когда удобно",
                "Направляйте кандидатов по своей ссылке анкеты",
                "При подписании контракта — вознаграждение начисляется автоматически",
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2 mb-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Правая колонка — одна кнопка, без формы */}
          <div>
            <div className="bg-card border-2 border-primary/20 rounded-2xl p-6 sticky top-8">
              <h2 className="font-heading font-bold text-xl mb-2">Получить кабинет партнёра</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Кабинет создаётся мгновенно — никаких анкет, ФИО и телефон вводятся позже в профиле
              </p>

              <div className="bg-muted rounded-xl p-4 mb-5 space-y-2 text-sm">
                <div className="flex items-center gap-2"><span className="text-primary font-medium">✓</span>Вы входите в: <strong>{getPublicTitle(program)}</strong></div>
                {program.region_name && <div className="flex items-center gap-2"><span className="text-primary font-medium">✓</span>Регион: <strong>{program.region_name}</strong></div>}
                <div className="flex items-center gap-2"><span className="text-primary font-medium">✓</span>Вам выдаётся уникальный секретный код</div>
                <div className="flex items-center gap-2"><span className="text-primary font-medium">✓</span>Личные данные заполняете позже в кабинете</div>
                <div className="flex items-center gap-2"><span className="text-primary font-medium">✓</span>Сразу получаете свои реферальные ссылки</div>
              </div>

              <Button
                onClick={handleGetCabinet}
                disabled={submitting}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-14 rounded-xl text-base"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Получить кабинет →"}
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-3 leading-relaxed">
                Создавая кабинет, вы соглашаетесь на обработку персональных данных в соответствии с законодательством РФ
              </p>

              <div className="mt-4 pt-4 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">
                  Уже есть кабинет?{" "}
                  <Link to="/secret-login" className="text-primary hover:underline font-medium">Войти по секретному коду</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}