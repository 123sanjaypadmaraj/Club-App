"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmMfaEnrollAction, startMfaEnrollAction } from "@/app/login/mfa/actions";

type Setup = { factorId: string; qr: string; secret: string };

/** Authenticator-app (TOTP) enrolment: scan the QR code, then confirm with a code. */
export function MfaSetup() {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function begin() {
    setError(null);
    start(async () => {
      const r = await startMfaEnrollAction();
      if (r.ok) setSetup({ factorId: r.factorId, qr: r.qr, secret: r.secret });
      else setError(r.error);
    });
  }

  function confirm() {
    if (!setup) return;
    setError(null);
    start(async () => {
      const r = await confirmMfaEnrollAction(setup.factorId, code);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  if (!setup) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={begin} disabled={pending} className="btn btn-primary">{pending ? "Starting…" : "Set up authenticator app"}</button>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…).</li>
        <li>Scan this QR code, or type the key by hand.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URI from Supabase */}
      <img src={setup.qr} alt="QR code to add Club Hub to your authenticator app" className="size-44 rounded-lg bg-white p-2" />
      <p className="break-all text-xs text-muted">Key: <code className="select-all">{setup.secret}</code></p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        aria-label="6-digit code"
        placeholder="123456"
        className="input w-40 text-center tracking-widest"
      />
      <div className="flex gap-2">
        <button type="button" onClick={confirm} disabled={pending || code.trim().length < 6} className="btn btn-primary">{pending ? "Checking…" : "Turn on two-step login"}</button>
        <button type="button" onClick={() => { setSetup(null); setCode(""); setError(null); }} className="btn">Cancel</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
