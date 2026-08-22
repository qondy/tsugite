import { Task } from './types';

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function completedDateSet(tasks: Task[]): Set<string> {
  const set = new Set<string>();
  tasks.forEach((t) => {
    if (t.completed && t.completedAt) {
      set.add(toDateKey(t.completedAt.toDate()));
    }
  });
  return set;
}

export function calcStreakDays(tasks: Task[]): number {
  const dates = completedDateSet(tasks);
  if (dates.size === 0) return 0;

  const cursor = new Date();
  if (!dates.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dates.has(toDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (dates.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function calcRecentCompletionCount(tasks: Task[], days = 7): number {
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return tasks.filter((t) => t.completed && t.completedAt && t.completedAt.toMillis() >= threshold).length;
}
