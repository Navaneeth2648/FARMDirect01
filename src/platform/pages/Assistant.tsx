import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, Camera, MessageSquarePlus, RotateCcw, Send, Trash2, TriangleAlert } from 'lucide-react';
import { useAuth } from '../auth';
import { MedhaAvatar } from '../medha';
import { api, fmtDateTime } from '../api';
import { Badge, Button, ErrorBox, MicButton, PageHeader, Section, SetupNotice, SpeakButton, Spinner, Textarea, useAsync, useConfirm } from '../ui';
import { FarmSelect, useFarms } from '../shared';

const SUGGESTIONS: Record<string, string[]> = {
  farmer: [
    'Should I irrigate my crop this week?',
    'What should I watch for at the current stage of my crop?',
    'Should I sell my produce now or store it?',
    'Which government scheme helps with crop insurance?',
  ],
  buyer: [
    'What should I check before accepting a lot?',
    'How does grading work on FARMDirect?',
    'How do payments and disputes work?',
  ],
};

const QUICK_LINKS = [
  { label: 'Weather', to: '/weather' }, { label: 'Crop Doctor', to: '/crop-doctor' }, { label: 'Mandi prices', to: '/mandi' },
  { label: 'Nearby storage', to: '/storage' }, { label: 'Crop & pest guide', to: '/guides' }, { label: 'Schemes', to: '/schemes' },
];

