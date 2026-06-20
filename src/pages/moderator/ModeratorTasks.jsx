import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckSquare, Clock } from "lucide-react";
import moment from "moment";

const PRIORITY_COLORS = { low: "bg-gray-100 text-gray-600", medium: "bg-blue-100 text-blue-700", high: "bg-amber-100 text-amber-700", urgent: "bg-red-100 text-red-700" };
const PRIORITY_LABELS = { low: "Низкий", medium: "Средний", high: "Высокий", urgent: "Срочно" };

export default function ModeratorTasks() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");

  const load = () => base44.entities.ModeratorTask.list("-created_date").then(setTasks).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await base44.entities.ModeratorTask.update(id, { status });
    toast({ title: status === "done" ? "Задача выполнена!" : "Статус обновлён" });
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Мои задачи</h1>
      <div className="flex gap-2 mb-6 flex-wrap">
        {[["open","Открытые"],["in_progress","В работе"],["done","Выполненные"],["all","Все"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {l} {v !== "all" && `(${tasks.filter(t => t.status === v).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">Нет задач в этом статусе</div>}
      <div className="space-y-3">
        {filtered.map(t => {
          const overdue = t.due_at && new Date(t.due_at) < new Date() && t.status !== "done";
          return (
            <div key={t.id} className={`bg-card border rounded-xl p-5 ${overdue ? "border-red-300" : "border-border"}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium">{t.task_title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</span>
                    {overdue && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Просрочено</span>}
                  </div>
                  {t.task_description && <p className="text-sm text-muted-foreground">{t.task_description}</p>}
                  {t.due_at && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="w-3 h-3" /> До: {moment(t.due_at).format("DD.MM.YYYY")}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {t.status === "open" && <Button size="sm" variant="outline" onClick={() => updateStatus(t.id, "in_progress")}>В работу</Button>}
                  {(t.status === "open" || t.status === "in_progress") && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus(t.id, "done")}>
                      <CheckSquare className="w-4 h-4 mr-1" />Готово
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}