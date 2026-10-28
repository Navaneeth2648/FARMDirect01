import { useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api, fmtDate, qs, today } from '../api';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, Section, Select, Skeleton, Tabs, Textarea, useAsync, useToast } from '../ui';
import { useCropName } from '../shared';

const CAT_TONE: Record<string, any> = { irrigation: 'blue', fertilizer: 'amber', scouting: 'purple', harvest: 'green', stage: 'gray', custom: 'gray', spraying: 'red', weeding: 'green', sowing: 'green' };

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function CalendarPage() {
  const toast = useToast();
  const cropName = useCropName();
  const [view, setView] = useState<'list' | 'month'>('list');
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [filter, setFilter] = useState<'pending' | 'overdue' | 'done' | 'all'>('pending');
  const range = useMemo(() => {
    if (view === 'month') {
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      return { from: ymd(month), to: ymd(end) };
    }
    const from = new Date(); from.setDate(from.getDate() - 30);
    const to = new Date(); to.setDate(to.getDate() + 60);
    return { from: ymd(from), to: ymd(to) };
  }, [view, month]);
  const tasks = useAsync(() => api.get(`/v1/tasks${qs(range)}`).then((r) => r.tasks), [range.from, range.to]);
  const cycles = useAsync(() => api.get('/v1/cycles?status=active').then((r) => r.cycles));
  const [edit, setEdit] = useState<any>(null);

  const update = async (t: any, patch: any) => {
    try { await api.patch(`/v1/tasks/${t.id}`, patch); tasks.reload(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  const filtered = (tasks.data || []).filter((t: any) =>
    filter === 'all' ? true : filter === 'overdue' ? t.overdue : filter === 'done' ? t.status === 'done' : t.status === 'pending');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const body = { title: edit.title, notes: edit.notes || null, due_date: edit.due_date, category: edit.category, crop_cycle_id: edit.crop_cycle_id || null, repeat_days: edit.repeat_days ? Number(edit.repeat_days) : null };
    try {
      if (edit.id) await api.patch(`/v1/tasks/${edit.id}`, body);
      else await api.post('/v1/tasks', body);
      toast('Task saved'); setEdit(null); tasks.reload();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const row = (t: any) => (
    <li key={t.id} className="flex items-start gap-3 py-2.5">
      <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-600" checked={t.status === 'done'} aria-label={`Mark ${t.title} done`}
        onChange={(e) => update(t, { status: e.target.checked ? 'done' : 'pending' })} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${t.status === 'done' ? 'text-gray-400 line-through' : ''}`}>{t.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
          <Badge tone={CAT_TONE[t.category]}>{t.category}</Badge>
          {t.crop_name && <span>{cropName(undefined, t.crop_name)}</span>}
          {t.weather_sensitive ? <span>· check forecast</span> : null}
          {t.repeat_days && <span>· repeats every {t.repeat_days} days</span>}
          {t.notes && <span className="w-full text-gray-600">{t.notes}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge tone={t.overdue ? 'red' : t.status === 'done' ? 'green' : 'gray'}>{t.overdue ? 'Overdue' : fmtDate(t.due_date)}</Badge>
        <div className="flex gap-2 text-xs">
          <button className="text-emerald-700 underline" onClick={() => setEdit({ ...t })}>Edit</button>
          {t.status === 'pending' && <button className="text-gray-600 underline" onClick={() => update(t, { status: 'skipped' })}>Skip</button>}
        </div>
      </div>
    </li>
  );

  // Month grid
  const days: (Date | null)[] = [];
  if (view === 'month') {
    const first = (month.getDay() + 6) % 7; // Monday first
    for (let i = 0; i < first; i++) days.push(null);
    const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= n; d++) days.push(new Date(month.getFullYear(), month.getMonth(), d));
  }

  return (
    <div>
      <PageHeader title="Crop Calendar" icon={<CalendarDays />} subtitle="Suggested schedule from your crops' sowing dates. Edit, reschedule or add your own tasks."
        actions={<Button onClick={() => setEdit({ title: '', due_date: today(), category: 'custom' })}><Plus className="mr-1 h-4 w-4" />Task</Button>} />
      <Tabs value={view} onChange={setView} tabs={[{ id: 'list', label: 'List' }, { id: 'month', label: 'Month' }]} />
      {tasks.loading ? <Skeleton lines={8} /> : tasks.error ? <ErrorBox error={tasks.error} onRetry={tasks.reload} /> : view === 'list' ? (
        <Section actions={
          <Select aria-label="Filter" value={filter} onChange={(e) => setFilter(e.target.value as any)} className="w-40"
            options={[{ value: 'pending', label: 'Pending' }, { value: 'overdue', label: 'Overdue' }, { value: 'done', label: 'Completed' }, { value: 'all', label: 'All' }]} />
        } title="Last 30 days – next 60 days">
          {filtered.length === 0 ? <Empty title="No tasks here">Add a crop on My Farm to generate a schedule.</Empty> : <ul className="divide-y">{filtered.map(row)}</ul>}
        </Section>
      ) : (
        <Section title={month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} actions={
          <div className="flex gap-1">
            <Button size="sm" variant="outline" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>}>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              if (!d) return <div key={i} />;
              const key = ymd(d);
              const dayTasks = (tasks.data || []).filter((t: any) => t.due_date === key);
              return (
                <div key={i} className={`min-h-20 rounded-lg border p-1 text-left text-xs ${key === today() ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100'}`}>
                  <p className="font-semibold">{d.getDate()}</p>
                  {dayTasks.slice(0, 3).map((t: any) => (
                    <button key={t.id} onClick={() => setEdit({ ...t })} className={`mt-0.5 block w-full truncate rounded px-1 text-left ${t.status === 'done' ? 'bg-gray-100 text-gray-400 line-through' : t.overdue ? 'bg-red-100 text-red-800' : 'bg-sky-50 text-sky-900'}`}>{t.title}</button>
                  ))}
                  {dayTasks.length > 3 && <p className="text-gray-500">+{dayTasks.length - 3} more</p>}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit task' : 'New task'}>
        {edit && (
          <form className="space-y-3" onSubmit={save}>
            <Field label="Task" required>{(id) => <Input id={id} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due date" required>{(id) => <Input id={id} type="date" value={edit.due_date} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} required />}</Field>
              <Field label="Type">{(id) => <Select id={id} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} options={Object.keys(CAT_TONE).map((c) => ({ value: c, label: c }))} />}</Field>
              {!edit.id && <Field label="Crop">{(id) => <Select id={id} value={edit.crop_cycle_id || ''} onChange={(e) => setEdit({ ...edit, crop_cycle_id: e.target.value })} placeholder="None" options={(cycles.data || []).map((c: any) => ({ value: c.id, label: `${c.crop_name} – ${c.farm_name}` }))} />}</Field>}
              <Field label="Repeat every (days)">{(id) => <Input id={id} type="number" min="1" max="365" value={edit.repeat_days ?? ''} onChange={(e) => setEdit({ ...edit, repeat_days: e.target.value })} />}</Field>
            </div>
            <Field label="Notes">{(id) => <Textarea id={id} value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />}</Field>
            <div className="flex justify-between">
              {edit.id ? <Button type="button" variant="ghost" className="text-red-700" onClick={async () => { await api.del(`/v1/tasks/${edit.id}`); setEdit(null); tasks.reload(); }}>Delete</Button> : <span />}
              <Button type="submit">Save</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
