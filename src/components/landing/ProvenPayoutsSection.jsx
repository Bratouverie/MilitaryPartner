import React from "react";
import { CheckCircle } from "lucide-react";

const payouts = [
  { name: "Иван П.", amount: "200 000", date: "15.06" },
  { name: "Сергей К.", amount: "180 000", date: "14.06" },
  { name: "Павел М.", amount: "165 000", date: "13.06" },
  { name: "Дмитрий Л.", amount: "150 000", date: "12.06" },
  { name: "Алексей В.", amount: "200 000", date: "11.06" },
];

export default function ProvenPayoutsSection() {
  return (
    <section className="py-20 bg-background">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-3">Доказано: реальные выплаты</h2>
        <p className="text-muted-foreground text-center mb-12 text-lg">Последние подтверждённые выплаты рефералам</p>
        <div className="space-y-3">
          {payouts.map((p, i) => (
            <div key={i} className="flex items-center justify-between bg-card border border-border rounded-xl px-6 py-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                <span className="font-medium">{p.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-heading font-bold text-lg">{p.amount} ₽</span>
                <span className="text-sm text-muted-foreground">{p.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}