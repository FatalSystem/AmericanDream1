import api from '../config';
import dayjs from 'dayjs';
import { DEFAULT_DB_TIMEZONE } from './timezone';

// Типи для синхронізації
export interface LessonData {
  id: number;
  lesson_date: string;
  start_time?: string;
  end_time?: string;
  class_status: string;
  student_id: number;
  teacher_id: number;
  class_type_id: number;
  Student?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  Teacher?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  class_type?: {
    id: number;
    name: string;
  };
}

export interface CalendarEventData {
  id: string;
  class_type: string;
  student_id?: number;
  teacher_id: number;
  class_status: string;
  payment_status?: string;
  startDate: string;
  endDate: string;
  name?: string;
  title?: string;
  student_name_text?: string;
  teacher_name?: string;
}

// Функція для синхронізації уроку з календарем
export const syncLessonToCalendar = async (lesson: LessonData, action: 'create' | 'update' | 'delete') => {
  try {
    console.log(`🔄 Syncing lesson to calendar: ${action}`, lesson);

    // Підготовка даних для календаря
    const eventData: CalendarEventData = {
      id: String(lesson.id),
      class_type: lesson.class_type?.name?.toLowerCase() || 'regular',
      student_id: lesson.student_id,
      teacher_id: lesson.teacher_id,
      class_status: lesson.class_status,
      payment_status: 'paid', // За замовчуванням
      startDate: lesson.start_time 
        ? `${lesson.lesson_date}T${lesson.start_time}`
        : `${lesson.lesson_date}T00:00:00`,
      endDate: lesson.end_time 
        ? `${lesson.lesson_date}T${lesson.end_time}`
        : `${lesson.lesson_date}T01:00:00`,
      name: lesson.Student 
        ? `${lesson.Student.first_name} ${lesson.Student.last_name}`
        : 'Unknown Student',
      student_name_text: lesson.Student 
        ? `${lesson.Student.first_name} ${lesson.Student.last_name}`
        : 'Unknown Student',
      teacher_name: lesson.Teacher 
        ? `${lesson.Teacher.first_name} ${lesson.Teacher.last_name}`
        : 'Unknown Teacher'
    };

    // Конвертація в UTC для збереження
    const startDate = dayjs.tz(eventData.startDate, DEFAULT_DB_TIMEZONE);
    const endDate = dayjs.tz(eventData.endDate, DEFAULT_DB_TIMEZONE);
    
    const calendarData = {
      ...eventData,
      startDate: startDate.utc().format(),
      endDate: endDate.utc().format()
    };

    switch (action) {
      case 'create':
        await api.post('/calendar/events', {
          events: { added: [calendarData] }
        });
        break;
      
      case 'update':
        await api.put(`/calendar/events/${lesson.id}`, calendarData);
        break;
      
      case 'delete':
        await api.delete(`/calendar/events/${lesson.id}`);
        break;
    }

    console.log(`✅ Lesson synced to calendar: ${action}`);
  } catch (error) {
    console.error(`❌ Error syncing lesson to calendar: ${action}`, error);
  }
};

// Функція для синхронізації події календаря з уроками
export const syncEventToLessons = async (event: CalendarEventData, action: 'create' | 'update' | 'delete') => {
  try {
    console.log(`🔄 Syncing calendar event to lessons: ${action}`, event);

    // Підготовка даних для уроку
    const lessonData = {
      lesson_date: dayjs(event.startDate).format('YYYY-MM-DD'),
      start_time: dayjs(event.startDate).format('HH:mm:ss'),
      end_time: dayjs(event.endDate).format('HH:mm:ss'),
      class_status: event.class_status,
      student_id: event.student_id,
      teacher_id: event.teacher_id,
      class_type_id: getClassTypeId(event.class_type)
    };

    switch (action) {
      case 'create':
        await api.post('/lessons', lessonData);
        break;
      
      case 'update':
        await api.put(`/lessons/${event.id}`, lessonData);
        break;
      
      case 'delete':
        await api.delete(`/lessons/${event.id}`);
        break;
    }

    console.log(`✅ Calendar event synced to lessons: ${action}`);
  } catch (error) {
    console.error(`❌ Error syncing calendar event to lessons: ${action}`, error);
  }
};

// Допоміжна функція для отримання ID типу класу
const getClassTypeId = (classType: string): number => {
  const typeMap: { [key: string]: number } = {
    'trial': 1,
    'regular': 2,
    'instant': 3,
    'group': 4,
    'training': 5
  };
  return typeMap[classType.toLowerCase()] || 2; // За замовчуванням regular
};

// Функція для глобальної синхронізації
export const triggerGlobalSync = (source: string, data: any) => {
  console.log(`📢 Global sync triggered from: ${source}`, data);
  
  // Встановлюємо timestamp для синхронізації
  const timestamp = Date.now().toString();
  localStorage.setItem('calendarEventsUpdated', timestamp);
  localStorage.setItem('lessonsUpdated', timestamp);
  
  // Відправляємо події для інших компонентів
  window.postMessage({ type: 'calendarEventsUpdated', source, data }, '*');
  window.postMessage({ type: 'lessonsUpdated', source, data }, '*');
  
  // Додатково відправляємо кастомні події
  window.dispatchEvent(new CustomEvent('calendarUpdate', { 
    detail: { source, data, timestamp } 
  }));
  window.dispatchEvent(new CustomEvent('lessonsUpdate', { 
    detail: { source, data, timestamp } 
  }));
  
  console.log(`✅ Global sync notifications sent from: ${source}`);
}; 