import { useState, useCallback, useEffect } from "react";

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  ticketId?: string;
  read: boolean;
  createdAt: string;
}

const STORAGE_KEY = "notification-history";
const MAX_NOTIFICATIONS = 50;

let globalNotifications: AppNotification[] = [];
const listeners = new Set<(n: AppNotification[]) => void>();

function load(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(items: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function notify() {
  listeners.forEach((fn) => fn([...globalNotifications]));
}

// Initialize
globalNotifications = load();

export function pushNotification(n: Omit<AppNotification, "id" | "read" | "createdAt">) {
  const item: AppNotification = {
    ...n,
    id: crypto.randomUUID(),
    read: false,
    createdAt: new Date().toISOString(),
  };
  globalNotifications = [item, ...globalNotifications].slice(0, MAX_NOTIFICATIONS);
  persist(globalNotifications);
  notify();
}

export function useNotificationStore() {
  const [notifications, setNotifications] = useState<AppNotification[]>(globalNotifications);

  useEffect(() => {
    listeners.add(setNotifications);
    // sync on mount
    setNotifications([...globalNotifications]);
    return () => { listeners.delete(setNotifications); };
  }, []);

  const markRead = useCallback((id: string) => {
    globalNotifications = globalNotifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    persist(globalNotifications);
    notify();
  }, []);

  const markAllRead = useCallback(() => {
    globalNotifications = globalNotifications.map((n) => ({ ...n, read: true }));
    persist(globalNotifications);
    notify();
  }, []);

  const clearAll = useCallback(() => {
    globalNotifications = [];
    persist(globalNotifications);
    notify();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markRead, markAllRead, clearAll };
}
