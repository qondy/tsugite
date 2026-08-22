const FOCUS_MINUTES = 25;

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return Promise.resolve('denied');
  }
  return Notification.requestPermission();
}

function showNotification(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: 'favicon.svg' });
}

export class FocusTimer {
  private remainingSeconds = FOCUS_MINUTES * 60;
  private intervalId: number | null = null;
  private onTick: (seconds: number) => void;
  private onComplete: () => void;

  constructor(onTick: (seconds: number) => void, onComplete: () => void) {
    this.onTick = onTick;
    this.onComplete = onComplete;
  }

  get isRunning(): boolean {
    return this.intervalId !== null;
  }

  get seconds(): number {
    return this.remainingSeconds;
  }

  start(): void {
    if (this.isRunning) return;
    this.intervalId = window.setInterval(() => {
      this.remainingSeconds -= 1;
      this.onTick(this.remainingSeconds);
      if (this.remainingSeconds <= 0) {
        this.pause();
        showNotification('Tsugite', '集中タイムが終わりました。お疲れさまでした！');
        this.onComplete();
      }
    }, 1000);
  }

  pause(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reset(): void {
    this.pause();
    this.remainingSeconds = FOCUS_MINUTES * 60;
    this.onTick(this.remainingSeconds);
  }
}

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.max(0, totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