function ActionLinks({ actions }: { actions?: { label: string; to: string }[] }) {
  if (!actions?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {actions.map((a) => <Link key={a.to} to={a.to} className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">{a.label}<ArrowRight className="h-3 w-3" aria-hidden /></Link>)}
    </div>
  );
}

export function AssistantPage() {
  const { user } = useAuth();
  const status = useAsync(() => api.get('/v1/assistant/status'));
  const [lastMsg, setLastMsg] = useState('');
  const convs = useAsync(() => api.get('/v1/assistant/conversations').then((r) => r.conversations));
  const farms = useFarms();
  const { ask, node } = useConfirm();
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [farmId, setFarmId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const open = async (id: string) => {
    setActive(id); setErr(null);
    const r = await api.get(`/v1/assistant/conversations/${id}`);
    setMessages(r.messages);
  };

  const send = async (e?: FormEvent, override?: string) => {
    e?.preventDefault();
    const msg = (override ?? text).trim();
    if (!msg) return;
    setBusy(true); setErr(null); setLastMsg(msg);
    setMessages((m) => [...m.filter((x) => !x.failed), { id: `tmp-${Date.now()}`, role: 'user', content: msg, sources: [] }]);
    setText('');
    try {
      const r = await api.post('/v1/assistant/messages', { conversation_id: active, farm_id: farmId || null, message: msg });
      if (!active) { setActive(r.conversation.id); convs.reload(); }
      setMessages((m) => m.map((x) => (x.failed ? { ...x, failed: false } : x)));
      setMessages((m) => [...m, r.message]);
    } catch (e) { setErr(e); setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, failed: true } : x))); convs.reload(); } finally { setBusy(false); }
  };

  return (
    <div>
      {node}
      <PageHeader title="Medha AI" icon={<MedhaAvatar size={28} />} subtitle="Ask in your language, by typing or speaking. Medha uses your farm, lots, offers, nearby storage, the real forecast and stored mandi prices, and shows where each fact came from." />
      {status.data && !status.data.configured && (
        <div className="mb-4 space-y-2">
          <SetupNotice service="Medha AI" setup={status.data.setup} />
          <div className="flex flex-wrap gap-1 text-xs"><span className="py-1 text-gray-600">Meanwhile, these work without AI:</span><ActionLinks actions={QUICK_LINKS} /></div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-4">
        <Section className="lg:col-span-1" title="Conversations" actions={<Button size="sm" variant="outline" onClick={() => { setActive(null); setMessages([]); }}><MessageSquarePlus className="h-4 w-4" /></Button>}>
          <ul className="space-y-1 text-sm">
            {(convs.data || []).map((c: any) => (
              <li key={c.id} className={`group flex items-center justify-between rounded-lg px-2 py-1.5 ${active === c.id ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                <button className="flex-1 truncate text-left" onClick={() => open(c.id)}>{c.title}<span className="block text-xs text-gray-400">{fmtDateTime(c.updated_at)}</span></button>
                <button aria-label="Delete conversation" className="p-1 text-gray-400 hover:text-red-600" onClick={async () => {
                  if (!(await ask('Delete conversation?', 'This permanently deletes the conversation.', { danger: true, label: 'Delete' }))) return;
                  await api.del(`/v1/assistant/conversations/${c.id}`); if (active === c.id) { setActive(null); setMessages([]); } convs.reload();
                }}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
            {convs.data?.length === 0 && <li className="text-gray-500">No conversations yet.</li>}
          </ul>
          {(convs.data || []).length > 0 && <button className="mt-3 text-xs text-red-700 underline" onClick={async () => {
            if (!(await ask('Delete all conversations?', 'This permanently deletes your whole assistant history.', { danger: true, label: 'Delete all' }))) return;
            await api.del('/v1/assistant/conversations'); setActive(null); setMessages([]); convs.reload();
          }}>Delete all history</button>}
        </Section>

        <Section className="lg:col-span-3">
          {farms.data && farms.data.length > 1 && (
            <div className="mb-3 max-w-xs"><FarmSelect farms={farms.data} value={farmId} onChange={setFarmId} /><p className="mt-1 text-xs text-gray-500">Farm used for context</p></div>
          )}
          <div className="flex h-[55vh] flex-col overflow-y-auto rounded-xl bg-gray-50 p-3" aria-live="polite">
            {messages.length === 0 && (
              <div className="m-auto max-w-md text-center">
                <MedhaAvatar size={72} className="mx-auto mb-3" />
                <p className="mb-1 text-lg font-bold text-gray-900">Namaskar! I am Medha.</p>
                <p className="mb-3 text-sm text-gray-600">Try one of these:</p>
                <div className="flex flex-col gap-2">{(SUGGESTIONS[user?.role === 'buyer' ? 'buyer' : 'farmer']).map((s) => <button key={s} onClick={() => send(undefined, s)} className="rounded-lg border bg-white px-3 py-2 text-left text-sm hover:border-emerald-400" disabled={busy}>{s}</button>)}</div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`mb-3 flex max-w-[90%] gap-2 ${m.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                {m.role === 'assistant' && <MedhaAvatar size={30} className="mt-0.5 shrink-0" />}
                <div className="min-w-0">
                <div className={`whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'bg-emerald-600 text-white' : 'border bg-white text-gray-800'}`}>{m.content}</div>
                {m.role === 'assistant' && (
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                    <Badge tone="purple">AI-generated</Badge>
                    {m.sources?.map((s: any, i: number) => <Badge key={i} tone="blue">{s.type}: {s.label}</Badge>)}
                    <SpeakButton text={m.content} />
                  </div>
                )}
                {m.role === 'assistant' && <ActionLinks actions={m.actions} />}
                {m.escalate ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-800"><TriangleAlert className="h-3 w-3" />This needs an expert. <Link className="underline" to="/experts">Ask an expert</Link></p>
                ) : null}
                </div>
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 self-start"><MedhaAvatar size={30} /><div className="rounded-2xl border bg-white px-4 py-2 text-sm text-gray-600"><Spinner /> Thinking…</div></div>}
            <div ref={endRef} />
          </div>
          {err && (
            <div className="mt-2 space-y-1">
              <ErrorBox error={err} />
              {err.code !== 'not_configured' && lastMsg && <Button size="sm" variant="outline" disabled={busy} onClick={() => send(undefined, lastMsg)}><RotateCcw className="mr-1 h-4 w-4" />Try again</Button>}
              <ActionLinks actions={err.details?.actions} />
            </div>
          )}
          <form onSubmit={send} className="mt-3 flex items-end gap-2">
            <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question…" aria-label="Your question"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <MicButton onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
            <Link to="/crop-doctor" aria-label="Check a crop photo in Crop Doctor" title="Check a crop photo in Crop Doctor" className="rounded-xl border-2 border-gray-200 bg-white p-2.5 text-gray-700 hover:bg-gray-50"><Camera className="h-5 w-5" /></Link>
            <Button type="submit" disabled={busy || !text.trim()} aria-label="Send"><Send className="h-5 w-5" /></Button>
          </form>
          <p className="mt-2 text-xs text-gray-500">Medha AI can make mistakes and cannot take actions for you — buttons open the right screen, where you confirm. It never gives pesticide doses. For serious problems, ask a verified expert.</p>
        </Section>
      </div>
    </div>
  );
}
