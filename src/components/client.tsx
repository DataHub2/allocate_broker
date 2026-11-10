"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction, finishQuestionsAction, reviseBriefAction, saveAnswerAction, saveBriefAction } from "@/app/actions";
import { BASIS_LABEL, type Brief, formatSek, quoteLines } from "@/lib/brief";
import { TRADE_LABEL, type Trade } from "@/lib/job-requirements";
import type { FileMeta, QuestionRow } from "@/lib/marketplace";
import { clearDraft, loadDraft, saveDraft, uploadFile } from "@/lib/draft";
import { detectJob } from "@/lib/detect-job";
import { HouseSection } from "./house-section";
import { ActionForm, Choice, Field, TextArea, type FormState } from "./forms";

function joinTrades(trades: string[]): string {
  if (trades.length < 2) return trades[0] ?? "";
  return `${trades.slice(0, -1).join(", ")} och ${trades[trades.length - 1]}`;
}

function Van({ index, trade }: { index: number; trade: string | undefined }) {
  // Keeps its label while driving away.
  const label = useRef(trade);
  if (trade) label.current = trade;
  return (
    <svg className={trade ? "van on" : "van"} style={{ ["--i" as string]: index }} viewBox="0 0 170 84" aria-hidden="true" focusable="false">
      <g className="van-body">
        <path d="M30 8h78v10H30z" className="van-ladder" />
        <path d="M6 66V30c0-7 5-12 12-12h86c5 0 9 2 12 6l20 22 20 6c6 2 9 6 9 12v6c0 3-2 5-5 5H11c-3 0-5-2-5-5Z" className="van-shell" />
        <path d="M112 26h6l17 20h-23z" className="van-window" />
        <text x="16" y="52" className="van-label">{label.current}</text>
      </g>
      <g className="wheel" style={{ transformOrigin: "42px 68px" }}><circle cx="42" cy="68" r="13" /><path d="M42 57v22M31 68h22" /></g>
      <g className="wheel" style={{ transformOrigin: "132px 68px" }}><circle cx="132" cy="68" r="13" /><path d="M132 57v22M121 68h22" /></g>
    </svg>
  );
}

