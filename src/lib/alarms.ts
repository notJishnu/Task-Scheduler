import type { Task } from '../types/task';

const alarmName = (id: string) => `task:${id}`;

export async function scheduleTaskAlarm(task: Task): Promise<void> {
  await chrome.alarms.clear(alarmName(task.id));
  if (task.status === 'active') {
    await chrome.alarms.create(alarmName(task.id), { when: task.dueAt });
  }
}

export async function cancelTaskAlarm(id: string): Promise<void> {
  await chrome.alarms.clear(alarmName(id));
}

export function getTaskIdFromAlarm(name: string): string | null {
  return name.startsWith('task:') ? name.slice(5) : null;
}
