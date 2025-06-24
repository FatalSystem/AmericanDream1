import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

// Default timezone is PST (database timezone)
export const DEFAULT_DB_TIMEZONE = 'America/Los_Angeles'; // PST

/**
 * Convert a date string from database timezone to user timezone
 * @param dateStr - Date string in database timezone
 * @param userTimezone - User's timezone
 * @returns Dayjs object in user's timezone
 */
export const convertToUserTimezone = (dateStr: string | null | undefined, userTimezone: string): dayjs.Dayjs | null => {
  if (!dateStr) return null;
  
  try {
    console.log("🔍 convertToUserTimezone - Input:", dateStr, "to timezone:", userTimezone);
    
    // CRITICAL FIX: Add special handling for recurring events to prevent time shifts
    // Check if the caller has included any context about the data
    const eventContext = (window as any).__currentEventContext;
    if (eventContext) {
      // If we're handling a recurring event, skip timezone conversion
      if (eventContext.isRecurringEvent || 
          eventContext.id?.includes('_generated:') ||
          eventContext.id?.includes('occurrence')) {
        console.log("⚠️ RECURRING EVENT CONTEXT DETECTED - returning date without timezone conversion");
        return dayjs(String(dateStr));
      }
    }
    
    let parsedDateTime;
    
    // Eğer ISO format (Z ile) geliyorsa, UTC olarak parse et
    if (String(dateStr).includes('Z') || String(dateStr).includes('T') && String(dateStr).includes('+')) {
      parsedDateTime = dayjs(String(dateStr)); // UTC olarak parse et
      console.log("🔍 Parsed as UTC:", parsedDateTime.format());
    } else {
      // String format geliyorsa PST olarak parse et
      parsedDateTime = dayjs.tz(String(dateStr), DEFAULT_DB_TIMEZONE);
      console.log("🔍 Parsed as PST:", parsedDateTime.format());
    }
    
    const userDateTime = parsedDateTime.tz(userTimezone);
    console.log("🔍 Converted to user timezone:", userDateTime.format());
    
    return userDateTime;
  } catch (error) {
    console.error("Tarih dönüşüm hatası:", error, "Tarih:", dateStr);
    return null;
  }
};

/**
 * Convert a date from user timezone to database timezone
 * @param date - Dayjs date in user timezone
 * @returns Date string in database timezone
 */
export const convertToDbTimezone = (date: dayjs.Dayjs | Date | null): string | null => {
  if (!date) return null;
  
  try {
    // Dayjs nesnesine çevir ve DB timezone'a formatla
    let dayjsDate = date;
    
    // Eğer Date nesnesi ise dayjs'e çevir
    if (Object.prototype.toString.call(date) === '[object Date]') {
      dayjsDate = dayjs(date as Date);
    }
    
    // DB timezone'a çevir ve formatla
    return (dayjsDate as dayjs.Dayjs).tz(DEFAULT_DB_TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
  } catch (error) {
    console.error("DB tarih dönüşüm hatası:", error);
    return null;
  }
};

/**
 * Convert time from user timezone to database timezone
 * @param time - Time string in format HH:mm:ss
 * @param userTimezone - User's timezone
 * @returns Time string in database timezone
 */
export const convertTimeToDbTimezone = (time: string | null, userTimezone: string): string | null => {
  if (!time) return null;
  
  // Create a today date with the given time in user timezone
  const today = dayjs().format('YYYY-MM-DD');
  const dateTime = dayjs.tz(`${today} ${time}`, userTimezone);
  
  // Convert to database timezone and extract just the time portion
  return dateTime.tz(DEFAULT_DB_TIMEZONE).format('HH:mm:ss');
};

/**
 * Convert time from database timezone to user timezone
 * @param time - Time string in format HH:mm:ss from database
 * @param userTimezone - User's timezone
 * @returns Time string in user timezone
 */
export const convertTimeToUserTimezone = (time: string | null, userTimezone: string): string | null => {
  if (!time) return null;
  
  // Create a today date with the given time in database timezone
  const today = dayjs().format('YYYY-MM-DD');
  const dateTime = dayjs.tz(`${today} ${time}`, DEFAULT_DB_TIMEZONE);
  
  // Convert to user timezone and extract just the time portion
  return dateTime.tz(userTimezone).format('HH:mm:ss');
};

/**
 * Check if time conversion crosses a day boundary
 * @param time - Time string in format HH:mm:ss 
 * @param fromTimezone - Source timezone
 * @param toTimezone - Target timezone
 * @returns Number of days shifted (-1, 0, or 1)
 */
export const getDayShift = (time: string | null, fromTimezone: string, toTimezone: string): number => {
  if (!time) return 0;
  
  // Create a today date with the given time in source timezone
  const today = dayjs().format('YYYY-MM-DD');
  const sourceDateTime = dayjs.tz(`${today} ${time}`, fromTimezone);
  
  // Convert to target timezone
  const targetDateTime = sourceDateTime.tz(toTimezone);
  
  // Compare dates
  return targetDateTime.date() - sourceDateTime.date();
};

/**
 * Format date and time for display
 * @param dateTime - Dayjs date and time object
 * @param format - Output format
 * @returns Formatted date and time string
 */
export const formatDateTime = (dateTime: dayjs.Dayjs | null, format: string = 'YYYY-MM-DD HH:mm:ss'): string => {
  if (!dateTime) return '-';
  return dateTime.format(format);
};

/**
 * Format time for display
 * @param time - Time string in format HH:mm:ss
 * @param format - Output format
 * @returns Formatted time string
 */
export const formatTime = (time: string | null, format: string = 'HH:mm:ss'): string => {
  if (!time) return '-';
  return dayjs(`2000-01-01 ${time}`).format(format);
}; 