export function LiveHero({ header }: { header: ReactNode }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const [photos, setPhotos] = useState<{ id: string; file: File; url: string }[]>([]);
  const area = useRef<HTMLTextAreaElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const job = useMemo(() => detectJob(text), [text]);

  function add(files: FileList | null) {
    if (!files) return;
    const next = [...files].filter((f) => f.type.startsWith("image/")).map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    setPhotos((p) => [...p, ...next].slice(0, 20));
    if (input.current) input.current.value = "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) {
      setError(true);
      area.current?.focus();
      return;
    }
    await saveDraft({ description: text.trim(), files: photos.map((p) => p.file) });
    router.push("/nytt-projekt");
  }

  return (
    <div className="hero dark">
      <HouseSection zones={job.zones} />
      {header}
      <main id="innehall" className="wrap hero-body">
        <form onSubmit={submit} noValidate className="hero-form">
          <h1><label htmlFor={id}>Vad ska göras hemma hos dig?</label></h1>
          <textarea
            id={id} ref={area} rows={3} value={text} onChange={(e) => { setText(e.target.value); if (e.target.value.trim()) setError(false); }}
            aria-invalid={error || undefined} aria-describedby={`${id}-h${error ? ` ${id}-e` : ""}`}
            placeholder="Vi vill renovera badrummet på cirka 6 kvm. Nytt golv, kakel och dusch. Huset är från 1974."
          />
          {error && <p className="field-error on-dark" id={`${id}-e`}>Beskriv jobbet med några ord först.</p>}
          <p className="help on-dark" id={`${id}-h`}>Du får frågor som passar just ditt jobb. Sedan räknar högst tre företag per yrke på det.</p>
          <p className="hero-guess" aria-live="polite">{job.trades.length ? `Låter som ett jobb för ${joinTrades(job.trades)}` : ""}</p>
          {photos.length > 0 && (
            <ul className="thumbs" aria-label="Valda bilder">
              {photos.map((p, i) => (
                <li key={p.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Vald bild ${i + 1}`} />
                  <button type="button" className="thumb-remove" aria-label={`Ta bort bild ${i + 1}`} onClick={() => { URL.revokeObjectURL(p.url); setPhotos((all) => all.filter((x) => x.id !== p.id)); }}>×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="row">
            <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => add(e.target.files)} />
            <button type="submit" className="btn btn-signal">Fortsätt</button>
            <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()}>Lägg till bilder</button>
          </div>
        </form>
      </main>
      <div className="road" aria-hidden="true">
        {[0, 1, 2].map((i) => <Van key={i} index={i} trade={job.trades[i]} />)}
      </div>
    </div>
  );
}

const MOTION_KEY = "allocate:motion";

/** Reveals sections on scroll, drives the tape measure, and honours the visitor's choice to stop movement. */
export function PageMotion() {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(MOTION_KEY); } catch {}
    if (stored === "off") { document.documentElement.dataset.motion = "off"; setPaused(true); }
    document.documentElement.classList.add("motion-ready");

    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        seen.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -12% 0px" });
    document.querySelectorAll("[data-reveal]").forEach((el) => seen.observe(el));

    const tapes = [...document.querySelectorAll<HTMLElement>("[data-tape]")];
    let frame = 0;
    const update = () => {
      frame = 0;
      for (const tape of tapes) {
        const box = tape.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (innerHeight * 0.75 - box.top) / box.height));
        tape.style.setProperty("--p", progress.toFixed(3));
      }
    };
    const onScroll = () => { frame ||= requestAnimationFrame(update); };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      seen.disconnect();
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  function toggle() {
    const next = !paused;
    setPaused(next);
    if (next) document.documentElement.dataset.motion = "off";
    else delete document.documentElement.dataset.motion;
    try { localStorage.setItem(MOTION_KEY, next ? "off" : "on"); } catch {}
  }

  return <button type="button" className="btn-text motion-toggle" aria-pressed={paused} onClick={toggle}>Stäng av rörelser</button>;
}

export function NewProject() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "empty" | "saving">("checking");
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const started = useRef(false);

  async function create(description: string, files: File[]) {
    setState("saving");
    const result = await createProjectAction(description);
    if (!result.id) {
      setError(result.error ?? "Jobbet kunde inte sparas. Försök igen.");
      setState("empty");
      return;
    }
    await Promise.allSettled(files.map((file) => uploadFile(result.id!, file, "photo", null)));
    await clearDraft().catch(() => undefined);
    router.replace(`/projekt/${result.id}`);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadDraft()
      .then((draft) => (draft?.description ? create(draft.description, draft.files) : setState("empty")))
      .catch(() => setState("empty"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state !== "empty") return <p role="status">Sparar ditt jobb.</p>;
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); void create(text, []); }}>
      <div className="field">
        <label htmlFor="beskrivning">Vad ska göras?</label>
        <textarea id="beskrivning" rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-describedby={error ? "fel" : undefined} aria-invalid={error ? true : undefined} />
        {error && <p className="field-error" id="fel">{error}</p>}
      </div>
      <button type="submit" className="btn btn-primary">Fortsätt</button>
    </form>
  );
}

interface Upload { key: string; id?: string; name: string; state: "uploading" | "done" | "failed"; error?: string; file?: File }

export function Uploader({ projectId, kind = "photo", questionId = null, initial, label }: { projectId: string; kind?: "photo" | "drawing"; questionId?: string | null; initial: FileMeta[]; label: string }) {
  const [items, setItems] = useState<Upload[]>(initial.map((f) => ({ key: f.id, id: f.id, name: f.name, state: "done" })));
  const picker = useId();
  const camera = useId();

  function patch(key: string, change: Partial<Upload>) {
    setItems((all) => all.map((i) => (i.key === key ? { ...i, ...change } : i)));
  }

  async function send(key: string, file: File) {
    patch(key, { state: "uploading", error: undefined });
    try {
      const saved = await uploadFile(projectId, file, kind, questionId);
      patch(key, { state: "done", id: saved.id, name: saved.name });
    } catch (error) {
      patch(key, { state: "failed", error: (error as Error).message, file });
    }
  }

  function add(files: FileList | null) {
    if (!files) return;
    for (const file of files) {
      const key = crypto.randomUUID();
      setItems((all) => [...all, { key, name: file.name, state: "uploading", file }]);
      void send(key, file);
    }
  }

  async function remove(item: Upload) {
    if (item.id) await fetch(`/api/filer/${item.id}`, { method: "DELETE" });
    setItems((all) => all.filter((i) => i.key !== item.key));
  }

  return (
    <div className="uploader">
      <div className="row">
        <input id={picker} type="file" className="sr-only peer" accept={kind === "photo" ? "image/*" : "application/pdf"} multiple onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <label htmlFor={picker} className="btn btn-secondary">{label}</label>
        {kind === "photo" && (
          <span className="camera-only">
            <input id={camera} type="file" className="sr-only peer" accept="image/*" capture="environment" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
            <label htmlFor={camera} className="btn btn-secondary">Ta foto</label>
          </span>
        )}
      </div>
      {items.length > 0 && (
        <ul className="uploads">
          {items.map((item, index) => (
            <li key={item.key}>
              {item.id && kind === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/filer/${item.id}`} alt={`Uppladdad bild ${index + 1}`} />
              ) : (
                <span className="file-name">{item.name}</span>
              )}
              <span aria-live="polite" className={item.state === "failed" ? "field-error" : "help"}>
                {item.state === "uploading" ? "Laddar upp" : item.state === "failed" ? item.error : "Sparad"}
              </span>
              {item.state === "failed" && item.file && <button type="button" className="btn-text" onClick={() => void send(item.key, item.file!)}>Försök igen</button>}
              <button type="button" className="btn-text" aria-label={`Ta bort ${item.name}`} onClick={() => void remove(item)}>Ta bort</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionField({ q, projectId, files }: { q: QuestionRow; projectId: string; files: FileMeta[] }) {
  const [value, setValue] = useState<string | string[]>(q.answer ?? (q.input_type === "multi" ? [] : ""));
  const [unknown, setUnknown] = useState(q.answer_unknown);
  const [status, setStatus] = useState("");
  const id = useId();

  async function persist(next: string | string[] | null, nextUnknown: boolean) {
    setStatus("Sparar");
    const ok = await saveAnswerAction(q.id, next, nextUnknown);
    setStatus(ok ? "Sparat" : "Kunde inte spara. Försök igen.");
  }
  const setAndSave = (next: string | string[]) => {
    setValue(next);
    void persist(next, false);
    setUnknown(false);
  };

  const label = `${q.label}${q.unit ? ` (${q.unit})` : ""}`;
  const isGroup = q.input_type === "single" || q.input_type === "multi";
  const Wrapper = isGroup ? "fieldset" : "div";

  return (
    <Wrapper className="field question" aria-describedby={`${id}-r`}>
      {isGroup ? <legend>{label}</legend> : q.input_type === "photo" ? <p className="label">{label}</p> : <label htmlFor={id}>{label}</label>}
      <p className="help" id={`${id}-r`}>{q.reason}</p>
      {q.measure_help && <details className="how"><summary>Så mäter du</summary><p>{q.measure_help}</p></details>}

      {q.input_type === "number" && <input id={id} inputMode="decimal" value={value as string} disabled={unknown} onChange={(e) => setValue(e.target.value)} onBlur={() => void persist((value as string) || null, unknown)} aria-describedby={`${id}-r`} />}
      {q.input_type === "text" && <input id={id} value={value as string} disabled={unknown} onChange={(e) => setValue(e.target.value)} onBlur={() => void persist((value as string) || null, unknown)} aria-describedby={`${id}-r`} />}
      {q.input_type === "longtext" && <textarea id={id} rows={3} value={value as string} disabled={unknown} onChange={(e) => setValue(e.target.value)} onBlur={() => void persist((value as string) || null, unknown)} aria-describedby={`${id}-r`} />}
      {q.input_type === "single" && (
        <div className="choice-options">
          {q.options.map((o) => (
            <label key={o} className="choice-option">
              <input type="radio" name={q.id} checked={value === o} disabled={unknown} onChange={() => setAndSave(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )}
      {q.input_type === "multi" && (
        <div className="choice-options">
          {q.options.map((o) => {
            const list = value as string[];
            return (
              <label key={o} className="choice-option">
                <input type="checkbox" checked={list.includes(o)} disabled={unknown} onChange={() => setAndSave(list.includes(o) ? list.filter((x) => x !== o) : [...list, o])} />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      )}
      {q.input_type === "photo" && <Uploader projectId={projectId} questionId={q.id} initial={files.filter((f) => f.question_id === q.id)} label="Välj bild" />}

      <label className="choice-option unknown">
        <input type="checkbox" checked={unknown} onChange={(e) => { setUnknown(e.target.checked); void persist(e.target.checked ? null : (value as string) || null, e.target.checked); }} />
        <span>{q.input_type === "photo" ? "Kan inte ta bild" : "Vet inte"}</span>
      </label>
      <p className="status" aria-live="polite">{status}</p>
    </Wrapper>
  );
}

export function QuestionsForm({ projectId, questions, files }: { projectId: string; questions: QuestionRow[]; files: FileMeta[] }) {
  const [state, action, pending] = useActionState(finishQuestionsAction.bind(null, projectId) as (s: FormState) => Promise<FormState>, {});
  const topics = [...new Set(questions.map((q) => q.topic))];
  const allowed = questions.some((q) => q.input_type === "photo");
  return (
    <div>
      {topics.map((topic) => (
        <section key={topic} className="question-group">
          <h2>{topic}</h2>
          {topic === "Bilder" && allowed && <p className="help">Lägg gärna ett måttband i bilden. Kontrollera att inga namn eller adresser syns.</p>}
          {questions.filter((q) => q.topic === topic).map((q) => <QuestionField key={q.id} q={q} projectId={projectId} files={files} />)}
        </section>
      ))}
      <form action={action}>
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        <p className="help">Frågor du lämnar tomma räknas som att du inte vet. Företagen ser det och kan fråga vid besöket.</p>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Vänta" : "Skriv underlaget"}</button>
        <p className="status" aria-live="polite">{pending ? "Går igenom dina svar och bilder. Det kan ta upp till en minut." : ""}</p>
      </form>
    </div>
  );
}

export function BriefEditor({ projectId, initial }: { projectId: string; initial: Brief }) {
  const [brief, setBrief] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  useEffect(() => setBrief(initial), [initial]);

  async function commit(next: Brief) {
    setBrief(next);
    setStatus("Sparar");
    const result = await saveBriefAction(projectId, next);
    setStatus(result.error ?? "Sparat");
  }
  const updateItem = (g: number, i: number, change: Partial<Brief["scope"][0]["items"][0]>) => {
    setBrief((b) => ({ ...b, scope: b.scope.map((group, gi) => (gi !== g ? group : { ...group, items: group.items.map((item, ii) => (ii !== i ? item : { ...item, ...change })) })) }));
  };
  const remove = (g: number, i: number) => void commit({ ...brief, scope: brief.scope.map((group, gi) => (gi !== g ? group : { ...group, items: group.items.filter((_, ii) => ii !== i) })) });
  const addItem = (g: number) => {
    const key = `${g}:${brief.scope[g].items.length}`;
    setBrief((b) => ({ ...b, scope: b.scope.map((group, gi) => (gi !== g ? group : { ...group, items: [...group.items, { task: "Nytt moment", detail: "", quantity: null, unit: null, basis: "customer" }] })) }));
    setEditing(key);
  };

  const [state, action, pending] = useActionState(reviseBriefAction.bind(null, projectId) as (s: FormState, d: FormData) => Promise<FormState>, {});

  return (
    <div>
      <article className="doc">
        <h2>{brief.title}</h2>
        <p>{brief.summary}</p>
        {brief.scope.map((group, g) => (
          <section key={group.trade}>
            <h3>{TRADE_LABEL[group.trade as Trade]}</h3>
            <ul className="doc-items">
              {group.items.map((item, i) => {
                const key = `${g}:${i}`;
                return (
                  <li key={key} className={item.basis === "assumption" ? "assumption" : undefined}>
                    {editing === key ? (
                      <div className="form">
                        <div className="field"><label htmlFor={`t${key}`}>Moment</label><input id={`t${key}`} value={item.task} onChange={(e) => updateItem(g, i, { task: e.target.value })} /></div>
                        <div className="field"><label htmlFor={`d${key}`}>Detaljer</label><textarea id={`d${key}`} rows={2} value={item.detail} onChange={(e) => updateItem(g, i, { detail: e.target.value })} /></div>
                        <div className="row">
                          <div className="field"><label htmlFor={`q${key}`}>Antal</label><input id={`q${key}`} value={item.quantity ?? ""} onChange={(e) => updateItem(g, i, { quantity: e.target.value || null })} /></div>
                          <div className="field"><label htmlFor={`u${key}`}>Enhet</label><input id={`u${key}`} value={item.unit ?? ""} onChange={(e) => updateItem(g, i, { unit: e.target.value || null })} /></div>
                        </div>
                        <button type="button" className="btn btn-secondary" onClick={() => { const next = { ...brief, scope: brief.scope.map((grp, gi) => (gi !== g ? grp : { ...grp, items: grp.items.map((it, ii) => (ii !== i ? it : { ...it, basis: "customer" as const })) })) }; setEditing(null); void commit(next); }}>Klar</button>
                      </div>
                    ) : (
                      <>
                        <p className="doc-task">{item.task}{item.quantity && <span>, {item.quantity} {item.unit ?? ""}</span>}</p>
                        {item.detail && <p>{item.detail}</p>}
                        <p className="doc-meta">
                          <span className="basis">{BASIS_LABEL[item.basis]}</span>
                          <button type="button" className="btn-text" aria-label={`Ändra ${item.task}`} onClick={() => setEditing(key)}>Ändra</button>
                          <button type="button" className="btn-text" aria-label={`Ta bort ${item.task}`} onClick={() => remove(g, i)}>Ta bort</button>
                        </p>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn-text" onClick={() => addItem(g)}>Lägg till moment i {TRADE_LABEL[group.trade as Trade].toLowerCase()}</button>
          </section>
        ))}
      </article>
      <p className="status" aria-live="polite">{status}</p>
      <section className="panel">
        <h3>Behöver något ändras mer?</h3>
        <form action={action} className="form">
          <div className="field">
            <label htmlFor="instruction">Skriv vad som ska ändras</label>
            <textarea id="instruction" name="instruction" rows={2} aria-invalid={state.fields?.instruction ? true : undefined} aria-describedby={state.fields?.instruction ? "instruction-e" : undefined} />
            {state.fields?.instruction && <p className="field-error" id="instruction-e">{state.fields.instruction}</p>}
          </div>
          {state.error && !state.fields?.instruction && <p className="form-error" role="alert">{state.error}</p>}
          {state.message && <p className="form-ok" role="status">{state.message}</p>}
          <button type="submit" className="btn btn-secondary" disabled={pending}>{pending ? "Vänta" : "Skriv om underlaget"}</button>
          <p className="status" aria-live="polite">{pending ? "Skriver om underlaget. Det kan ta upp till en minut." : ""}</p>
        </form>
      </section>
    </div>
  );
}

export function ApproveForm({ action }: { action: (s: FormState, d: FormData) => Promise<FormState> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <ActionForm action={action} submit="" hideSubmit pendingText="Skickar underlaget och letar företag." id="godkann">
      <fieldset className="field">
        <legend>När kan ett företag komma på besök?</legend>
        <p className="help">Företagen bokar direkt på en av tiderna, så slipper ni ringa runt. Ange minst en.</p>
        <div className="slots">
          {[1, 2, 3, 4].map((n) => (
            <div className="field" key={n}><label htmlFor={`slot${n}`}>Tid {n}</label><input id={`slot${n}`} type="datetime-local" name="slots" /></div>
          ))}
        </div>
      </fieldset>
      <Choice name="promise" multiple label="Ett löfte till företagen" options={[{ value: "ja", label: "Jag svarar ja eller nej till varje företag som lämnar offert" }]} help="Hantverkare lägger tid på ditt jobb. De ska få veta hur det gick." />
      <button type="button" className="btn btn-primary" onClick={() => dialog.current?.showModal()}>Godkänn och skicka till företag</button>
      <dialog ref={dialog} className="dialog" aria-labelledby="dlg-t">
        <h2 id="dlg-t">Skicka underlaget?</h2>
        <p>Företagen får se jobbet, dina bilder och orten. De får inte se din adress eller ditt telefonnummer förrän du väljer att gå vidare med dem.</p>
        <p>Kontrollera att inga namn eller andra privata uppgifter syns på bilderna.</p>
        <div className="row">
          <button type="submit" form="godkann" className="btn btn-primary" onClick={() => dialog.current?.close()}>Skicka till företag</button>
          <button type="button" className="btn btn-secondary" onClick={() => dialog.current?.close()}>Avbryt</button>
        </div>
      </dialog>
    </ActionForm>
  );
}

export function QuoteForm({ action, brief, trades, wantsRot, rotRate, rotCap }: { action: (s: FormState, d: FormData) => Promise<FormState>; brief: Brief; trades: Trade[]; wantsRot: boolean; rotRate: number; rotCap: number }) {
  const lines = quoteLines(brief, trades);
  const [amounts, setAmounts] = useState<Record<string, { a: number; l: number }>>({});
  const set = (ref: string, change: Partial<{ a: number; l: number }>) => setAmounts((all) => ({ ...all, [ref]: { ...(all[ref] ?? { a: 0, l: 0 }), ...change } }));
  const total = Object.values(amounts).reduce((sum, v) => sum + v.a, 0);
  const labour = Object.values(amounts).reduce((sum, v) => sum + v.l, 0);
  const rot = wantsRot ? Math.min(Math.round(labour * rotRate), rotCap) : 0;
  return (
    <ActionForm action={action} submit="Skicka offerten" pendingText="Skickar offerten.">
      <p className="help">Alla företag prissätter samma rader, så kunden kan jämföra. Belopp inklusive moms.</p>
      {lines.map((line) => (
        <fieldset className="quote-line field" key={line.ref}>
          <legend>{TRADE_LABEL[line.trade as Trade]}: {line.task}</legend>
          <div className="row">
            <Field name={`amount:${line.ref}`} label="Pris, kr" inputMode="numeric" />
            <Field name={`labour:${line.ref}`} label="Varav arbete, kr" inputMode="numeric" />
          </div>
          <TrackAmounts refName={line.ref} set={set} />
        </fieldset>
      ))}
      <dl className="facts">
        <div><dt>Summa</dt><dd>{formatSek(total)}</dd></div>
        {wantsRot && <div><dt>ROT-avdrag</dt><dd>{formatSek(rot)}</dd></div>}
        <div><dt>Kunden betalar</dt><dd>{formatSek(total - rot)}</dd></div>
      </dl>
      <Choice name="price_model" label="Prismodell" options={[{ value: "fixed", label: "Fast pris" }, { value: "running", label: "Löpande räkning" }]} />
      <Field name="start_text" label="När kan ni börja?" />
      <Field name="duration_text" label="Hur lång tid tar jobbet?" />
      <Field name="valid_until" label="Offerten gäller till" type="date" />
      <TextArea name="terms" label="Villkor och reservationer" help="Vad som inte ingår, och vad som kan ändra priset." />
    </ActionForm>
  );
}

function TrackAmounts({ refName, set }: { refName: string; set: (ref: string, change: Partial<{ a: number; l: number }>) => void }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const group = marker.current?.closest("fieldset");
    if (!group) return;
    const read = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const value = Number(target.value.replace(/\s/g, "")) || 0;
      if (target.name === `amount:${refName}`) set(refName, { a: value });
      if (target.name === `labour:${refName}`) set(refName, { l: value });
    };
    group.addEventListener("input", read);
    return () => group.removeEventListener("input", read);
  }, [refName, set]);
  return <span ref={marker} hidden />;
}
