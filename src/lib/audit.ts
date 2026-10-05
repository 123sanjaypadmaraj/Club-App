import { createServiceClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/log";

/** Every action name written to audit_log (the admin viewer filters on this list). */
export const AUDIT_ACTIONS = {
  leadCreated: "lead.created",
  leadPasswordReset: "lead.password_reset",
  leadDeleted: "lead.deleted",
  passwordChanged: "account.password_changed",
  mfaEnabled: "account.mfa_enabled",
  clubCreated: "club.created",
  clubVisibility: "club.visibility_changed",
  eventDeleted: "event.deleted",
  participantsRemoved: "participants.removed",
  membersImported: "members.imported",
  memberRemoved: "member.removed",
  exportMembers: "export.members",
  exportParticipants: "export.participants",
  exportFeedback: "export.feedback",
  exportClubs: "export.clubs",
  login: "auth.login",
  mfaVerified: "auth.mfa_verified",
  logout: "auth.logout",
  logoutEverywhere: "auth.logout_everywhere",
  mfaRemoved: "account.mfa_removed",
  leadMfaCleared: "lead.mfa_cleared",
  loginThrottled: "auth.login_throttled",
  roleChanged: "profile.role_changed",
  leadAssigned: "club_lead.insert",
  leadUnassigned: "club_lead.delete",
} as const;

/**
 * Record a sensitive action in audit_log (written with the service role; admins can read it).
 * Best effort: a logging failure is reported but never blocks the action itself.
 * `detail` must hold ids and flags only, never emails, names or passwords.
 */
export async function audit(actor: string, action: string, target?: string | null, detail: Record<string, string | number | boolean | null> = {}): Promise<void> {
  try {
    const { error } = await createServiceClient().from("audit_log").insert({ actor, action, target: target ?? null, detail });
    if (error) logActionError("audit", error, { auditAction: action });
  } catch {
    logActionError("audit", { message: "audit write failed" }, { auditAction: action });
  }
}
