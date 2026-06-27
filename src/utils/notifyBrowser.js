export const registerReminderSW = async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('[reminders] SW registration failed', err);
  }
};

export const ensureNotificationPermission = async () => {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'default') {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
};

export const notifyBrowser = async (title, body, { path = '/daily-note', tag } = {}) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, tag, data: { path } });
      return;
    }
    // eslint-disable-next-line no-new
    new Notification(title, { body, tag });
  } catch (err) {
    console.warn('[reminders] notifyBrowser failed', err);
  }
};
