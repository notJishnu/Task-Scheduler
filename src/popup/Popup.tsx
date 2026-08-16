import { useEffect, useMemo, useState } from 'react';
import { cancelTaskAlarm, scheduleTaskAlarm } from '../lib/alarms';
import { deleteTask, getTasks, saveTask } from '../lib/storage';
import type { Task } from '../types/task';

function toDateInput(timestamp: number): string {
  const date = new Date(timestamp - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 10);
}

function toTimeInput(timestamp: number): string {
  const date = new Date(timestamp - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(11, 16);
}

function tomorrowDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateInput(date.getTime());
}

function formatDue(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}

export function Popup() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [time, setTime] = useState(toTimeInput(Date.now() + 60 * 60 * 1000));
  const [testStatus, setTestStatus] = useState('');

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status === 'active').sort((a, b) => a.dueAt - b.dueAt),
    [tasks],
  );

  useEffect(() => { void getTasks().then(setTasks); }, []);

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    const due = new Date(`${date}T${time}`).getTime();
    if (!title.trim() || Number.isNaN(due)) return;
    const task: Task = { id: crypto.randomUUID(), title: title.trim(), dueAt: due, status: 'active', createdAt: Date.now() };
    await saveTask(task);
    await scheduleTaskAlarm(task);
    setTasks((current) => [...current, task]);
    setTitle('');
    setDate(toDateInput(Date.now()));
    setTime(toTimeInput(Date.now() + 60 * 60 * 1000));
  }

  async function completeTask(task: Task) {
    const updated = { ...task, status: 'completed' as const };
    await saveTask(updated);
    await cancelTaskAlarm(task.id);
    setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
  }

  async function removeTask(id: string) {
    await deleteTask(id);
    await cancelTaskAlarm(id);
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  async function sendTestNotification() {
    setTestStatus('Sending test notification…');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SHOW_TEST_NOTIFICATION' }) as { ok: boolean; message: string };
      setTestStatus(response.message);
    } catch {
      setTestStatus('Unable to contact the reminder service. Reload the extension and try again.');
    }
  }

  return (
    <main>
      <header><span className="mark">✓</span><div><h1>Task Bell</h1><p>Plan it. Hear it. Do it.</p></div></header>
      <form onSubmit={addTask}>
        <label>What needs doing?<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Submit project report" maxLength={120} autoFocus /></label>
        <fieldset>
          <legend>When should I remind you?</legend>
          <div className="quick-days">
            <button type="button" className={date === toDateInput(Date.now()) ? 'selected' : ''} onClick={() => setDate(toDateInput(Date.now()))}>Today</button>
            <button type="button" className={date === tomorrowDate() ? 'selected' : ''} onClick={() => setDate(tomorrowDate())}>Tomorrow</button>
          </div>
          <div className="date-time-fields">
            <label>Date<input type="date" value={date} min={toDateInput(Date.now())} onChange={(event) => setDate(event.target.value)} required /></label>
            <label>Time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
          </div>
        </fieldset>
        <button type="submit">Add reminder</button>
      </form>
      <div className="test-row"><button className="test-button" onClick={() => void sendTestNotification()}>Send test notification</button>{testStatus && <p>{testStatus}</p>}</div>
      <section>
        <div className="section-title"><h2>Upcoming</h2><span>{activeTasks.length}</span></div>
        {activeTasks.length === 0 ? <p className="empty">Nothing scheduled yet. Add your first task above.</p> : (
          <ul>{activeTasks.map((task) => <li key={task.id} className={task.dueAt < Date.now() ? 'overdue' : ''}>
            <button className="check" title="Mark complete" onClick={() => void completeTask(task)}>✓</button>
            <div className="task-content"><strong>{task.title}</strong><time>{task.dueAt < Date.now() ? 'Overdue · ' : ''}{formatDue(task.dueAt)}</time></div>
            <button className="delete" title="Delete task" onClick={() => void removeTask(task.id)}>×</button>
          </li>)}</ul>
        )}
      </section>
    </main>
  );
}
