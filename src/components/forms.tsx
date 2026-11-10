"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

export interface FormState {
  error?: string;
  message?: string;
  fields?: Record<string, string>;
}

const Context = createContext<FormState>({});

/** Shows what went wrong next to each field and moves focus there, as a screen reader needs. */
export function ActionForm({
  action, children, submit, pendingText, id, submitClass = "btn btn-primary", hideSubmit,
}: {
  action: (state: FormState, data: FormData) => Promise<FormState>;
  children: ReactNode;
  submit: string;
  pendingText?: string;
  id?: string;
  submitClass?: string;
  hideSubmit?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLParagraphElement>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!state.error) return;
    const invalid = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (invalid ?? summary.current)?.focus();
  }, [state]);

  // Passing the action straight to <form> makes React clear every field afterwards, which would wipe the form on a validation error.
  // method="post" and the disabled button keep anything typed, passwords included, out of the URL if the page has not finished loading.
  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <Context.Provider value={state}>
      <form method="post" onSubmit={submitForm} ref={ref} id={id} noValidate className="form">
        {children}
        {state.error && <p className="form-error" role="alert" tabIndex={-1} ref={summary}>{state.error}</p>}
        {state.message && <p className="form-ok" role="status">{state.message}</p>}
        {!hideSubmit && <button type="submit" className={submitClass} disabled={pending || !hydrated}>{pending && pendingText ? "Vänta" : submit}</button>}
        <p className="status" aria-live="polite">{pending ? pendingText : ""}</p>
      </form>
    </Context.Provider>
  );
}

export function useFieldError(name: string): string | undefined {
  return useContext(Context).fields?.[name];
}

export function FieldError({ id, name }: { id?: string; name: string }) {
  const error = useFieldError(name);
  return error ? <p className="field-error" id={id}>{error}</p> : null;
}

interface FieldProps {
  name: string;
  label: string;
  help?: string;
  type?: string;
  defaultValue?: string | number | null;
  autoComplete?: string;
  inputMode?: "numeric" | "text" | "tel" | "email";
  placeholder?: string;
  min?: string;
}

export function Field({ name, label, help, type = "text", defaultValue, autoComplete, inputMode, placeholder, min }: FieldProps) {
  const id = useId();
  const error = useFieldError(name);
  const describedBy = [help ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {help && <p className="help" id={`${id}-h`}>{help}</p>}
      <input id={id} name={name} type={type} defaultValue={defaultValue ?? undefined} autoComplete={autoComplete} inputMode={inputMode} placeholder={placeholder} min={min} aria-invalid={error ? true : undefined} aria-describedby={describedBy} />
      <FieldError id={`${id}-e`} name={name} />
    </div>
  );
}

export function TextArea({ name, label, help, rows = 4, defaultValue }: { name: string; label: string; help?: string; rows?: number; defaultValue?: string }) {
  const id = useId();
  const error = useFieldError(name);
  const describedBy = [help ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {help && <p className="help" id={`${id}-h`}>{help}</p>}
      <textarea id={id} name={name} rows={rows} defaultValue={defaultValue} aria-invalid={error ? true : undefined} aria-describedby={describedBy} />
      <FieldError id={`${id}-e`} name={name} />
    </div>
  );
}

export function SelectField({ name, label, help, options, defaultValue }: { name: string; label: string; help?: string; options: { value: string; label: string }[]; defaultValue?: string }) {
  const id = useId();
  const error = useFieldError(name);
  const describedBy = [help ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {help && <p className="help" id={`${id}-h`}>{help}</p>}
      <select id={id} name={name} defaultValue={defaultValue ?? ""} aria-invalid={error ? true : undefined} aria-describedby={describedBy}>
        <option value="">Välj</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <FieldError id={`${id}-e`} name={name} />
    </div>
  );
}

export function Choice({ name, label, help, options, multiple, defaultValue, onChange }: {
  name: string;
  label: string;
  help?: string;
  options: { value: string; label: string; help?: string }[];
  multiple?: boolean;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const id = useId();
  const error = useFieldError(name);
  const describedBy = [help ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset className="field choice" aria-describedby={describedBy} aria-invalid={error ? true : undefined} tabIndex={error ? -1 : undefined}>
      <legend>{label}</legend>
      {help && <p className="help" id={`${id}-h`}>{help}</p>}
      <div className="choice-options">
        {options.map((o) => (
          <label key={o.value} className="choice-option">
            <input type={multiple ? "checkbox" : "radio"} name={name} value={o.value} defaultChecked={defaultValue === o.value} onChange={() => onChange?.(o.value)} />
            <span>{o.label}{o.help && <small>{o.help}</small>}</span>
          </label>
        ))}
      </div>
      <FieldError id={`${id}-e`} name={name} />
    </fieldset>
  );
}

export function Check({ name, value = "ja", label, defaultChecked }: { name: string; value?: string; label: string; defaultChecked?: boolean }) {
  const error = useFieldError(name);
  const id = useId();
  return (
    <div className="field">
      <label className="choice-option">
        <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-e` : undefined} />
        <span>{label}</span>
      </label>
      <FieldError id={`${id}-e`} name={name} />
    </div>
  );
}
