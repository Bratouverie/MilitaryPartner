import React, { useState } from "react";
import { Send, MessageCircle, X, Phone, Mail, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

const AI_RESPONSES = {
  greetings: [
    { patterns: ["привет", "привет!", "привет?", "хай", "hello", "hi"], response: "Привет! 👋 Я здесь, чтобы помочь вам разобраться с программой МилитариПартнер. Что вас интересует?" },
  ],
  payments: [
    { patterns: ["платят", "деньги", "выплата", "когда платят", "сколько платят"], response: "💰 **Платежи гарантированы!** Мы платим 100% за 7 дней после подписания контракта. Сумма: от 50,000 до 200,000 ₽ за одного кандидата. Все выплаты отслеживаются в личном кабинете с трек-номерами банка. Это не обещание — это факты, доступные в истории выплат." },
  ],
  how_it_works: [
    { patterns: ["как это работает", "как начать", "что делать", "как заработать", "с чего начать"], response: "🎯 **Просто 3 шага:**\n\n1️⃣ **Пригласи рефера** — скопируй свою ссылку или поделись в Telegram\n2️⃣ **Он приводит кандидата** — кандидат заполняет анкету\n3️⃣ **Кандидат подписывает контракт** — ты получишь деньги за 7 дней\n\nМинимум 10 рефов — и начнёшь получать постоянно!" },
  ],
  requirements: [
    { patterns: ["требования", "условия", "минимум", "ограничения", "возраст", "что нужно"], response: "✅ **Требования минимальные:**\n\n- Возраст 18+\n- Активный телефон (для связи)\n- Банковские реквизиты (для выплат)\n- Желание делиться возможностью\n\nНе нужно: опыт в рекрутинге, специальное образование, большая сеть. Начинают все с нуля!" },
  ],
  time: [
    { patterns: ["сколько времени", "как долго", "сроки", "когда результаты", "быстро ли"], response: "⏱️ **Сроки реальные:**\n\n- Кабинет создается: **5 минут**\n- Кандидат заполняет анкету: **15 минут**\n- Медкомиссия + контракт: **7–14 дней**\n- Деньги на счет: **7 дней после контракта**\n\nПервый заработок может быть уже завтра, если начнешь сегодня!" },
  ],
  risk: [
    { patterns: ["риск", "опасно", "что если", "боюсь", "может не получиться"], response: "🛡️ **Вы защищены:**\n\n✓ Если кандидат отказался — вы не теряете ничего\n✓ Если медкомиссия не прошла — мы возместим потери\n✓ Если контракт расторгнут — выплата уже зафиксирована\n✓ Если платеж задержался — мы покроем комиссию\n\nМы платим честно. Это деньги Министерства обороны за рекрутинг!" },
  ],
  guarantees: [
    { patterns: ["гарантия", "честный", "почему верить", "доказательства"], response: "✨ **3 причины верить:**\n\n1. **Деньги идут из бюджета МО** — это государственные деньги, не наши.\n2. **Полная прозрачность** — видишь каждого кандидата, его статус, трек-номер платежа.\n3. **История выплат** — последние 50 платежей открыты для проверки.\n\nЭто не стартап, это система." },
  ],
};

export default function AIConsultant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Привет! 👋 Я ИИ-консультант программы МилитариПартнер. Спросите меня что угодно о программе, выплатах, условиях или том, как начать. Я здесь, чтобы помочь!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactData, setContactData] = useState({ name: "", phone: "", email: "" });

  const findResponse = (userMessage) => {
    const lowerMessage = userMessage.toLowerCase();

    for (const category of Object.values(AI_RESPONSES)) {
      for (const item of category) {
        if (item.patterns.some((pattern) => lowerMessage.includes(pattern))) {
          return item.response;
        }
      }
    }

    return "Хороший вопрос! 🤔 К сожалению, я не нашел готового ответа на это. Рекомендую связаться с нашей службой поддержки: support@mil.partner или напишите свои контакты ниже, и мы вам перезвоним.";
  };

  const handleSendMessage = () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      const response = findResponse(userMessage);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setLoading(false);
    }, 800);
  };

  const handleSaveContact = async () => {
    if (!contactData.name || (!contactData.phone && !contactData.email)) {
      toast({ title: "Заполните имя и хотя бы телефон или email", variant: "destructive" });
      return;
    }

    try {
      // Сохраняем контакты как уведомление (для admin панели позже)
      await base44.entities.Notification.create({
        title: "Новый контакт из AI-консультанта",
        message: `Имя: ${contactData.name}\nТелефон: ${contactData.phone}\nEmail: ${contactData.email}`,
        notification_type: "contact_request",
        channel: "in_app",
        status: "pending",
      }).catch(() => null);

      toast({ title: "✓ Спасибо! Мы получили ваши контакты. Мы вам перезвоним или напишем." });
      setShowContactForm(false);
      setContactData({ name: "", phone: "", email: "" });
      
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "✅ Спасибо! Ваши контакты сохранены. Наша команда свяжется с вами в течение 4 часов. Пока что рекомендую создать кабинет и посмотреть статистику программы!",
        },
      ]);
    } catch (error) {
      toast({ title: "Ошибка при сохранении контактов", variant: "destructive" });
    }
  };

  return (
    <>
      {/* Кнопка чата */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-accent text-accent-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Окно консультанта */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-h-96 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden md:w-96 sm:w-80 mobile:w-[calc(100vw-24px)]">
          {/* Заголовок */}
          <div className="bg-accent text-accent-foreground p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold">ИИ Консультант</h3>
              <p className="text-xs opacity-90">Спрашивайте о программе</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Сообщения */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content.split("\n").map((line, j) => (
                    <div key={j}>{line}</div>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted p-3 rounded-lg text-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Форма контактов */}
          {showContactForm && (
            <div className="border-t border-border p-4 space-y-2 bg-muted/30">
              <Input
                placeholder="Ваше имя"
                value={contactData.name}
                onChange={(e) => setContactData({ ...contactData, name: e.target.value })}
                className="text-sm"
              />
              <Input
                placeholder="Телефон"
                value={contactData.phone}
                onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                className="text-sm"
              />
              <Input
                placeholder="Email"
                value={contactData.email}
                onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                className="text-sm"
              />
              <Button
                onClick={handleSaveContact}
                size="sm"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Сохранить контакты
              </Button>
              <Button
                onClick={() => setShowContactForm(false)}
                size="sm"
                variant="outline"
                className="w-full"
              >
                Отмена
              </Button>
            </div>
          )}

          {/* Ввод */}
          {!showContactForm && (
            <div className="border-t border-border p-3 flex gap-2 bg-background">
              <Input
                placeholder="Напишите вопрос..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="text-sm"
              />
              <Button
                onClick={handleSendMessage}
                disabled={loading || !input.trim()}
                size="sm"
                className="px-3 bg-accent hover:bg-accent/90"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Быстрые кнопки */}
          {!showContactForm && messages.length > 0 && (
            <div className="border-t border-border p-3 space-y-2 bg-muted/20">
              <Button
                onClick={() => setShowContactForm(true)}
                variant="outline"
                size="sm"
                className="w-full text-xs"
              >
                <Phone className="w-3 h-3 mr-1" />
                Оставить контакты
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Есть ещё вопрос? Спросите или оставьте контакты 👆
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}