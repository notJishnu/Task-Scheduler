import { getTaskIdFromAlarm, scheduleTaskAlarm } from '../lib/alarms';
import { getTasks, saveTask } from '../lib/storage';

// Chrome requires an icon for every notification. A PNG data URL is used so it
// stays valid in the packaged extension without relying on unsupported SVG icons.
const NOTIFICATION_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const SNOOZE_INTERVAL_MS = 10 * 60 * 1000;
const SNOOZE_DURATION_MS = 60 * 60 * 1000;

async function showNotification(
  notificationId: string,
  title: string,
  message: string,
  buttons: chrome.notifications.ButtonOptions[] = [],
): Promise<void> {
  await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: NOTIFICATION_ICON,
    title,
    message,
    priority: 2,
    buttons,
  });
}

async function restoreActiveAlarms(): Promise<void> {
  const tasks = await getTasks();
  await Promise.all(tasks.filter((task) => task.status === 'active').map(scheduleTaskAlarm));
}

chrome.runtime.onInstalled.addListener(async () => {
  await restoreActiveAlarms();
});

chrome.runtime.onStartup.addListener(() => void restoreActiveAlarms());

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const taskId = getTaskIdFromAlarm(alarm.name);
  if (!taskId) return;

  const task = (await getTasks()).find((item) => item.id === taskId && item.status === 'active');
  if (!task) return;

  await showNotification(`reminder:${task.id}`, 'Task reminder', task.title, [
    { title: 'Complete' },
    { title: 'Snooze every 10 min for 1 hour' },
  ]);

  // A snooze sequence is scheduled one reminder at a time. This makes it easy
  // to cancel immediately when the task is completed or deleted.
  if (task.snoozeUntil && task.dueAt < task.snoozeUntil) {
    const nextReminderAt = task.dueAt + SNOOZE_INTERVAL_MS;
    if (nextReminderAt <= task.snoozeUntil) {
      task.dueAt = nextReminderAt;
      await saveTask(task);
      await scheduleTaskAlarm(task);
      return;
    }
  }

  // The final snoozed reminder has fired. Keep the task active so the user can
  // still complete or delete it, but do not schedule another notification.
  if (task.snoozeUntil) {
    task.snoozeUntil = undefined;
    await saveTask(task);
  }
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!notificationId.startsWith('reminder:')) return;
  const taskId = notificationId.slice(9);
  const task = (await getTasks()).find((item) => item.id === taskId);
  if (!task) return;

  if (buttonIndex === 0) {
    task.status = 'completed';
    task.snoozeUntil = undefined;
  } else {
    const snoozeStartedAt = Date.now();
    task.dueAt = snoozeStartedAt + SNOOZE_INTERVAL_MS;
    task.snoozeUntil = snoozeStartedAt + SNOOZE_DURATION_MS;
  }
  await saveTask(task);
  await scheduleTaskAlarm(task);
  await chrome.notifications.clear(notificationId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'SHOW_TEST_NOTIFICATION') return;

  void (async () => {
    try {
      const permission = await new Promise<string>((resolve) => chrome.notifications.getPermissionLevel(resolve));
      if (permission !== 'granted') {
        sendResponse({ ok: false, message: `Notifications are ${permission}. Enable them in Chrome and Windows settings.` });
        return;
      }
      await showNotification(`test:${Date.now()}`, 'Task Bell is working', 'This is a test notification.');
      sendResponse({ ok: true, message: 'Test notification sent.' });
    } catch (error) {
      sendResponse({ ok: false, message: error instanceof Error ? error.message : 'Chrome could not create the notification.' });
    }
  })();
  return true;
});
