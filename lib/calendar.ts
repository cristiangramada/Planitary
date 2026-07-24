import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { localDateToIsoStart } from "@/utils/date";
import type { CalendarEvent } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Form data types
// ─────────────────────────────────────────────────────────────────────────────

export interface EventFormData {
  title: string;
  details: string | null;
  /** YYYY-MM-DD in local time */
  start_date: string;
  /** HH:MM in local time */
  start_time: string;
  /** YYYY-MM-DD in local time, or null for no end */
  end_date: string | null;
  /** HH:MM in local time, or null */
  end_time: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Combine a local date + time string into a UTC ISO timestamp for storage. */
function toTimestamp(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Read (bounded, injected client — used by the Dashboard)
// ─────────────────────────────────────────────────────────────────────────────

/** Fetches events with start_time in [startDate, endDateExclusive), local dates. */
export async function fetchEventsBetween(
  supabase: SupabaseClient,
  startDate: string,
  endDateExclusive: string
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .gte("start_time", localDateToIsoStart(startDate))
    .lt("start_time", localDateToIsoStart(endDateExclusive))
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data as CalendarEvent[]) ?? [];
}

/** Counts events with start_time in [startDate, endDateExclusive), local dates. */
export async function fetchEventCountBetween(
  supabase: SupabaseClient,
  startDate: string,
  endDateExclusive: string
): Promise<number> {
  const { count, error } = await supabase
    .from("calendar_events")
    .select("id", { count: "exact", head: true })
    .gte("start_time", localDateToIsoStart(startDate))
    .lt("start_time", localDateToIsoStart(endDateExclusive));
  if (error) throw error;
  return count ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function createEvent(
  userId: string,
  form: EventFormData
): Promise<CalendarEvent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      user_id: userId,
      title: form.title,
      details: form.details,
      start_time: toTimestamp(form.start_date, form.start_time),
      end_time: form.end_date
        ? toTimestamp(form.end_date, form.end_time ?? "00:00")
        : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvent(
  id: string,
  form: EventFormData
): Promise<CalendarEvent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .update({
      title: form.title,
      details: form.details,
      start_time: toTimestamp(form.start_date, form.start_time),
      end_time: form.end_date
        ? toTimestamp(form.end_date, form.end_time ?? "00:00")
        : null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
