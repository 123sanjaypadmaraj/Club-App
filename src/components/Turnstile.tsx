"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void };
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    const s = existing ?? Object.assign(document.createElement("script"), { src: SRC, async: true });
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("turnstile failed to load")));
    if (!existing) document.head.appendChild(s);
  });
}

/**
 * Cloudflare Turnstile CAPTCHA. Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 * Turnstile adds a hidden `cf-turnstile-response` field to the surrounding <form>, which the server action verifies.
 */
export function Turnstile() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteKey || !box.current) return;
    let widget: string | undefined;
    let gone = false;
    loadScript()
      .then(() => {
        if (!gone && box.current && window.turnstile) widget = window.turnstile.render(box.current, { sitekey: siteKey, theme: "auto" });
      })
      .catch(() => {});
    return () => {
      gone = true;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, []);

  if (!siteKey) return null;
  return <div ref={box} className="min-h-[65px]" />;
}
