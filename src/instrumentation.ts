import { checkConfig } from "@/lib/config-check";

// Runs once when the server starts. Refuses to start with a broken configuration and logs risky settings.
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { fatal, warnings } = checkConfig(process.env, process.env.NODE_ENV === "production");
  for (const w of warnings) console.warn(JSON.stringify({ level: "security", event: "config_insecure", problem: w }));
  if (fatal.length) throw new Error(`Invalid configuration: ${fatal.join("; ")}`);
}
