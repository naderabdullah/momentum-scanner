// lib/db.ts
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Alert } from './types';

const DB_NAME = 'ProScannerDB';
const DB_VERSION = 1;
const ALERT_STORE_NAME = 'alerts';

interface ScannerDB extends DBSchema {
  [ALERT_STORE_NAME]: {
    key: number;
    value: Alert;
  };
}

let dbPromise: Promise<IDBPDatabase<ScannerDB>> | null = null;

const getDbInstance = (): Promise<IDBPDatabase<ScannerDB>> | null => {
  // This check ensures we only try to access indexedDB in the browser
  if (typeof window === 'undefined') {
    return null;
  }
  if (!dbPromise) {
    // Dynamic import to prevent server-side execution
    dbPromise = import('idb').then(({ openDB }) => {
      return openDB<ScannerDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(ALERT_STORE_NAME)) {
            db.createObjectStore(ALERT_STORE_NAME, { keyPath: 'id' });
          }
        },
      });
    });
  }
  return dbPromise;
};

export const addAlertToDB = async (alert: Alert) => {
  const db = getDbInstance();
  if (db) {
    const dbInstance = await db;
    await dbInstance.put(ALERT_STORE_NAME, alert);
  }
};

export const loadAlertsFromDB = async (): Promise<Alert[]> => {
  const db = getDbInstance();
  if (db) {
    const dbInstance = await db;
    return await dbInstance.getAll(ALERT_STORE_NAME);
  }
  return [];
};

// --- NEW: Function to clear all alerts from IndexedDB ---
export const clearAllAlertsFromDB = async () => {
    const db = getDbInstance();
    if (db) {
        const dbInstance = await db;
        await dbInstance.clear(ALERT_STORE_NAME);
    }
};

export const cleanupOldAlerts = async () => {
    const db = getDbInstance();
    if (!db) return;

    const dbInstance = await db;
    const eightHoursAgo = Date.now() - 8 * 60 * 60 * 1000;
    const tx = dbInstance.transaction(ALERT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(ALERT_STORE_NAME);
    let cursor = await store.openCursor();

    while(cursor) {
      if (cursor.value.timestamp < eightHoursAgo) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
};
