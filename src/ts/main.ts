import { onAuthChange, loginWithGoogle, logout } from './auth';
import { showToast, openOverlay, closeOverlay, textEl } from './ui';
import { submitFeedback } from './feedback';
import {
  INBOX_TITLE, subscribeProjects, createProject, renameProject, archiveProject, deleteProject,
} from './projects';
import {
  subscribeTasks, createTask, setTaskCompleted, deleteTasksByProject, deleteTaskWithDescendants,
} from './tasks';
import { Project, Task } from './types';
import { getNextActionCandidates, isTaskStalled } from './nextAction';
import { calcStreakDays, calcRecentCompletionCount } from './streak';
import { FocusTimer, formatTime, requestNotificationPermission } from './timer';

// ============================================================
// DOM refs
// ============================================================
const loginScreen = document.getElementById('login-screen') as HTMLElement;
const appEl = document.getElementById('app') as HTMLElement;
const userInfo = document.getElementById('user-info') as HTMLElement;
const userAvatar = document.getElementById('user-avatar') as HTMLImageElement;
const userName = document.getElementById('user-name') as HTMLElement;
const btnGoogleLogin = document.getElementById('btn-google-login') as HTMLButtonElement;
const btnLogout = document.getElementById('btn-logout') as HTMLButtonElement;

const quickCaptureForm = document.getElementById('quick-capture-form') as HTMLFormElement;
const inputQuickCapture = document.getElementById('input-quick-capture') as HTMLInputElement;

const nextActionCard = document.getElementById('next-action-card') as HTMLElement;
const statStreak = document.getElementById('stat-streak') as HTMLElement;
const statWeekly = document.getElementById('stat-weekly') as HTMLElement;

const timerDisplay = document.getElementById('timer-display') as HTMLElement;
const btnTimerStart = document.getElementById('btn-timer-start') as HTMLButtonElement;
const btnTimerPause = document.getElementById('btn-timer-pause') as HTMLButtonElement;
const btnTimerReset = document.getElementById('btn-timer-reset') as HTMLButtonElement;

const projectListEl = document.getElementById('project-list') as HTMLElement;
const projectEmptyState = document.getElementById('project-empty-state') as HTMLElement;
const archivedProjectListEl = document.getElementById('archived-project-list') as HTMLElement;
const archivedCountEl = document.getElementById('archived-count') as HTMLElement;
const btnAddProject = document.getElementById('btn-add-project') as HTMLButtonElement;

const projectModalOverlay = document.getElementById('project-modal-overlay') as HTMLElement;
const projectModalTitleEl = document.getElementById('project-modal-title') as HTMLElement;
const projectForm = document.getElementById('project-form') as HTMLFormElement;
const inputProjectTitle = document.getElementById('input-project-title') as HTMLInputElement;
const btnProjectModalClose = document.getElementById('btn-project-modal-close') as HTMLButtonElement;
const btnProjectFormCancel = document.getElementById('btn-project-form-cancel') as HTMLButtonElement;

const confirmDialogTitle = document.getElementById('confirm-dialog-title') as HTMLElement;
const confirmOverlay = document.getElementById('confirm-dialog-overlay') as HTMLElement;
const btnConfirmCancel = document.getElementById('btn-confirm-cancel') as HTMLButtonElement;
const btnConfirmDelete = document.getElementById('btn-confirm-delete') as HTMLButtonElement;

const feedbackBtn = document.getElementById('feedback-btn') as HTMLButtonElement;
const feedbackOverlay = document.getElementById('feedback-modal-overlay') as HTMLElement;
const inputFeedbackMessage = document.getElementById('input-feedback-message') as HTMLTextAreaElement;
const btnFeedbackClose = document.getElementById('btn-feedback-close') as HTMLButtonElement;
const btnFeedbackSend = document.getElementById('btn-feedback-send') as HTMLButtonElement;

// ============================================================
// State
// ============================================================
let currentUid: string | null = null;
let unsubscribeProjects: (() => void) | null = null;
let unsubscribeTasks: (() => void) | null = null;
let allProjects: Project[] = [];
let allTasks: Task[] = [];
const expandedProjectIds = new Set<string>();
let nextActionSkipIndex = 0;
let projectModalEditingId: string | null = null;

type PendingDelete = { type: 'project' | 'task'; id: string; title: string };
let pendingDelete: PendingDelete | null = null;

