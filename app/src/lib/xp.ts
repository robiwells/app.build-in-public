/** Total XP needed to reach level N. Level 1 starts at 0 XP. */
export function xpForLevel(level: number): number {
  return 5 * (level - 1) * level;
}

/** XP needed to advance from level N to N+1. */
export function xpToNextLevel(level: number): number {
  return level * 10;
}

/** XP earned within the current level (progress toward next). */
export function xpInCurrentLevel(xp: number, level: number): number {
  return xp - xpForLevel(level);
}

/** Progress percentage within current level (0–100). */
export function levelProgressPct(xp: number, level: number): number {
  return Math.min(100, Math.round((xpInCurrentLevel(xp, level) / xpToNextLevel(level)) * 100));
}
