# Task Bell

A Manifest V3 Chrome extension for manually managed tasks and desktop reminders.

## Run locally

1. Run `npm install`.
2. Run `npm run build`.
3. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the generated `dist` folder.

Tasks are saved locally in Chrome. Each active task creates a `chrome.alarms` alarm; when it fires, a native notification offers **Complete** and **Snooze 10 min** actions.

After any change, use the reload button on the extension card in `chrome://extensions`, then open Task Bell and select **Send test notification**. If it does not appear, enable notifications for Google Chrome in Windows Settings → System → Notifications.
