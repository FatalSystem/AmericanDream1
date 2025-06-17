import { createContext, useContext } from "react";

export interface TeacherWithColor {
  id: number;
  first_name: string;
  last_name: string;
  color: string;
}

interface CalendarContextType {
  teachers: TeacherWithColor[];
  setTeachers: (teachers: TeacherWithColor[]) => void;
}

export const CalendarContext = createContext<CalendarContextType>({
  teachers: [],
  setTeachers: () => {},
});

export const useCalendar = () => useContext(CalendarContext);
