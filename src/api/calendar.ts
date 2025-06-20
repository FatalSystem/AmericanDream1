import api from "../config";

export const calendarApi = {
  createCalendar: async (eventData: any) => {
    // Prepare camelCase fields for backend compatibility
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
    console.log("createCalendar - final request payload:", {
      events: {
        added: [data],
      },
    });
    
    try {
      const response = await api.post('/calendar/events', {
        events: {
          added: [data],
        },
      });
      
      console.log("createCalendar - server response:", response.data);
      
      // Повертаємо дані створеного події з ID
      const createdEvent = response.data?.events?.added?.[0] || response.data;
      console.log("createCalendar - returning created event:", createdEvent);
      return createdEvent;
    } catch (error) {
      console.error("Create failed:", error);
      console.error("Error response:", error.response?.data);
      throw error;
    }
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

  deleteCalendarEvent: async (eventId: string) => {
    console.log("deleteCalendarEvent - deleting event ID:", eventId);
    
    try {
      const response = await api.delete(`/calendar/events/${eventId}`);
      
      console.log("deleteCalendarEvent - server response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Delete failed:", error);
      console.error("Error response:", error.response?.data);
      throw error;
    }
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
  },

  updateCalendarEvent: async (eventData: any) => {
    console.log("updateCalendarEvent - original eventData:", eventData);
    
    // Prepare camelCase fields for backend compatibility
    const data = {
      id: eventData.id,
      title: eventData.title,
      startDate: eventData.start_date || eventData.start,
      endDate: eventData.end_date || eventData.end,
      teacher_id: eventData.teacher_id || eventData.extendedProps?.teacherId || eventData.extendedProps?.teacher_id,
      student_id: eventData.student_id || eventData.extendedProps?.studentId || eventData.extendedProps?.student_id,
      teacher_name: eventData.teacher_name || eventData.extendedProps?.teacher_name,
      student_name: eventData.student_name || eventData.extendedProps?.student_name_text,
      class_status: eventData.class_status || eventData.extendedProps?.class_status,
      class_type: eventData.class_type || eventData.extendedProps?.class_type,
      payment_status: eventData.payment_status || eventData.extendedProps?.payment_status,
    };
    
    console.log("updateCalendarEvent - processed data:", data);
    
    try {
      const response = await api.post('/calendar/events', {
        events: {
          updated: [data],
        },
      });
      
      // Повертаємо дані оновленого події
      const updatedEvent = response.data?.events?.updated?.[0] || response.data;
      return updatedEvent;
    } catch (error) {
      console.error("Update failed:", error);
      throw error;
    }
  }
}; 