function byCreated(a: Task, b: Task): number {
  return (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0);
}

// ============================================================
// Auth
// ============================================================
onAuthChange((user) => {
  if (unsubscribeProjects) { unsubscribeProjects(); unsubscribeProjects = null; }
  if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }

  if (user) {
    currentUid = user.uid;
    loginScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    userInfo.classList.remove('hidden');
    userAvatar.src = user.photoURL || '';
    userAvatar.alt = '';
    userName.textContent = user.displayName || user.email || '';

    unsubscribeProjects = subscribeProjects(currentUid, (projects) => {
      allProjects = projects;
      renderAll();
    });
    unsubscribeTasks = subscribeTasks(currentUid, (tasks) => {
      allTasks = tasks;
      renderAll();
    });
  } else {
    currentUid = null;
    allProjects = [];
    allTasks = [];
    expandedProjectIds.clear();
    loginScreen.classList.remove('hidden');
    appEl.classList.add('hidden');
    userInfo.classList.add('hidden');
  }
});

btnGoogleLogin.addEventListener('click', () => {
  loginWithGoogle().catch((e: Error) => showToast('ログインに失敗しました: ' + e.message));
});

btnLogout.addEventListener('click', () => {
  logout();
});

// ============================================================
// 描画
// ============================================================
function renderAll(): void {
  renderNextAction();
  renderStats();
  renderProjects();
}

function renderNextAction(): void {
  nextActionCard.innerHTML = '';
  const candidates = getNextActionCandidates(allProjects, allTasks);

  if (candidates.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'next-action next-action--empty';
    empty.append(textEl('p', '', '🎉 今すぐ着手できるタスクはありません。プロジェクトにタスクを追加しましょう。'));
    nextActionCard.append(empty);
    return;
  }

  nextActionSkipIndex = nextActionSkipIndex % candidates.length;
  const candidate = candidates[nextActionSkipIndex];

  const card = document.createElement('div');
  card.className = 'next-action';
  card.dataset.taskId = candidate.task.id;

  card.append(textEl('div', 'next-action__label', candidate.project.title));
  if (candidate.breadcrumb.length > 0) {
    card.append(textEl('div', 'next-action__breadcrumb', candidate.breadcrumb.join(' › ')));
  }
  card.append(textEl('div', 'next-action__title', candidate.task.title));

  const actions = document.createElement('div');
  actions.className = 'next-action__actions';
  const doneBtn = textEl('button', 'btn btn--accent', '✓ 完了にする');
  doneBtn.dataset.action = 'complete-next';
  actions.append(doneBtn);
  if (candidates.length > 1) {
    const skipBtn = textEl('button', 'btn btn--ghost', '⏭ 後で');
    skipBtn.dataset.action = 'skip-next';
    actions.append(skipBtn);
  }
  card.append(actions);

  if (candidate.isStalled) {
    card.append(textEl('div', 'next-action__breadcrumb', '⚠ しばらく動きがありません。分解してみませんか？'));
  }

  nextActionCard.append(card);
}

nextActionCard.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest('[data-action]') as HTMLButtonElement | null;
  if (!btn || !currentUid) return;
  const card = btn.closest('.next-action') as HTMLElement | null;
  const taskId = card?.dataset.taskId;
  if (!taskId) return;

  if (btn.dataset.action === 'complete-next') {
    setTaskCompleted(currentUid, taskId, true).catch(() => showToast('更新に失敗しました'));
  } else if (btn.dataset.action === 'skip-next') {
    nextActionSkipIndex += 1;
    renderNextAction();
  }
});

function renderStats(): void {
  statStreak.textContent = String(calcStreakDays(allTasks));
  statWeekly.textContent = String(calcRecentCompletionCount(allTasks));
}

function renderProjects(): void {
  projectListEl.innerHTML = '';
  archivedProjectListEl.innerHTML = '';

  const active = allProjects.filter((p) => !p.archived);
  const archived = allProjects.filter((p) => p.archived);

  projectEmptyState.classList.toggle('hidden', active.length > 0);

  active.forEach((p) => projectListEl.append(renderProjectCard(p)));
  archived.forEach((p) => archivedProjectListEl.append(renderProjectCard(p)));
  archivedCountEl.textContent = String(archived.length);
}

