import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Default timezone is PST
const DEFAULT_TIMEZONE = 'America/Los_Angeles'; // PST

interface TimezoneContextType {
  timezone: string;
  setTimezone: (timezone: string) => void;
}

const TimezoneContext = createContext<TimezoneContextType>({
  timezone: DEFAULT_TIMEZONE,
  setTimezone: () => {},
});

interface TimezoneProviderProps {
  children: ReactNode;
}

export const TimezoneProvider: React.FC<TimezoneProviderProps> = ({ children }) => {
  // Try to get the timezone from localStorage or use browser's timezone or default to PST
  const getInitialTimezone = (): string => {
    const savedTimezone = localStorage.getItem('userTimezone');
    if (savedTimezone) return savedTimezone;
    
    try {
      // Try to get the user's timezone from their browser
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return browserTimezone || DEFAULT_TIMEZONE;
    } catch (err) {
      // If there's any error, default to PST
      return DEFAULT_TIMEZONE;
    }
  };

  const [timezone, setTimezoneState] = useState<string>(getInitialTimezone());

  const setTimezone = (newTimezone: string) => {
    localStorage.setItem('userTimezone', newTimezone);
    setTimezoneState(newTimezone);
  };

  useEffect(() => {
    // If the timezone changes, save it to localStorage
    localStorage.setItem('userTimezone', timezone);
  }, [timezone]);

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = () => useContext(TimezoneContext); 