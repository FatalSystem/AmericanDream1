import React, { createContext, useContext, useState, useEffect } from "react";
import { calendarApi } from "../api/calendar";

export interface TeacherWithColor {
  id: number;
  first_name: string;
  last_name: string;
  color: string;
}

interface CalendarContextType {
  teachers: TeacherWithColor[];
  loading: boolean;
  error: string | null;
  refreshTeachers: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(
  undefined
);

export const useCalendarContext = () => {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error(
      "useCalendarContext must be used within a CalendarProvider"
    );
  }
  return context;
};

interface CalendarProviderProps {
  children: React.ReactNode;
}

export const CalendarProvider: React.FC<CalendarProviderProps> = ({
  children,
}) => {
  const [teachers, setTeachers] = useState<TeacherWithColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate colors for teachers
  const generateTeacherColors = (teachersList: any[]): TeacherWithColor[] => {
    const colors = [
      "#4CAF50",
      "#2196F3",
      "#FF9800",
      "#9C27B0",
      "#F44336",
      "#00BCD4",
      "#795548",
      "#607D8B",
      "#E91E63",
      "#3F51B5",
      "#009688",
      "#FFC107",
      "#8BC34A",
      "#CDDC39",
      "#FF5722",
    ];

    return teachersList.map((teacher, index) => ({
      id: teacher.id,
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      color: colors[index % colors.length],
    }));
  };

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch teachers from API
      const response = await fetch("/api/teachers");
      if (!response.ok) {
        throw new Error("Failed to fetch teachers");
      }

      const teachersData = await response.json();
      const teachersWithColors = generateTeacherColors(teachersData);
      setTeachers(teachersWithColors);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch teachers");
      console.error("Error fetching teachers:", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshTeachers = async () => {
    await fetchTeachers();
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const value: CalendarContextType = {
    teachers,
    loading,
    error,
    refreshTeachers,
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
};
