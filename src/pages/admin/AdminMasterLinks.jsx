import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Edit2, Power, X } from "lucide-react";

export default function AdminMasterLinks() {
  const { toast } = useToast();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", code: "", program_name: "", description: "", max_reward: 200000 });

  const load = () => base44.entities.MasterLink.list().then(setLinks).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const generateCode = () => {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join("");
  };

  const openCreate = () => { setEditing(null); setForm({ title: "", code: generateCode(), program_name: "", description: "", max_reward: 200000 }); setShowForm(true); };
  const openEdit = (ml) => { setEditing(ml); setForm({ title: ml.title, code: ml.code, program_name: ml.program_name || "", description: ml.description || "", max_reward: ml.max_reward }); setShowForm(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) await base44.entities.MasterLink.update(editing.id, form);
      else await base44.entities.MasterLink.create({ ...form, is_active: true });
      toast({ title: editing ? "Обновлено" : "Создано!" });
      setShowForm(false);
      load();
    } catch { toast({ title: "Ошибка", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const toggleActive = async (ml) => {
    await base44.entities.MasterLink.update(ml.id, { is_active: !ml.is_active });
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">Мастер-ссылки</h1>
        <Button onClick={openCreate} className="bg-primary font-medium"><Plus className="w-4 h-4 mr-2" />Создать</Button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-lg">{editing ? "Редактировать" : "Новая ссылка"}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div><Label>Название *</Label><Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} /></div>
              <div><Label>Код *</Label><Input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))} /></div>
              <div><Label>Программа</Label><Input value={form.program_name} onChange={e => setForm(f => ({...f, program_name: e.target.value}))} /></div>
              <div><Label>Описание</Label><Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
              <div><Label>Max Reward (₽) *</Label><Input type="number" value={form.max_reward} onChange={e => setForm(f => ({...f, max_reward: Number(e.target.value)}))} /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Отмена</Button>
              <Button className="flex-1 bg-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {links.map(ml => (
          <div key={ml.id} className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-heading font-bold">{ml.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ml.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  {ml.is_active ? "Активна" : "Отключена"}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Код: <code className="font-mono bg-muted px-1 rounded">{ml.code}</code> · Max: {(ml.max_reward || 0).toLocaleString()} ₽
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => openEdit(ml)}><Edit2 className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => toggleActive(ml)}><Power className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}