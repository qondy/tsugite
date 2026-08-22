export function showToast(message: string): void {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

export function openOverlay(overlay: HTMLElement): void {
  overlay.classList.add('is-open');
}

export function closeOverlay(overlay: HTMLElement): void {
  overlay.classList.remove('is-open');
}

/** ユーザー入力テキストを安全に表示するための要素を作る（innerHTML不使用） */
export function textEl(tag: string, className: string, text: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}
