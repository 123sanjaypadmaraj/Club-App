import { checkAuthSettings, checkConfig } from "@/lib/config-check";

// Runs once when the server starts. Refuses to start with a broken configuration and logs risky settings.
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { fatal, warnings } = checkConfig(process.env, process.env.NODE_ENV === "production");
  for (const w of warnings) console.warn(JSON.stringify({ level: "security", event: "config_insecure", problem: w }));
  // Production only, never awaited: a slow or unreachable Supabase must not delay startup.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.NODE_ENV === "production" && url && key && fatal.length === 0) {
    void checkAuthSettings(url, key).then((problem) => {
      if (problem) console.warn(JSON.stringify({ level: "security", event: "config_insecure", problem }));
    });
  }
  if (fatal.length) throw new Error(`Invalid configuration: ${fatal.join("; ")}`);
}
