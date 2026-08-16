export type TaskStatus = 'active' | 'completed';

export interface Task {
  id: string;
  title: string;
  dueAt: number;
  status: TaskStatus;
  createdAt: number;
}