function renderProjectCard(project: Project): HTMLElement {
  const card = document.createElement('div');
  card.className = 'project-card';
  card.dataset.id = project.id;

  const projectTasks = allTasks.filter((t) => t.projectId === project.id);
  const total = projectTasks.length;
  const done = projectTasks.filter((t) => t.completed).length;
  const isOpen = expandedProjectIds.has(project.id);

  const head = document.createElement('div');
  head.className = 'project-card__head';
  head.dataset.action = 'toggle-project';

  const toggle = textEl('span', 'project-card__toggle' + (isOpen ? ' is-open' : ''), '▶');
  const title = textEl('span', 'project-card__title', project.title);
  const progress = textEl('span', 'project-card__progress', total > 0 ? `${done}/${total}` : '');

  const actions = document.createElement('div');
  actions.className = 'project-card__actions';
  const renameBtn = textEl('button', 'task-item__icon-btn', '✎');
  renameBtn.dataset.action = 'rename-project';
  renameBtn.setAttribute('aria-label', '名称変更');
  const archiveBtn = textEl('button', 'task-item__icon-btn', project.archived ? '↩' : '📦');
  archiveBtn.dataset.action = project.archived ? 'unarchive-project' : 'archive-project';
  archiveBtn.setAttribute('aria-label', project.archived ? 'アーカイブ解除' : 'アーカイブ');
  const deleteBtn = textEl('button', 'task-item__icon-btn is-danger', '🗑');
  deleteBtn.dataset.action = 'delete-project';
  deleteBtn.setAttribute('aria-label', '削除');
  actions.append(renameBtn, archiveBtn, deleteBtn);

  head.append(toggle, title, progress, actions);
  card.append(head);

  if (isOpen) {
    const body = document.createElement('div');
    body.className = 'project-card__body';

    const rootTasks = projectTasks.filter((t) => t.parentId === null).sort(byCreated);
    if (rootTasks.length > 0) {
      const tree = document.createElement('div');
      tree.className = 'task-tree';
      rootTasks.forEach((t) => tree.append(renderTaskItem(t, projectTasks)));
      body.append(tree);
    } else {
      body.append(textEl('p', 'section__desc', 'まだタスクがありません。'));
    }

    const addRootBtn = textEl('button', 'btn btn--ghost btn--sm', '＋ タスク追加');
    addRootBtn.dataset.action = 'add-root-task';
    addRootBtn.style.marginTop = '8px';
    body.append(addRootBtn);

    card.append(body);
  }

  return card;
}

function renderTaskItem(task: Task, projectTasks: Task[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'task-item' + (task.completed ? ' is-done' : '');
  wrapper.dataset.id = task.id;

  const row = document.createElement('div');
  row.className = 'task-item__row';

  const checkbox = textEl('button', 'task-item__checkbox' + (task.completed ? ' is-done' : ''), task.completed ? '✓' : '');
  checkbox.dataset.action = 'toggle-task';
  checkbox.setAttribute('aria-label', task.completed ? '未完了に戻す' : '完了にする');

  const text = textEl('span', 'task-item__text', task.title);

  row.append(checkbox, text);

  if (isTaskStalled(task, projectTasks)) {
    row.append(textEl('span', 'task-item__badge', '分解してみる？'));
  }

  const actions = document.createElement('div');
  actions.className = 'task-item__actions';
  const addSubBtn = textEl('button', 'task-item__icon-btn', '➕');
  addSubBtn.dataset.action = 'add-subtask';
  addSubBtn.setAttribute('aria-label', 'サブタスクを追加');
  const deleteBtn = textEl('button', 'task-item__icon-btn is-danger', '🗑');
  deleteBtn.dataset.action = 'delete-task';
  deleteBtn.setAttribute('aria-label', '削除');
  actions.append(addSubBtn, deleteBtn);
  row.append(actions);

  wrapper.append(row);

  const children = projectTasks.filter((t) => t.parentId === task.id).sort(byCreated);
  if (children.length > 0) {
    const childContainer = document.createElement('div');
    childContainer.className = 'task-tree task-tree--nested';
    children.forEach((c) => childContainer.append(renderTaskItem(c, projectTasks)));
    wrapper.append(childContainer);
  }

  return wrapper;
}

function createTaskAddForm(onSubmit: (title: string) => void): HTMLFormElement {
  const form = document.createElement('form');
  form.className = 'task-add-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'タスク名を入力';
  input.required = true;
  input.maxLength = 60;
  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'btn btn--primary btn--sm';
  btn.textContent = '追加';
  form.append(input, btn);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) return;
    onSubmit(title);
    form.remove();
  });
  window.setTimeout(() => input.focus(), 0);
  return form;
}

function handleProjectListClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const btn = target.closest('[data-action]') as HTMLElement | null;
  if (!btn || !currentUid) return;
  const uid = currentUid;
  const action = btn.dataset.action;
  const projectCard = btn.closest('.project-card') as HTMLElement | null;
  const projectId = projectCard?.dataset.id;
  const taskItem = btn.closest('.task-item') as HTMLElement | null;
  const taskId = taskItem?.dataset.id;

  switch (action) {
    case 'toggle-project': {
      if (!projectId) return;
      if (expandedProjectIds.has(projectId)) expandedProjectIds.delete(projectId);
      else expandedProjectIds.add(projectId);
      renderProjects();
      break;
    }
    case 'rename-project': {
      if (!projectId) return;
      const project = allProjects.find((p) => p.id === projectId);
      if (project) openProjectModal('rename', project);
      break;
    }
    case 'archive-project':
    case 'unarchive-project': {
      if (!projectId) return;
      archiveProject(uid, projectId, action === 'archive-project').catch(() => showToast('更新に失敗しました'));
      break;
    }
    case 'delete-project': {
      if (!projectId) return;
      const project = allProjects.find((p) => p.id === projectId);
      if (!project) return;
      pendingDelete = { type: 'project', id: projectId, title: project.title };
      confirmDialogTitle.textContent = `「${project.title}」を削除しますか？（配下のタスクも全て削除されます）`;
      openOverlay(confirmOverlay);
      break;
    }
    case 'toggle-task': {
      if (!taskId) return;
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;
      setTaskCompleted(uid, taskId, !task.completed).catch(() => showToast('更新に失敗しました'));
      break;
    }
    case 'delete-task': {
      if (!taskId) return;
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;
      pendingDelete = { type: 'task', id: taskId, title: task.title };
      confirmDialogTitle.textContent = `「${task.title}」を削除しますか？`;
      openOverlay(confirmOverlay);
      break;
    }
    case 'add-subtask': {
      if (!taskId || !projectId || !taskItem) return;
      if (taskItem.querySelector(':scope > .task-add-form')) return;
      const form = createTaskAddForm((title) => {
        const siblingCount = allTasks.filter((t) => t.parentId === taskId).length;
        createTask(uid, projectId, taskId, title, siblingCount).catch(() => showToast('追加に失敗しました'));
      });
      taskItem.querySelector('.task-item__row')!.after(form);
      break;
    }
    case 'add-root-task': {
      if (!projectId || !projectCard) return;
      if (projectCard.querySelector('.task-add-form')) return;
      const form = createTaskAddForm((title) => {
        const siblingCount = allTasks.filter((t) => t.projectId === projectId && t.parentId === null).length;
        createTask(uid, projectId, null, title, siblingCount).catch(() => showToast('追加に失敗しました'));
      });
      btn.before(form);
      break;
    }
    default:
      break;
  }
}

projectListEl.addEventListener('click', handleProjectListClick);
archivedProjectListEl.addEventListener('click', handleProjectListClick);

// ============================================================
// プロジェクト追加/名称変更モーダル
// ============================================================
function openProjectModal(mode: 'create' | 'rename', project?: Project): void {
  projectModalEditingId = mode === 'rename' && project ? project.id : null;
  projectModalTitleEl.textContent = mode === 'rename' ? 'プロジェクト名を変更' : '新しいプロジェクト';
  inputProjectTitle.value = mode === 'rename' && project ? project.title : '';
  openOverlay(projectModalOverlay);
  window.setTimeout(() => inputProjectTitle.focus(), 0);
}

btnAddProject.addEventListener('click', () => openProjectModal('create'));
btnProjectModalClose.addEventListener('click', () => closeOverlay(projectModalOverlay));
btnProjectFormCancel.addEventListener('click', () => closeOverlay(projectModalOverlay));

projectForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentUid) return;
  const title = inputProjectTitle.value.trim();
  if (!title) return;
  const submitBtn = projectForm.querySelector('button[type="submit"]') as HTMLButtonElement;
  if (submitBtn.disabled) return;
  submitBtn.disabled = true;

  const task = projectModalEditingId
    ? renameProject(currentUid, projectModalEditingId, title)
    : createProject(currentUid, title, allProjects.length).then(() => undefined);

  task
    .then(() => {
      closeOverlay(projectModalOverlay);
      showToast('保存しました');
    })
    .catch((err: Error) => showToast('保存に失敗しました: ' + err.message))
    .finally(() => { submitBtn.disabled = false; });
});

