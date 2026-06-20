import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Search, Power } from "lucide-react";
import moment from "moment";

const roleLabels = {
  super_admin: { label: "Супер-админ", color: "bg-purple-100 text-purple-700" },
  admin: { label: "Админ", color: "bg-blue-100 text-blue-700" },
  moderator: { label: "Модератор", color: "bg-indigo-100 text-indigo-700" },
  referrer: { label: "Реферал", color: "bg-teal-100 text-teal-700" },
  candidate: { label: "Кандидат", color: "bg-gray-100 text-gray-700" },
};

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const load = async () => {
    const data = await base44.entities.ReferralProfile.list();
    setUsers(data);
    setFiltered(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    let f = users;
    if (search) f = f.filter(u => u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.includes(search));
    if (roleFilter !== "all") f = f.filter(u => u.role === roleFilter);
    setFiltered(f);
  }, [search, roleFilter, users]);

  const toggleStatus = async (u) => {
    const next = u.status === "active" ? "inactive" : "active";
    await base44.entities.ReferralProfile.update(u.id, { status: next });
    toast({ title: `Статус изменён на: ${next}` });
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Пользователи ({filtered.length})</h1>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Поиск по имени или email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-10 px-3 border border-input rounded-md bg-background text-sm"
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="all">Все роли</option>
          {Object.entries(roleLabels).map(([v, l]) => <option key={v} value={v}>{l.label}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>{["Имя", "Email", "Роль", "Уровень", "Заработано", "Статус", ""].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(u => {
              const rl = roleLabels[u.role] || roleLabels.referrer;
              return (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${rl.color}`}>{rl.label}</span></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{u.level?.replace("_", " ") || "—"}</td>
                  <td className="px-4 py-3 font-medium">{(u.total_earned || 0).toLocaleString()} ₽</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {u.status === "active" ? "Активен" : "Неактивен"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={() => toggleStatus(u)}><Power className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}