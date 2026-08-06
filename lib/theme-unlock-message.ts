import { getThemeDefinition, type PlanetThemeId } from "@/lib/themes";

/** Short, restrained copy for a theme unlock toast. */
export function formatThemeUnlockMessage(newlyUnlocked: PlanetThemeId[]): string {
  if (newlyUnlocked.length === 0) return "";
  if (newlyUnlocked.length === 1) {
    const label = getThemeDefinition(newlyUnlocked[0]).label;
    return `${label} theme unlocked — find it in Account → Appearance.`;
  }
  const labels = newlyUnlocked.map((id) => getThemeDefinition(id).label);
  const last = labels.pop();
  return `${labels.join(", ")} and ${last} themes unlocked — find them in Account → Appearance.`;
}
