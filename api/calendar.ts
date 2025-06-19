import axios from "axios";

// Типи та інтерфейси
export interface Student {
  id: number;
  first_name: string;
  last_name: string;
}

export interface ClassType {
  id: number;
  name: string;
}

export interface CalendarLink {
  id: number;
  calendar_id: number;
  link: string;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: number;
  startDate: string;
  endDate: string;
  name: string;
  student_id: number | null;
  teacher_id: number;
  class_type: string;
  class_status: string;
  payment_status: string;
  student_name_text: string;
  calendar_id: number;
  recurrenceRule?: string;
  duration?: number;
  isUnavailable?: boolean;
  teacherColor?: string;
  eventColor?: string;
  createdAt: string | null;
  updatedAt: string | null;
  Student?: Student;
  Teacher?: BackendTeacher;
  class_type_details?: ClassType;
  CalendarLink?: CalendarLink | null;
}

export interface TeacherRate {
  id: number;
  teacher_id: number;
  class_type_id: number;
  rate: string;
  createdAt: string;
  updatedAt: string;
  class_type: {
    name: string;
  };
}

export interface BackendTeacher {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  token: string;
  role_id: number;
  resetToken: string | null;
  resetTokenExpiry: string | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  TeacherRates: TeacherRate[];
}

interface UpdateBalancesParams {
  student_id: number;
  teacher_id: number;
  lesson_type: string;
  status: 'completed' | 'cancelled' | 'student_no_show' | 'teacher_no_show';
}

// Axios instance
const api = axios.create({
  baseURL: "/api/proxy",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!window.location.pathname.includes("/login")) {
        localStorage.removeItem("token");
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export const calendarApi = {
  login: async (email: string, password: string) => {
    const response = await api.post("/auth/login", { email, password });
    const { token, user } = response.data;
    localStorage.setItem("token", token);
    return { token, user };
  },

  getLessons: async () => {
    const response = await api.get("/calendar/events");
    return response.data;
  },

  getTeachers: async () => {
    const response = await api.get("/teachers");
    return response.data;
  },

  createLesson: async (lesson: Omit<Event, "id" | "createdAt" | "updatedAt">) => {
    const response = await api.post("/calendar/events", lesson);
    return response.data;
  },

  updateLesson: async (id: number, lesson: Partial<Event>) => {
    const response = await api.put(`/calendar/events/${id}`, lesson);
    return response.data;
  },

  deleteLesson: async (id: number) => {
    const response = await api.delete(`/calendar/events/${id}`);
    return response.data;
  },

  createCalendar: async (data: {
    class_type: string;
    student_id: number;
    teacher_id: number;
    class_status: string;
    payment_status: string;
    start_date: string;
    end_date: string;
    duration: number;
  }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const eventData = {
      ...data,
      startDate: data.start_date,
      endDate: data.end_date,
    } as Record<string, unknown>;
    delete eventData.start_date;
    delete eventData.end_date;
    const response = await fetch("/api/proxy/calendar/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        events: {
          added: [eventData]
        }
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  },

  updateCalendar: async (
    id: number,
    calendar: {
      startDate?: string;
      endDate?: string;
      class_status?: string;
      payment_status?: string;
    }
  ) => {
    const response = await api.put(`/calendars/${id}`, calendar);
    return response.data;
  },

  getAllEvents: async () => {
    const response = await api.get("/calendar/events");
    return response.data;
  },

  updateEvent: async (id: string, data: { lesson_id: number }) => {
    const response = await api.put(`/calendar/events/${id}`, data);
    return response.data;
  },

  updateBalances: async (params: UpdateBalancesParams) => {
    const response = await api.post('/api/balances/update', params);
    return response.data;
  },

  checkStudentBalance: async (studentId: number) => {
    const response = await api.get(`/api/students/${studentId}/balance`);
    return response.data;
  },

  checkAndRemoveReservedLessons: async () => {
    const response = await axios.post('/api/lessons/check-reserved');
    return response.data;
  },

  getStudentRemainingClasses: async (studentId: number) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`/api/proxy/students/${studentId}/remaining-classes`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Failed to fetch student class balance');
    return await response.json();
  },

  async checkAndDeleteReservedClasses() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const response = await fetch("/api/proxy/calendar/check-reserved", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return await response.json();
  },

  async updateLessonStatus(lessonId: number, status: string) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const response = await fetch(`/api/proxy/lessons/${lessonId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status }),
    });
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  },

  async updateEventStatus(eventId: number, status: string) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`/api/proxy/calendar/events/${eventId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ class_status: status }),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to update event status");
    return await res.json();
  },

  getAvailability: async () => {
    const res = await fetch("/api/proxy/availability", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!res.ok) throw new Error("Failed to fetch availability");
    return res.json();
  },
};

// Helper function to convert backend lesson to frontend lesson format
export const convertBackendLessonToFrontend = (backendLesson: Event) => {
  const startDate = new Date(backendLesson.startDate);
  const endDate = new Date(backendLesson.endDate);

  return {
    id: backendLesson.id.toString(),
    title: backendLesson.name || "Event",
    start: startDate,
    end: endDate,
    teacherId: backendLesson.teacher_id.toString(),
    teacherName: backendLesson.Teacher ? `${backendLesson.Teacher.first_name} ${backendLesson.Teacher.last_name}` : "",
    color: "#3174ad",
  };
}; 