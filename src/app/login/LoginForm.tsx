"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn } from "./actions";

function Spinner() {
  return <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary group w-full py-2.5 text-base">
      {pending ? (
        <>
          <Spinner /> Signing in…
        </>
      ) : (
        <>
          Sign in
          <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
        </>
      )}
    </button>
  );
}

const icon = "h-4 w-4 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]";

export function LoginForm({ next, error }: { next: string; error?: string }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);

  return (
    <form action={signIn} className="space-y-5">
      <input type="hidden" name="next" value={next} />

      {error && (
        <div role="alert" className="animate-shake rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <label className="block">
        <span className="label">Username</span>
        <span className="relative block">
          <svg viewBox="0 0 24 24" className={`${icon} pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted`} aria-hidden>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          <input name="username" type="text" required autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="your.club" className="input py-2.5 pl-9" />
        </span>
      </label>

      <label className="block">
        <span className="label">Password</span>
        <span className="relative block">
          <svg viewBox="0 0 24 24" className={`${icon} pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted`} aria-hidden>
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
            onBlur={() => setCaps(false)}
            className="input py-2.5 pl-9 pr-16"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-pressed={show}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-muted transition hover:bg-brand/10 hover:text-brand"
          >
            {show ? "Hide" : "Show"}
          </button>
        </span>
        {caps && <span className="mt-1.5 block text-xs font-medium text-orange-600 dark:text-orange-400">⚠ Caps Lock is on</span>}
      </label>

      <Submit />
    </form>
  );
}
