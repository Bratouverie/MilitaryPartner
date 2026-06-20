import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import moment from "moment";

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.ActionLog.list("-created_date", 100).then(setLogs).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Журнал действий</h1>
      {logs.length === 0 && <div className="text-center py-12 text-muted-foreground">Логи пусты</div>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>{["Время","Действие","Сущность","ID сущности","Роль"].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map(l => (
              <tr key={l.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{moment(l.created_date).format("DD.MM HH:mm")}</td>
                <td className="px-4 py-3 font-medium">{l.action_type}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.entity_type || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.entity_id ? l.entity_id.slice(0, 8) + "…" : "—"}</td>
                <td className="px-4 py-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{l.actor_role || "—"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}