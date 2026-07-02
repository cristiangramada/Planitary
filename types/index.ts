export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  color?: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  title?: string;
  content: string;
  mood?: "great" | "good" | "okay" | "bad" | "terrible";
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  type: "task" | "event" | "journal";
  id: string;
  title: string;
  preview: string;
  date: string;
  href: string;
}

export type NavItem = {
  label: string;
  href: string;
  icon: string;
};
