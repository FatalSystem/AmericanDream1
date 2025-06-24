import api from "../config";

export const calendarApi = {
  // Get all events (using existing lessons API)
  getAllEvents: async () => {
    try {
      const response = await api.get("/lessons");
      return response.data;
    } catch (error) {
      console.error("Error fetching events:", error);
      throw error;
    }
  },

  // Get events by date range (using existing lessons API)
  getEventsByDateRange: async (startDate: string, endDate: string) => {
    try {
      const response = await api.get("/lessons", {
        params: { start_date: startDate, end_date: endDate }
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching events by date range:", error);
      throw error;
    }
  },

  // Create new event (using existing lessons API)
  createEvent: async (eventData: any) => {
    try {
      const response = await api.post("/lessons", eventData);
      return response.data;
    } catch (error) {
      console.error("Error creating event:", error);
      throw error;
    }
  },

  // Create calendar event (alias for createEvent)
  createCalendar: async (eventData: any) => {
    try {
      const response = await api.post("/lessons", eventData);
      return response.data;
    } catch (error) {
      console.error("Error creating calendar event:", error);
      throw error;
    }
  },

  // Get student remaining classes
  getStudentRemainingClasses: async (studentId: string) => {
    try {
      const response = await api.get(`/students/${studentId}/remaining-classes`);
      return response.data;
    } catch (error) {
      console.error("Error fetching student remaining classes:", error);
      throw error;
    }
  },

  // Update event (using existing lessons API)
  updateEvent: async (eventData: any) => {
    try {
      const response = await api.put(`/lessons/${eventData.id}`, eventData);
      return response.data;
    } catch (error) {
      console.error("Error updating event:", error);
      throw error;
    }
  },

  // Delete event (using existing lessons API)
  deleteEvent: async (eventId: string | number, deletionType?: string, occurrenceDate?: string) => {
    try {
      const response = await api.delete(`/lessons/${eventId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting event:", error);
      throw error;
    }
  },

  // Get time ranges (unavailable times)
  getTimeRanges: async () => {
    try {
      const response = await api.get("/calendar/time-ranges");
      return response.data;
    } catch (error) {
      console.error("Error fetching time ranges:", error);
      throw error;
    }
  },

  // Create time range (unavailable time)
  createTimeRange: async (timeRangeData: any) => {
    try {
      const response = await api.post("/calendar/time-ranges", timeRangeData);
      return response.data;
    } catch (error) {
      console.error("Error creating time range:", error);
      throw error;
    }
  },

  // Delete time range
  deleteTimeRange: async (timeRangeId: string | number) => {
    try {
      const response = await api.delete(`/calendar/time-ranges/${timeRangeId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting time range:", error);
      throw error;
    }
  },

  // Get lesson by ID (using existing lessons API)
  getLessonById: async (lessonId: string | number) => {
    try {
      const response = await api.get(`/lessons/${lessonId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching lesson by ID:", error);
      throw error;
    }
  }
}; 