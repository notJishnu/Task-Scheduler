import type { Task } from '../types/task';

const TASKS_KEY = 'tasks';

export async function getTasks(): Promise<Task[]> {
  const result = await chrome.storage.local.get(TASKS_KEY);
  return (result[TASKS_KEY] ?? []) as Task[];
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await chrome.storage.local.set({ [TASKS_KEY]: tasks });
}

export async function saveTask(task: Task): Promise<void> {
  const tasks = await getTasks();
  const index = tasks.findIndex((item) => item.id === task.id);
  if (index === -1) tasks.push(task);
  else tasks[index] = task;
  await saveTasks(tasks);
}

export async function deleteTask(id: string): Promise<void> {
  const tasks = await getTasks();
  await saveTasks(tasks.filter((task) => task.id !== id));
}
