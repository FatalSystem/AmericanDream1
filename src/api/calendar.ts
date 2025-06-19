import api from "../config";

export const calendarApi = {
  createCalendar: async (eventData: any) => {
    // Prepare camelCase fields for backend compatibility
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const data = {
      ...eventData,
      startDate: eventData.start_date,
      endDate: eventData.end_date,
      teacherName: eventData.teacher_name,
    };
    delete data.start_date;
    delete data.end_date;
    delete data.teacher_name;
    
    console.log("createCalendar - original eventData:", eventData);
    console.log("createCalendar - processed data:", data);
    
    const response = await fetch('/api/proxy/calendar/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({
        events: {
          added: [data],
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  },
  
  getCalendar: async () => {
    const response = await api.get("/calendar/events");
    return response.data;
  },
  
  updateCalendar: async (id: string, eventData: any) => {
    const response = await api.put(`/calendars/${id}`, eventData);
    return response.data;
  },
  
  deleteCalendar: async (id: string) => {
    const response = await api.delete(`/calendar/events/${id}`);
    return response.data;
  },

  getStudentRemainingClasses: async (studentId: string) => {
    const response = await api.get(`/students/${studentId}/remaining-classes`);
    return response.data;
  },

  getAllEvents: async () => {
    const response = await api.get("/calendar/events");
    return response.data;
  },

  checkEventOverlap: async (teacherId: string | number, startDate: string, endDate: string) => {
    const response = await api.post("/calendar/events/check-overlap", {
      teacherId,
      startDate,
      endDate
    });
    return response.data;
  }
}; 