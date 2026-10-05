export type Role = "super_admin" | "club_lead";

export type Profile = { id: string; full_name: string | null; email: string | null; role: Role };

export type Club = {
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  accent_color: string;
  contact_email: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  whatsapp_url: string | null;
  website_url: string | null;
  join_form_url: string | null;
  faculty_advisor: string | null;
  meeting_schedule: string | null;
  founded_year: number | null;
  is_active: boolean;
};

export type ClubEvent = {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  category: string;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  registration_url: string | null;
  responses_sheet_url?: string | null;
  feedback_url: string | null;
  poster_url: string | null;
  registration_open: boolean;
  status: "draft" | "published" | "cancelled";
  budget_allocated: number;
  budget_spent: number;
};

export type EventStat = {
  event_id: string;
  club_id: string;
  title: string;
  category: string;
  status: string;
  starts_at: string;
  capacity: number | null;
  budget_allocated: number;
  budget_spent: number;
  registrations: number;
  attendees: number;
  feedback_count: number;
  avg_rating: number | null;
};

export type Member = {
  id: string;
  club_id: string;
  full_name: string;
  email: string | null;
  roll_no: string | null;
  department: string | null;
  year: number | null;
  phone: string | null;
  position: string;
  status: "active" | "alumni" | "inactive";
  joined_on: string;
};

export type Registration = {
  id: string;
  event_id: string;
  full_name: string;
  email: string;
  roll_no: string | null;
  department: string | null;
  year: number | null;
  phone: string | null;
  attended: boolean;
  attended_at: string | null;
  status: "confirmed" | "waitlisted";
  ticket_code: string;
  registered_at: string;
};

export type Feedback = {
  id: string;
  full_name: string | null;
  email: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type Announcement = { id: string; club_id: string; title: string; body: string | null; pinned: boolean; created_at: string };

export type ClubSummary = { club_id: string; slug: string; name: string; category: string; is_active: boolean; active_members: number; total_events: number };
