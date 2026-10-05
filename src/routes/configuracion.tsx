import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Settings, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useColegioConfig, DEFAULT_CONFIG, type ColegioConfig } from "@/lib/use-colegio-config";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/configuracion")({
  head: () => ({ meta: [{ title: "Configuración institucional — HorarioES" }] }),
  component: ConfiguracionPage,
});

function ConfiguracionPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const { data } = useColegioConfig();
  const [cfg, setCfg] = useState<ColegioConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setCfg(data); }, [data]);

  const save = async () => {
    if (!colegioId) return;
    setSaving(true);
    const { error } = await (supabase.from("colegios") as unknown as { update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }).update({ config: cfg }).eq("id", colegioId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["colegio-config", colegioId] });
    toast.success("Configuración guardada");
  };

  const upd = <K extends keyof ColegioConfig>(k: K, v: ColegioConfig[K]) => setCfg((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <PageHeader
        title="Configuración institucional"
        subtitle="Umbrales, escalas y períodos académicos"
        actions={<Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1.5" />{saving ? "Guardando…" : "Guardar"}</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={Settings} title="Umbrales de asistencia y alertas">
          <Field label="% mínimo de asistencia">
            <Input type="number" min={50} max={100} value={cfg.asistencia_min_pct}
              onChange={(e) => upd("asistencia_min_pct", Number(e.target.value))} />
          </Field>
          <Field label="% asistencia crítica (riesgo alto)">
            <Input type="number" min={0} max={100} value={cfg.riesgo_critico_pct}
              onChange={(e) => upd("riesgo_critico_pct", Number(e.target.value))} />
          </Field>
          <Field label="Días sin libro de clases para alerta">
            <Input type="number" min={1} value={cfg.alerta_libro_dias}
              onChange={(e) => upd("alerta_libro_dias", Number(e.target.value))} />
          </Field>
          <Field label="Atrasos para alerta (≥)">
            <Input type="number" min={1} value={cfg.atrasos_alerta}
              onChange={(e) => upd("atrasos_alerta", Number(e.target.value))} />
          </Field>
          <Field label="Retiros para alerta (≥)">
            <Input type="number" min={1} value={cfg.retiros_alerta}
              onChange={(e) => upd("retiros_alerta", Number(e.target.value))} />
          </Field>
        </Section>

        <Section title="Categorías de convivencia">
          <StringList values={cfg.categorias_convivencia} onChange={(v) => upd("categorias_convivencia", v)} placeholder="Nueva categoría" />
        </Section>

        <Section title="Tipos de anotación">
          <StringList values={cfg.tipos_anotacion} onChange={(v) => upd("tipos_anotacion", v)} placeholder="Tipo de anotación" />
        </Section>

        <Section title="Períodos académicos">
          <div className="space-y-2">
            {cfg.periodos.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-4" value={p.nombre} onChange={(e) => {
                  const arr = [...cfg.periodos]; arr[i] = { ...arr[i], nombre: e.target.value }; upd("periodos", arr);
                }} placeholder="Nombre" />
                <Input className="col-span-3" type="date" value={p.inicio} onChange={(e) => {
                  const arr = [...cfg.periodos]; arr[i] = { ...arr[i], inicio: e.target.value }; upd("periodos", arr);
                }} />
                <Input className="col-span-3" type="date" value={p.fin} onChange={(e) => {
                  const arr = [...cfg.periodos]; arr[i] = { ...arr[i], fin: e.target.value }; upd("periodos", arr);
                }} />
                <Button variant="ghost" size="icon" className="col-span-2" onClick={() => {
                  upd("periodos", cfg.periodos.filter((_, j) => j !== i));
                }}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() =>
              upd("periodos", [...cfg.periodos, { nombre: "", inicio: "", fin: "" }])
            }><Plus className="w-4 h-4 mr-1.5" />Agregar período</Button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Settings; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-primary" />}{title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
function StringList({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-surface-2 border border-border">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3 opacity-60" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) { onChange([...values, draft.trim()]); setDraft(""); } } }}
        />
        <Button variant="outline" size="sm" onClick={() => { if (draft.trim()) { onChange([...values, draft.trim()]); setDraft(""); } }}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
