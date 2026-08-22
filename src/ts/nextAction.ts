import { Project, Task } from './types';

const STALLED_DAYS = 5;

export interface NextActionCandidate {
  task: Task;
  project: Project;
  breadcrumb: string[];
  isStalled: boolean;
}

function isActionable(task: Task, allTasks: Task[]): boolean {
  if (task.completed) return false;
  const children = allTasks.filter((t) => t.parentId === task.id);
  return children.every((c) => c.completed);
}

function buildBreadcrumb(task: Task, allTasks: Task[]): string[] {
  const chain: string[] = [];
  let current = task.parentId ? allTasks.find((t) => t.id === task.parentId) : undefined;
  while (current) {
    chain.unshift(current.title);
    current = current.parentId ? allTasks.find((t) => t.id === current!.parentId) : undefined;
  }
  return chain;
}

function millisOf(ts: Task['createdAt']): number {
  return ts ? ts.toMillis() : 0;
}

export function getNextActionCandidates(projects: Project[], tasks: Task[]): NextActionCandidate[] {
  const activeProjects = projects.filter((p) => !p.archived);
  const projectRank = new Map(activeProjects.map((p, i) => [p.id, i]));
  const now = Date.now();

  const candidates = tasks
    .filter((t) => projectRank.has(t.projectId) && isActionable(t, tasks))
    .map((task) => {
      const project = activeProjects.find((p) => p.id === task.projectId)!;
      const updatedMillis = task.updatedAt ? task.updatedAt.toMillis() : millisOf(task.createdAt);
      const isStalled = now - updatedMillis > STALLED_DAYS * 24 * 60 * 60 * 1000;
      return {
        task,
        project,
        breadcrumb: buildBreadcrumb(task, tasks),
        isStalled,
      };
    });

  candidates.sort((a, b) => {
    const projectDiff = (projectRank.get(a.project.id) ?? 0) - (projectRank.get(b.project.id) ?? 0);
    if (projectDiff !== 0) return projectDiff;
    if (a.task.order !== b.task.order) return a.task.order - b.task.order;
    return millisOf(a.task.createdAt) - millisOf(b.task.createdAt);
  });

  return candidates;
}

export function isTaskStalled(task: Task, allTasks: Task[]): boolean {
  if (!isActionable(task, allTasks)) return false;
  const updatedMillis = task.updatedAt ? task.updatedAt.toMillis() : millisOf(task.createdAt);
  return Date.now() - updatedMillis > STALLED_DAYS * 24 * 60 * 60 * 1000;
}
