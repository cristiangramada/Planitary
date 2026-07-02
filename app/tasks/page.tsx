import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckSquare, Plus } from "lucide-react";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <AppShell title="Tasks">
      <div className="max-w-3xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">My Tasks</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              Manage and track everything you need to do.
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            New task
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-[hsl(var(--muted))] mb-6 w-fit">
          {["All", "Active", "Completed"].map((tab) => (
            <button
              key={tab}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === "All"
                  ? "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Empty state */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <EmptyState
            icon={CheckSquare}
            title="No tasks yet"
            description="Add your first task to start tracking what you need to accomplish."
            action={
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" />
                Add a task
              </button>
            }
          />
        </div>
      </div>
    </AppShell>
  );
}
