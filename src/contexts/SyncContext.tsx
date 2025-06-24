import React, { createContext, useContext, useState, useCallback } from "react";

interface SyncContextType {
  refreshCalendar: () => void;
  refreshClasses: () => void;
  setRefreshCalendar: (callback: () => void) => void;
  setRefreshClasses: (callback: () => void) => void;
  notifyCalendarUpdate: () => void;
  notifyClassesUpdate: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const useSyncContext = () => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error("useSyncContext must be used within a SyncProvider");
  }
  return context;
};

interface SyncProviderProps {
  children: React.ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [refreshCalendarCallback, setRefreshCalendarCallback] = useState<
    (() => void) | null
  >(null);
  const [refreshClassesCallback, setRefreshClassesCallback] = useState<
    (() => void) | null
  >(null);

  const setRefreshCalendar = useCallback((callback: () => void) => {
    setRefreshCalendarCallback(() => callback);
  }, []);

  const setRefreshClasses = useCallback((callback: () => void) => {
    setRefreshClassesCallback(() => callback);
  }, []);

  const refreshCalendar = useCallback(() => {
    if (refreshCalendarCallback) {
      refreshCalendarCallback();
    }
  }, [refreshCalendarCallback]);

  const refreshClasses = useCallback(() => {
    if (refreshClassesCallback) {
      refreshClassesCallback();
    }
  }, [refreshClassesCallback]);

  const notifyCalendarUpdate = useCallback(() => {
    refreshCalendar();
  }, [refreshCalendar]);

  const notifyClassesUpdate = useCallback(() => {
    refreshClasses();
  }, [refreshClasses]);

  const value: SyncContextType = {
    refreshCalendar,
    refreshClasses,
    setRefreshCalendar,
    setRefreshClasses,
    notifyCalendarUpdate,
    notifyClassesUpdate,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};