// ============================================================
// 削除確認ダイアログ（共通）
// ============================================================
btnConfirmCancel.addEventListener('click', () => {
  pendingDelete = null;
  closeOverlay(confirmOverlay);
});

btnConfirmDelete.addEventListener('click', () => {
  if (!currentUid || !pendingDelete || btnConfirmDelete.disabled) return;
  btnConfirmDelete.disabled = true;

  const uid = currentUid;
  const target = pendingDelete;
  const task: Promise<void> = target.type === 'project'
    ? deleteTasksByProject(uid, target.id, allTasks).then(() => deleteProject(uid, target.id))
    : deleteTaskWithDescendants(uid, target.id, allTasks);

  task
    .then(() => showToast('削除しました'))
    .catch((err: Error) => showToast('削除に失敗しました: ' + err.message))
    .finally(() => {
      btnConfirmDelete.disabled = false;
      pendingDelete = null;
      closeOverlay(confirmOverlay);
    });
});

// ============================================================
// クイックキャプチャ
// ============================================================
async function ensureInboxProjectId(uid: string): Promise<string> {
  const existing = allProjects.find((p) => p.title === INBOX_TITLE && !p.archived);
  if (existing) return existing.id;
  const id = await createProject(uid, INBOX_TITLE, allProjects.length);
  expandedProjectIds.add(id);
  return id;
}

quickCaptureForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentUid) return;
  const title = inputQuickCapture.value.trim();
  if (!title) return;
  const submitBtn = quickCaptureForm.querySelector('button[type="submit"]') as HTMLButtonElement;
  if (submitBtn.disabled) return;
  submitBtn.disabled = true;
  const uid = currentUid;

  ensureInboxProjectId(uid)
    .then((inboxId) => {
      const siblingCount = allTasks.filter((t) => t.projectId === inboxId && t.parentId === null).length;
      return createTask(uid, inboxId, null, title, siblingCount);
    })
    .then(() => {
      quickCaptureForm.reset();
      showToast('追加しました');
    })
    .catch((err: Error) => showToast('追加に失敗しました: ' + err.message))
    .finally(() => { submitBtn.disabled = false; });
});

// ============================================================
// 集中タイマー
// ============================================================
const focusTimer = new FocusTimer(
  (seconds) => { timerDisplay.textContent = formatTime(seconds); },
  () => {
    showToast('集中タイムが終わりました。お疲れさまでした！');
    btnTimerStart.classList.remove('hidden');
    btnTimerPause.classList.add('hidden');
  },
);
timerDisplay.textContent = formatTime(focusTimer.seconds);

btnTimerStart.addEventListener('click', () => {
  void requestNotificationPermission();
  focusTimer.start();
  btnTimerStart.classList.add('hidden');
  btnTimerPause.classList.remove('hidden');
});

btnTimerPause.addEventListener('click', () => {
  focusTimer.pause();
  btnTimerStart.classList.remove('hidden');
  btnTimerPause.classList.add('hidden');
});

btnTimerReset.addEventListener('click', () => {
  focusTimer.reset();
  btnTimerStart.classList.remove('hidden');
  btnTimerPause.classList.add('hidden');
});

// ============================================================
// 要望送信モーダル
// ============================================================
feedbackBtn.addEventListener('click', () => {
  inputFeedbackMessage.value = '';
  openOverlay(feedbackOverlay);
});

btnFeedbackClose.addEventListener('click', () => closeOverlay(feedbackOverlay));

btnFeedbackSend.addEventListener('click', () => {
  const message = inputFeedbackMessage.value.trim();
  if (!message || btnFeedbackSend.disabled) return;
  btnFeedbackSend.disabled = true;
  submitFeedback(message)
    .then((ok) => {
      showToast(ok ? '送信しました。ありがとうございます！' : '送信に失敗しました');
      if (ok) closeOverlay(feedbackOverlay);
    })
    .finally(() => {
      btnFeedbackSend.disabled = false;
    });
});

// ============================================================
// 定期更新（放置バッジ・ストリークを最新に保つ）
// ============================================================
window.setInterval(() => {
  if (currentUid) renderAll();
}, 60000);
