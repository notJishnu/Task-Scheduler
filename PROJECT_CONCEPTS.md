# Task Bell: Concepts Used in This Project

Task Bell is a Chrome extension, rather than a normal web page. Its reminder flow is:

```text
Popup UI -> save task locally -> create Chrome alarm
Chrome alarm -> wake background service worker -> show notification
Notification action -> update saved task and its alarm
```

## 1. Chrome extension architecture

A Chrome extension is made of small programs with distinct responsibilities:

- **Popup:** the interface opened from the extension toolbar icon.
- **Background service worker:** code Chrome runs for background events, such as alarms and notification clicks.
- **Manifest:** the extension configuration, including its permissions and entry points.
- **Chrome APIs:** browser-provided features such as storage, alarms, and notifications.

In this project, `src/popup/Popup.tsx` is the popup interface, `src/background/service-worker.ts` handles reminders, and `manifest.config.ts` connects the pieces.

The popup may close as soon as a user clicks elsewhere, so it cannot be responsible for future reminders. The background service worker performs that work.

## 2. Manifest V3 and permissions

The extension uses Chrome's current extension format, Manifest V3. The manifest declares these permissions:

```ts
permissions: ['alarms', 'notifications', 'storage']
```

- `storage` saves tasks in the browser.
- `alarms` schedules future wake-up events.
- `notifications` shows system notifications.

Permissions are explicit because Chrome extensions can access browser capabilities that normal web pages cannot.

The manifest declares a module service worker:

```ts
background: {
  service_worker: 'src/background/service-worker.ts',
  type: 'module',
}
```

This worker is event-driven. Chrome starts it when needed and can stop it afterward, so it must not rely on ordinary in-memory variables for important data. Persistent data belongs in Chrome storage.

## 3. React and the popup interface

React builds the popup from state. The project keeps UI values such as tasks, title, date, and time in `useState` hooks:

```ts
const [tasks, setTasks] = useState<Task[]>([]);
const [title, setTitle] = useState('');
```

Inputs are controlled by React:

```tsx
<input value={title} onChange={(event) => setTitle(event.target.value)} />
```

When a user types, the event updates state and React re-renders the affected interface. The popup's state lasts only while the popup is open; saved task data is stored separately.

## 4. State versus persistent data

There are two kinds of data in Task Bell:

| Data | Location | Lifetime |
| --- | --- | --- |
| UI state | React `useState` | While the popup is open |
| Tasks | `chrome.storage.local` | Across popup closure and browser restarts |

The popup loads tasks after its first render:

```ts
useEffect(() => {
  void getTasks().then(setTasks);
}, []);
```

`useEffect` runs after rendering. The empty dependency array means this effect runs when the popup first opens.

## 5. TypeScript and the task model

The `Task` interface defines the data every task must have:

```ts
export interface Task {
  id: string;
  title: string;
  dueAt: number;
  status: 'active' | 'completed';
  createdAt: number;
}
```

TypeScript checks that the popup, storage code, alarms, and service worker use the same task shape. The union type for `status` prevents invalid status values.

`dueAt` is a Unix timestamp in milliseconds. It is easy to compare with the current time:

```ts
task.dueAt < Date.now()
```

## 6. Local task storage

`src/lib/storage.ts` wraps Chrome's asynchronous storage API in reusable functions:

- `getTasks()` reads all tasks.
- `saveTasks(tasks)` saves the full list.
- `saveTask(task)` adds a new task or updates an existing one.
- `deleteTask(id)` removes a task.

`saveTask` is an **upsert**: it updates a task when its ID already exists, or inserts it when it does not.

## 7. Unique IDs

New tasks use `crypto.randomUUID()` to get a unique ID. IDs are more reliable than titles because multiple tasks can have the same title. The ID links a task to its alarm and notification actions.

## 8. Chrome alarms

`src/lib/alarms.ts` converts an active task into a Chrome alarm:

```ts
chrome.alarms.create(`task:${task.id}`, { when: task.dueAt });
```

The alarm name contains the task ID. When an alarm fires, the service worker extracts the ID, loads the saved task, and shows its notification.

An old alarm with the same name is cleared before creating a new one. This prevents duplicate reminders after rescheduling.

Chrome alarms wake the extension at approximately the chosen time; they are not a real-time guarantee. A sleeping computer or browser resource limits can delay delivery.

## 9. Background service worker

The worker receives alarm events:

```ts
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Find the task and show a notification.
});
```

It verifies that the saved task still exists and remains active before notifying. This protects against stale alarms when a task was deleted or completed after being scheduled.

The extension also restores active alarms when it is installed, updated, or Chrome starts. The saved task list is the durable source of truth; alarms can be rebuilt from it.

## 10. Notifications and actions

The worker creates a desktop notification for each reminder. The notification provides **Complete** and **Snooze 10 min** actions.

When the user chooses an action, `chrome.notifications.onButtonClicked` receives the click:

```text
Complete -> mark task completed -> save it -> cancel its alarm
Snooze -> assign a new time -> save it -> schedule a new alarm
```

Chrome notifications require a compatible image, so the project uses PNG icons rather than SVG icons.

## 11. Popup-to-worker messaging

The popup sends a message to ask the background worker to display the test notification:

```ts
chrome.runtime.sendMessage({ type: 'SHOW_TEST_NOTIFICATION' })
```

The worker listens for that message and replies with success or an error. This is an internal API between separate extension components. Returning `true` from the listener keeps the response channel open while asynchronous work completes.

## 12. Dates, time, and timezones

The UI uses separate date and time inputs. Their values are combined into a local date/time and converted into a timestamp:

```ts
const due = new Date(`${date}T${time}`).getTime();
```

The helper functions account for timezone offsets when filling date and time controls. This is necessary because ISO strings use UTC, whereas the reminder should follow the user's local time.

For display, `Intl.DateTimeFormat` formats timestamps using the browser's locale and timezone.

## 13. Derived state with `useMemo`

The upcoming list is calculated from the saved task list instead of being stored separately:

```ts
const activeTasks = useMemo(
  () => tasks
    .filter((task) => task.status === 'active')
    .sort((a, b) => a.dueAt - b.dueAt),
  [tasks],
);
```

This keeps one source of truth. `useMemo` recalculates the list only when `tasks` changes.

## 14. Build tools

The project uses:

- **React** for the user interface and state.
- **TypeScript** for safer JavaScript and editor assistance.
- **Vite** for development and production bundling.
- **CRXJS** so Vite can build a Chrome extension from the manifest configuration.

`npm run build` generates icons, type-checks TypeScript, and creates the installable extension in `dist`.

## 15. Possible next upgrades

- Edit existing tasks and reschedule their alarms.
- Add repeating reminders.
- Add task categories and priorities.
- Use `chrome.storage.sync` for optional cross-device settings.
- Add JSON import and export.
- Display notification permission status in the popup.
- Add tests for storage and alarm helpers.
- Improve keyboard navigation and accessibility.
