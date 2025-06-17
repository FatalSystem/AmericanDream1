import api from "../config";

export const calendarApi = {
  createCalendar: async (eventData: any) => {
    const response = await api.post("/calendar/events", eventData);
    return response.data;
  },
  
  getCalendar: async () => {
    const response = await api.get("/calendar");
    return response.data;
  },
  
  updateCalendar: async (id: string, eventData: any) => {
    const response = await api.put(`/calendar/${id}`, eventData);
    return response.data;
  },
  
  deleteCalendar: async (id: string) => {
    const response = await api.delete(`/calendar/${id}`);
    return response.data;
  },

  getStudentRemainingClasses: async (studentId: string) => {
    const response = await api.get(`/students/${studentId}/remaining-classes`);
    return response.data;
  }
}; 