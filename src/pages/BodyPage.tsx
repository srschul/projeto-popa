import { useRef, useState } from 'react';
import { Camera, ImagePlus, Pencil, Plus, Ruler, Trash2 } from 'lucide-react';
import { Button, Card, CardTitle, ChartEmpty, EmptyState, ErrorBlock, Field, LoadingBlock, PageHeader, Segmented, Sheet } from '../components/ui';
import { AreaChartSimple } from '../components/charts';
import { useConfirm } from '../components/Confirm';
import { useEditors } from '../features/editors/EditorsProvider';
import { useAuth } from '../features/auth/AuthProvider';
import { deleteBody, deletePhoto, uploadPhoto, useBody, usePhotos, usePhotoUrls } from '../lib/data';
import { fmtDateBR, todayISO } from '../lib/dates';
import { fmtNumber } from '../lib/format';
import { BODY_METRICS, bodySeries, type BodyMetric } from '../lib/stats';
import { useAfterSave, useErrorToast } from '../lib/useSave';
import type { BodyEntry, ProgressPhoto } from '../lib/types';

export function BodyPage() {
  const { openBody } = useEditors();
  const q = useBody();
  const [metric, setMetric] = useState<BodyMetric>('weight_kg');
  const confirm = useConfirm();
  const afterSave = useAfterSave();
  const onError = useErrorToast();

  if (q.error) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingBlock />;

  const entries = q.data;
  const m = BODY_METRICS.find((x) => x.key === metric)!;
  const series = bodySeries(entries, metric);
  const first = series[0]?.value;
  const last = series.at(-1)?.value;
  const diff = series.length >= 2 ? Math.round((last! - first!) * 10) / 10 : null;
  const latest = entries[0];

  async function remove(e: BodyEntry) {
    if (!(await confirm({ title: 'Excluir registro?', text: `O registro corporal de ${fmtDateBR(e.date)} será removido.` }))) return;
    try { await deleteBody(e.id); await afterSave('Registro excluído'); } catch (err) { onError(err); }
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Acompanhamento físico" title="Seu corpo" subtitle="Observe tendências, não um número isolado."
        action={<Button variant="primary" small onClick={() => openBody()}><Plus size={15} /> Registrar</Button>} />

      {entries.length === 0 ? (
        <EmptyState icon={<Ruler size={22} />} title="Nenhuma medida registrada"
          text="Comece com o peso ou qualquer medida. O peso é só um dos indicadores: cintura, braço e fotos contam muito."
          action={<Button variant="primary" onClick={() => openBody()}>Registrar medidas</Button>} />
      ) : (
        <>
          <Card>
            <CardTitle right={<span className="text-xs text-mute">{fmtDateBR(latest.date)}</span>}>Último registro</CardTitle>
            <div className="grid grid-cols-3 gap-2">
              {BODY_METRICS.map((x) => {
                const row = entries.find((e) => e[x.key] !== null);
                return (
                  <div key={x.key} className="card-flat">
                    <div className="text-[11px] text-mute">{x.label}</div>
                    <div className="num mt-0.5 text-lg font-bold">{row ? fmtNumber(Number(row[x.key])) : '—'}<span className="ml-0.5 text-xs font-normal text-mute">{row ? x.unit : ''}</span></div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardTitle>Evolução</CardTitle>
            <div className="-mx-1 mb-3 overflow-x-auto px-1">
              <Segmented value={metric} onChange={setMetric} className="min-w-[420px]" options={BODY_METRICS.map((x) => ({ value: x.key, label: x.label }))} />
            </div>
            {series.length >= 2 ? (
              <>
                <AreaChartSimple data={series as never} dataKey="value" name={m.label} unit={m.unit} height={190} tight />
                <p className="mt-2 text-xs text-mute">
                  Do primeiro ao último registro: <b className="text-zinc-200">{diff! > 0 ? '+' : ''}{fmtNumber(diff!)} {m.unit}</b>. Variações pequenas do dia a dia são normais.
                </p>
              </>
            ) : <ChartEmpty text={`Registre ${m.label.toLowerCase()} em pelo menos duas datas para ver o gráfico.`} />}
          </Card>
        </>
      )}

      <PhotosSection />

      {entries.length > 0 && (
        <Card>
          <CardTitle>Histórico</CardTitle>
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="card-flat flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{fmtDateBR(e.date)}{e.weight_kg !== null && <span className="ml-2 text-popa-soft">{fmtNumber(Number(e.weight_kg))} kg</span>}</div>
                  <div className="truncate text-xs text-mute">
                    {BODY_METRICS.filter((x) => x.key !== 'weight_kg' && e[x.key] !== null).map((x) => `${x.label} ${fmtNumber(Number(e[x.key]))}`).join(' · ') || 'Somente peso'}
                  </div>
                </div>
                <button type="button" aria-label="Editar" onClick={() => openBody(e)} className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-200"><Pencil size={15} /></button>
                <button type="button" aria-label="Excluir" onClick={() => remove(e)} className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function PhotosSection() {
  const { user } = useAuth();
  const photosQ = usePhotos();
  const urlsQ = usePhotoUrls(photosQ.data);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const afterSave = useAfterSave();
  const onError = useErrorToast();
  const [pending, setPending] = useState<File | null>(null);
  const [date, setDate] = useState(todayISO());
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const photos = photosQ.data ?? [];
  const urls = urlsQ.data ?? {};

  async function upload() {
    if (!pending) return;
    setBusy(true);
    try {
      await uploadPhoto(pending, { date, label: label.trim() }, user!.id);
      setPending(null); setLabel('');
      await afterSave('Foto guardada com segurança');
    } catch (e) { onError(e); } finally { setBusy(false); }
  }

  async function remove(p: ProgressPhoto) {
    if (!(await confirm({ title: 'Excluir foto?', text: `A foto de ${fmtDateBR(p.date)} será apagada definitivamente.` }))) return;
    try { await deletePhoto(p); setCompare((c) => c.filter((id) => id !== p.id)); await afterSave('Foto excluída'); } catch (e) { onError(e); }
  }

  const toggle = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 2 ? [c[1], id] : [...c, id]));
  const pair = compare.map((id) => photos.find((p) => p.id === id)).filter(Boolean).sort((a, b) => a!.date.localeCompare(b!.date)) as ProgressPhoto[];

  return (
    <Card>
      <CardTitle right={
        <div className="flex gap-2">
          {photos.length >= 2 && <Button small variant="soft" disabled={compare.length !== 2} onClick={() => setShowCompare(true)}>Comparar ({compare.length}/2)</Button>}
          <Button small variant="soft" onClick={() => fileRef.current?.click()}><ImagePlus size={14} /> Foto</Button>
        </div>}>Fotos de evolução</CardTitle>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { setPending(e.target.files?.[0] ?? null); e.target.value = ''; }} />

      {photosQ.error ? <ErrorBlock error={photosQ.error} onRetry={() => photosQ.refetch()} />
        : photos.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Camera size={22} className="mb-2 text-popa" />
            <p className="max-w-xs text-sm text-mute">Suas fotos são privadas: só você acessa. Tire sempre sob luz e pose parecidas para comparar melhor.</p>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-zinc-500">Toque em duas fotos para comparar datas diferentes.</p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => {
                const sel = compare.includes(p.id);
                return (
                  <div key={p.id} className="group relative">
                    <button type="button" onClick={() => toggle(p.id)} aria-pressed={sel}
                      className={`block aspect-[3/4] w-full overflow-hidden rounded-xl border bg-ink-800 ${sel ? 'border-popa ring-2 ring-popa/40' : 'border-white/[0.07]'}`}>
                      {urls[p.storage_path] ? <img src={urls[p.storage_path]} alt={`Foto de ${fmtDateBR(p.date)}`} loading="lazy" className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-ink-600" />}
                    </button>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4 text-[10px] text-zinc-200">
                      {fmtDateBR(p.date)}{p.label && ` · ${p.label}`}
                    </div>
                    <button type="button" aria-label="Excluir foto" onClick={() => remove(p)} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-zinc-300 hover:text-red-300"><Trash2 size={13} /></button>
                  </div>
                );
              })}
            </div>
          </>
        )}

      <Sheet open={pending !== null} onClose={() => !busy && setPending(null)} title="Guardar foto"
        footer={<div className="flex gap-2"><Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>Cancelar</Button><Button variant="primary" className="flex-1" onClick={upload} disabled={busy}>{busy ? 'Enviando…' : 'Guardar foto'}</Button></div>}>
        <div className="space-y-4 pt-1">
          {pending && <img src={URL.createObjectURL(pending)} alt="Pré-visualização" className="mx-auto max-h-64 rounded-xl object-contain" />}
          <Field label="Data"><input className="input" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Rótulo (opcional)"><input className="input" placeholder="Frente, costas, lado…" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <p className="text-xs text-zinc-500">A imagem é reduzida antes do envio e guardada em um espaço privado, acessível só pela sua conta.</p>
        </div>
      </Sheet>

      <Sheet open={showCompare} onClose={() => setShowCompare(false)} title="Comparar fotos">
        <div className="grid grid-cols-2 gap-2 pb-4">
          {pair.map((p, i) => (
            <figure key={p.id}>
              <div className="aspect-[3/4] overflow-hidden rounded-xl bg-ink-700">{urls[p.storage_path] && <img src={urls[p.storage_path]} alt="" className="h-full w-full object-cover" />}</div>
              <figcaption className="mt-1.5 text-center text-xs text-mute"><b className="text-zinc-200">{i === 0 ? 'Antes' : 'Depois'}</b> · {fmtDateBR(p.date)}</figcaption>
            </figure>
          ))}
        </div>
      </Sheet>
    </Card>
  );
}
