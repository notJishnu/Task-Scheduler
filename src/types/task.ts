export type TaskStatus = 'active' | 'completed';

export interface Task {
  id: string;
  title: string;
  dueAt: number;
  status: TaskStatus;
  createdAt: number;
  /** The final reminder time for an active 10-minute snooze sequence. */
  snoozeUntil?: number;
}
