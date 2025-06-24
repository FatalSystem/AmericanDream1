import React, { useState, useEffect, useMemo } from "react";
import { Button, Modal, Label, TextInput, Select } from "flowbite-react";
import {
  Card,
  Table,
  TableColumnsType,
  Button as AntButton,
  Space,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import api from "../../config";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { usePermissions } from "../../hooks/usePermission";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import { useTimezone } from "../../contexts/TimezoneContext";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { motion } from "framer-motion";
import {
  convertTimeToUserTimezone,
  convertTimeToDbTimezone,
  getDayShift,
  DEFAULT_DB_TIMEZONE,
  formatTime,
} from "../../utils/timezone";
import { syncLessonToCalendar, triggerGlobalSync } from "../../utils/syncUtils";

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

interface Lesson {
  id: number;
  start_date: { id: number; start_date: string };
  end_date: { id: number; end_date: string };
  lesson_date: string;
  Student: { id: number; first_name: string; last_name: string };
  Teacher: { id: number; first_name: string; last_name: string };
  CalendarLink: { startDate: string; endDate: string };
  class_type: { id: number; name: string };
  pay_state: boolean;
  class_status?: string;
  start_time?: string;
  end_time?: string;
  createdAt: string;
}

interface Student {
  id: number;
  first_name: string;
  last_name: string;
}

interface Teacher {
  id: number;
  first_name: string;
  last_name: string;
}

interface ClassType {
  id: number;
  name: string;
}

// Додаємо інтерфейс для календарних подій
interface CalendarEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  class_type: string;
  class_status?: string;
  payment_status?: string;
  student_id?: number;
  teacher_id?: number;
  student_name_text?: string;
  teacher_name?: string;
  createdAt?: string;
  title?: string;
  resourceId?: number;
}

// Додаємо загальний інтерфейс для об'єднаних даних
interface CombinedTableData {
  key: number;
  id: string | number;
  type: "lesson" | "calendar_event";
  lesson_date: string;
  student_name: string;
  teacher_name: string;
  class_type: string;
  start_time: string;
  class_status: string;
  source: "lessons" | "calendar";
  original: Lesson | CalendarEvent;
}

const CLASS_STATUS_OPTIONS = [
  { value: "", label: "Select Class Status" },
  { value: "Given", label: "Given" },
  { value: "No show student", label: "No show student" },
  { value: "No show teacher", label: "No show teacher (Manager Only)" },
  { value: "Cancelled", label: "Cancelled" },
];

// Gerçek class type ID'leri - sadece bunları göster
const VALID_CLASS_TYPE_IDS = [1, 2, 3]; // Trial-Lesson, Regular-Lesson, Training

const ClassManage: React.FC = () => {
  const navigate = useNavigate();
  const { permissions, loading_1 } = usePermissions("/class/manage");
  const auth = useAuth();
  const { timezone } = useTimezone();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [payState, setPayState] = useState(false);

  const [classDate, setClassDate] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedClassType, setSelectedClassType] = useState<string>("");
  const [classStatus, setClassStatus] = useState<string>("");

  const [openModal, setOpenModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(false);

  // Add time state variables
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  // Check if user is a manager or admin
  const isManagerOrAdmin =
    auth.user?.role === "manager" || auth.user?.role === "admin";

  // Filter class status options based on user role
  const filteredClassStatusOptions = CLASS_STATUS_OPTIONS.filter((option) => {
    // If not a manager, remove "No show teacher" option
    if (!isManagerOrAdmin && option.value === "No show teacher") {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (!loading_1) {
      if (!permissions.read) {
        navigate("/");
        toast.error("You don't have permission to view this page", {
          theme: "dark",
        });
      } else {
        fetchClasses();
      }
    }
  }, [permissions, navigate, loading_1]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const [
        lessonsRes,
        studentsRes,
        teachersRes,
        classTypesRes,
        calendarEventsRes,
      ] = await Promise.all([
        api.get("/lessons"),
        api.get("/students"),
        api.get("/teachers"),
        api.get("/class-types"),
        api.get("/calendar/events"), // Додаємо запит календарних подій
      ]);

      // Debug the API response for lessons
      const lessonsData = lessonsRes.data || [];
      console.log(
        "Complete lessons data:",
        JSON.stringify(lessonsData, null, 2),
      );

      // Логуємо сирі дані з сервера для перевірки порядку
      console.log(
        "🔍 Raw lessons from server (first 5):",
        lessonsData.slice(0, 5).map((lesson: any, index: number) => ({
          position: index + 1,
          id: lesson.id,
          date: lesson.lesson_date,
          time: lesson.start_time,
          student: lesson.Student
            ? `${lesson.Student.first_name} ${lesson.Student.last_name}`
            : "No student",
          teacher: lesson.Teacher
            ? `${lesson.Teacher.first_name} ${lesson.Teacher.last_name}`
            : "No teacher",
        })),
      );

      setLessons(lessonsData);
      setStudents(studentsRes.data || []);
      setTeachers(teachersRes.data || []);
      setClassTypes(classTypesRes.data || []);

      // Логуємо завантажені вчителі
      console.log("👨‍🏫 Loaded teachers:", {
        count: teachersRes.data?.length || 0,
        teachers:
          teachersRes.data?.map((t) => ({
            id: t.id,
            name: `${t.first_name} ${t.last_name}`,
          })) || [],
        teacherIds: teachersRes.data?.map((t) => t.id) || [],
      });

      // Обробка календарних подій
      const calendarEventsData = Array.isArray(calendarEventsRes.data)
        ? calendarEventsRes.data
        : calendarEventsRes.data.events?.rows || [];

      console.log("📥 Calendar events API response:", calendarEventsRes.data);
      console.log("📊 Calendar events structure:", {
        isArray: Array.isArray(calendarEventsRes.data),
        hasEvents: !!calendarEventsRes.data.events,
        eventsType: typeof calendarEventsRes.data.events,
        hasRows: !!calendarEventsRes.data.events?.rows,
        rowsLength: calendarEventsRes.data.events?.rows?.length,
      });
      console.log("📋 Final calendar events array:", calendarEventsData);
      console.log(
        "📊 Calendar events array length:",
        calendarEventsData.length,
      );

      // Логуємо перші кілька календарних подій для діагностики
      console.log(
        "🔍 First 3 calendar events:",
        calendarEventsData.slice(0, 3).map((event: any, index: number) => ({
          position: index + 1,
          id: event.id,
          name: event.name,
          teacher_id: event.teacher_id,
          teacher_name: event.teacher_name,
          resourceId: event.resourceId,
          student_id: event.student_id,
          student_name_text: event.student_name_text,
          class_type: event.class_type,
          class_status: event.class_status,
        })),
      );

      setCalendarEvents(calendarEventsData);

      setLoading(false);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      handleApiError(error);
      setLoading(false);
    }
  };

  // Додаємо state для редагування календарних подій
  const [selectedCalendarEvent, setSelectedCalendarEvent] =
    useState<CalendarEvent | null>(null);
  const [openEditCalendarModal, setOpenEditCalendarModal] = useState(false);

  // Функція для конвертації календарної події в формат таблиці
  const convertCalendarEventToTableFormat = (
    event: CalendarEvent,
    index: number,
  ): CombinedTableData => {
    // Знаходимо студента та вчителя за ID
    const student = students.find((s) => s.id === event.student_id);
    const teacher = teachers.find((t) => t.id === event.teacher_id);

    // Конвертуємо час
    let eventDate = "";
    let startTime = "";

    if (event.startDate) {
      try {
        const startDateTime = dayjs(event.startDate).tz(timezone);
        eventDate = startDateTime.format("YYYY-MM-DD");
        startTime = startDateTime.format("HH:mm");
      } catch (error) {
        console.error("Error parsing calendar event time:", error);
      }
    }

    // Виправляємо проблему з teacher_name
    let teacherName = "Unknown Teacher";

    console.log("🔍 Teacher lookup for event:", {
      eventId: event.id,
      eventTeacherId: event.teacher_id,
      eventTeacherIdType: typeof event.teacher_id,
      eventTeacherName: event.teacher_name,
      eventResourceId: event.resourceId,
      eventResourceIdType: typeof event.resourceId,
      availableTeachers: teachers.map((t) => ({
        id: t.id,
        name: `${t.first_name} ${t.last_name}`,
      })),
    });

    // Спочатку перевіряємо чи є teacher_id і знаходимо вчителя в масиві teachers
    if (event.teacher_id && teacher) {
      teacherName = `${teacher.first_name} ${teacher.last_name}`;
      console.log("✅ Found teacher by teacher_id:", teacherName);
    }
    // Якщо немає teacher_id або вчителя в масиві, перевіряємо teacher_name з події
    else if (event.teacher_name && event.teacher_name !== "Unknown Teacher") {
      teacherName = event.teacher_name;
      console.log("✅ Using teacher_name from event:", teacherName);
    }
    // Якщо є resourceId, спробуємо знайти вчителя за ним
    else if (event.resourceId) {
      // Конвертуємо resourceId в число для порівняння
      const resourceIdNum = parseInt(String(event.resourceId));
      const resourceTeacher = teachers.find((t) => t.id === resourceIdNum);
      if (resourceTeacher) {
        teacherName = `${resourceTeacher.first_name} ${resourceTeacher.last_name}`;
        console.log(
          "✅ Found teacher by resourceId:",
          teacherName,
          "resourceId:",
          resourceIdNum,
        );
      } else {
        console.log(
          "❌ No teacher found by resourceId:",
          resourceIdNum,
          "available teacher IDs:",
          teachers.map((t) => t.id),
        );
      }
    } else {
      console.log("❌ No teacher found - all methods failed");
    }

    // Виправляємо проблему з student_name
    let studentName = "Unknown Student";

    // Спочатку перевіряємо чи є student_id і знаходимо студента в масиві students
    if (event.student_id && student) {
      studentName = `${student.first_name} ${student.last_name}`;
    }
    // Якщо немає student_id або студента в масиві, перевіряємо student_name_text з події
    else if (
      event.student_name_text &&
      event.student_name_text !== "Unknown Student"
    ) {
      studentName = event.student_name_text;
    }
    // Якщо є name з події і це не "Unknown Student"
    else if (event.name && event.name !== "Unknown Student") {
      studentName = event.name;
    }

    console.log("🔍 Calendar event conversion:", {
      eventId: event.id,
      teacher_id: event.teacher_id,
      teacher_name: event.teacher_name,
      resourceId: event.resourceId,
      foundTeacher: teacher,
      finalTeacherName: teacherName,
      student_id: event.student_id,
      student_name_text: event.student_name_text,
      name: event.name,
      foundStudent: student,
      finalStudentName: studentName,
    });

    return {
      key: index,
      id: event.id,
      type: "calendar_event",
      lesson_date: eventDate,
      student_name: studentName,
      teacher_name: teacherName,
      class_type: event.class_type || "Unknown Type",
      start_time: startTime,
      class_status: event.class_status || "scheduled",
      source: "calendar",
      original: event,
    };
  };

  // Функція для конвертації уроку в формат таблиці
  const convertLessonToTableFormat = (
    lesson: Lesson,
    index: number,
  ): CombinedTableData => {
    let lessonDate = lesson.lesson_date || "";

    return {
      key: index,
      id: lesson.id,
      type: "lesson",
      lesson_date: lessonDate,
      student_name: lesson.Student
        ? `${lesson.Student.first_name} ${lesson.Student.last_name}`
        : "Unknown Student",
      teacher_name: lesson.Teacher
        ? `${lesson.Teacher.first_name} ${lesson.Teacher.last_name}`
        : "Unknown Teacher",
      class_type: lesson.class_type ? lesson.class_type.name : "Unknown Type",
      start_time:
        typeof lesson.start_time === "string" ? lesson.start_time : "",
      class_status: lesson.class_status || "",
      source: "lessons",
      original: lesson,
    };
  };

  // Оновлюємо tableData для об'єднання уроків та календарних подій
  const tableData = useMemo(() => {
    console.log("🔄 Recalculating tableData:", {
      lessonsCount: lessons.length,
      calendarEventsCount: calendarEvents.length,
      teachersCount: teachers.length,
      studentsCount: students.length,
    });

    // Фільтруємо уроки
    const filteredLessons = lessons.filter((lesson) => {
      if (auth.user?.role === "student") {
        return lesson.Student?.id === parseInt(auth.user.id);
      }
      if (auth.user?.role === "teacher") {
        return lesson.Teacher?.id === parseInt(auth.user.id);
      }
      return true;
    });

    // Фільтруємо календарні події
    const filteredCalendarEvents = calendarEvents.filter((event) => {
      // Виключаємо unavailable та scheduled події
      if (
        event.class_type === "Unavailable" ||
        event.class_type === "unavailable" ||
        event.class_status === "Unavailable" ||
        event.class_status === "unavailable" ||
        event.class_status === "Not Available" ||
        event.class_type === "Scheduled" ||
        event.class_type === "scheduled" ||
        event.class_status === "Scheduled" ||
        event.class_status === "scheduled"
      ) {
        console.log("🚫 Filtering out unavailable/scheduled event:", event.id);
        return false;
      }

      if (auth.user?.role === "student") {
        return event.student_id === parseInt(auth.user.id);
      }
      if (auth.user?.role === "teacher") {
        return event.teacher_id === parseInt(auth.user.id);
      }
      return true;
    });

    // Конвертуємо в загальний формат
    const convertedLessons = filteredLessons.map((lesson, index) =>
      convertLessonToTableFormat(lesson, index),
    );

    const convertedCalendarEvents = filteredCalendarEvents.map((event, index) =>
      convertCalendarEventToTableFormat(event, index + filteredLessons.length),
    );

    // Об'єднуємо всі дані
    const allData = [...convertedLessons, ...convertedCalendarEvents];

    // Сортуємо за датою та часом (найновіші спочатку)
    return allData.sort((a, b) => {
      const aDate = new Date(a.lesson_date || "0000-01-01");
      const bDate = new Date(b.lesson_date || "0000-01-01");

      if (aDate.getTime() === bDate.getTime()) {
        const aTime = a.start_time || "00:00";
        const bTime = b.start_time || "00:00";
        return bTime.localeCompare(aTime);
      }

      return bDate.getTime() - aDate.getTime();
    });
  }, [lessons, calendarEvents, students, teachers, auth.user, timezone]);

  const createLesson = async () => {
    if (
      !classDate ||
      !selectedStudent ||
      !selectedTeacher ||
      !selectedClassType
    ) {
      toast.error("All fields are required.", { theme: "dark" });
      return;
    }

    try {
      // Prepare lesson data with time information
      const lessonData = {
        class_date: classDate,
        student_id: selectedStudent,
        teacher_id: selectedTeacher,
        class_type_id: selectedClassType,
        pay_state: payState,
        class_status: classStatus || null,
      };

      // Add time information
      const lessonWithTime = prepareTimeData(lessonData, startTime, endTime);

      console.log("Sending lesson data:", lessonWithTime);
      const res = await api.post("/lessons", lessonWithTime);

      const updatedLessons = res.data.lessons || [];
      setLessons(updatedLessons);

      // 🔄 СИНХРОНІЗАЦІЯ: Створюємо подію в календарі
      const newLesson = updatedLessons[updatedLessons.length - 1];
      if (newLesson) {
        try {
          console.log("🔄 Creating calendar event for lesson:", {
            lessonId: newLesson.id,
            studentId: selectedStudent,
            teacherId: selectedTeacher,
            classTypeId: selectedClassType,
            lessonDate: classDate,
            startTime,
            endTime,
          });

          // Знаходимо дані студента та вчителя
          const student = students.find(
            (s) => s.id === parseInt(selectedStudent),
          );
          const teacher = teachers.find(
            (t) => t.id === parseInt(selectedTeacher),
          );
          const classType = classTypes.find(
            (ct) => ct.id === parseInt(selectedClassType),
          );

          // Підготовка даних для календаря
          const calendarData = {
            class_type: classType?.name?.toLowerCase() || "regular",
            student_id: parseInt(selectedStudent),
            teacher_id: parseInt(selectedTeacher),
            class_status: classStatus || "scheduled",
            payment_status: payState ? "paid" : "reserved",
            startDate: `${classDate}T${startTime}:00`,
            endDate: `${classDate}T${endTime}:00`,
            name: student
              ? `${student.first_name} ${student.last_name}`
              : "Unknown Student",
            student_name_text: student
              ? `${student.first_name} ${student.last_name}`
              : "Unknown Student",
            teacher_name: teacher
              ? `${teacher.first_name} ${teacher.last_name}`
              : "Unknown Teacher",
          };

          console.log("📤 Sending calendar data:", calendarData);

          // Конвертація в UTC для збереження
          const startDate = dayjs.tz(calendarData.startDate, timezone);
          const endDate = dayjs.tz(calendarData.endDate, timezone);

          const calendarEventData = {
            ...calendarData,
            startDate: startDate.utc().format(),
            endDate: endDate.utc().format(),
          };

          const calendarResponse = await api.post("/calendar/events", {
            events: { added: [calendarEventData] },
          });

          console.log(
            "✅ Calendar event created successfully:",
            calendarResponse.data,
          );
        } catch (error) {
          console.error("❌ Error creating calendar event for lesson:", error);
          console.error("Error details:", {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
          });
        }
      }

      // Reset form
      setClassDate("");
      setSelectedStudent("");
      setSelectedTeacher("");
      setSelectedClassType("");
      setPayState(false);
      setClassStatus("");
      setStartTime("");
      setEndTime("");
      setOpenModal(false);

      toast.success("Lesson added successfully!", { theme: "dark" });

      // 🔄 ГЛОБАЛЬНА СИНХРОНІЗАЦІЯ
      triggerGlobalSync("ClassManage-create", { newLesson });

      // Оновлюємо календарні події після створення уроку
      await fetchClasses();
    } catch (error: any) {
      console.error("Error creating lesson:", error);
      handleApiError(error);
    }
  };

  const deleteLesson = async (id: number) => {
    try {
      // Зберігаємо дані уроку перед видаленням для синхронізації
      const lessonToDelete = lessons.find((lesson) => lesson.id === id);

      await api.delete(`/lessons/${id}`);
      setLessons((prevLessons) =>
        prevLessons.filter((lesson) => lesson.id !== id),
      );

      // 🔄 СИНХРОНІЗАЦІЯ: Видаляємо подію з календаря
      if (lessonToDelete) {
        try {
          await api.delete(`/calendar/events/${id}`);
          console.log("✅ Calendar event deleted for lesson");
        } catch (error) {
          console.log("ℹ️ No calendar event found to delete for lesson");
        }
      }

      toast.success("Lesson deleted successfully!", { theme: "dark" });

      // 🔄 ГЛОБАЛЬНА СИНХРОНІЗАЦІЯ
      triggerGlobalSync("ClassManage-delete", { id, lesson: lessonToDelete });

      // Оновлюємо календарні події після видалення уроку
      await fetchClasses();
    } catch (error: any) {
      console.error("Error deleting lesson:", error);
      handleApiError(error);
    }
  };

  const openEditLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setClassDate(lesson.lesson_date);
    setSelectedStudent(lesson.Student.id.toString());
    setSelectedTeacher(lesson.Teacher.id.toString());
    setSelectedClassType(lesson.class_type.id.toString());
    setPayState(lesson.pay_state);
    setClassStatus(lesson.class_status || "");

    try {
      // Get start time and convert from DB timezone to user timezone
      if (lesson.start_time) {
        const userTimeString = convertTimeToUserTimezone(
          lesson.start_time,
          timezone,
        );
        if (userTimeString) {
          // Format as HH:MM for the time input field
          const timePart = userTimeString.substring(0, 5);
          setStartTime(timePart);
        } else {
          setStartTime("");
        }
      } else {
        setStartTime("");
      }

      // Get end time and convert from DB timezone to user timezone
      if (lesson.end_time) {
        const userTimeString = convertTimeToUserTimezone(
          lesson.end_time,
          timezone,
        );
        if (userTimeString) {
          // Format as HH:MM for the time input field
          const timePart = userTimeString.substring(0, 5);
          setEndTime(timePart);
        } else {
          setEndTime("");
        }
      } else {
        setEndTime("");
      }
    } catch (error) {
      console.error("Error setting time values:", error);
      // Set default values in case of error
      setStartTime("");
      setEndTime("");
    }

    setOpenEditModal(true);
  };

  const updateLesson = async () => {
    if (!selectedLesson) return;

    try {
      // Prepare lesson data with time information
      const lessonData = {
        class_date: classDate,
        student_id: selectedStudent,
        teacher_id: selectedTeacher,
        class_type_id: selectedClassType,
        pay_state: payState,
        class_status: classStatus || null,
      };

      // Add time information
      const lessonWithTime = prepareTimeData(lessonData, startTime, endTime);

      console.log("Updating lesson with data:", lessonWithTime);
      const res = await api.put(
        `/lessons/${selectedLesson.id}`,
        lessonWithTime,
      );

      const updatedLessons = res.data.lessons || [];
      setLessons(updatedLessons);

      // 🔄 СИНХРОНІЗАЦІЯ: Оновлюємо подію в календарі
      const updatedLesson = updatedLessons.find(
        (l: any) => l.id === selectedLesson.id,
      );
      if (updatedLesson) {
        try {
          console.log("🔄 Updating calendar event for lesson:", {
            lessonId: selectedLesson.id,
            studentId: selectedStudent,
            teacherId: selectedTeacher,
            classTypeId: selectedClassType,
            lessonDate: classDate,
            startTime,
            endTime,
          });

          // Знаходимо дані студента та вчителя
          const student = students.find(
            (s) => s.id === parseInt(selectedStudent),
          );
          const teacher = teachers.find(
            (t) => t.id === parseInt(selectedTeacher),
          );
          const classType = classTypes.find(
            (ct) => ct.id === parseInt(selectedClassType),
          );

          // Підготовка даних для календаря
          const calendarData = {
            id: selectedLesson.id,
            class_type: classType?.name?.toLowerCase() || "regular",
            student_id: parseInt(selectedStudent),
            teacher_id: parseInt(selectedTeacher),
            class_status: classStatus || "scheduled",
            payment_status: payState ? "paid" : "reserved",
            start_date: `${classDate}T${startTime}:00`,
            end_date: `${classDate}T${endTime}:00`,
          };

          console.log("📤 Sending calendar update data:", calendarData);

          // Конвертація в UTC для збереження
          const startDate = dayjs.tz(calendarData.start_date, timezone);
          const endDate = dayjs.tz(calendarData.end_date, timezone);

          const calendarEventData = {
            ...calendarData,
            start_date: startDate.utc().format(),
            end_date: endDate.utc().format(),
          };

          const calendarResponse = await api.put(
            `/calendar/events/${selectedLesson.id}`,
            calendarEventData,
          );
          console.log(
            "✅ Calendar event updated successfully:",
            calendarResponse.data,
          );
        } catch (error) {
          console.error("❌ Error updating calendar event for lesson:", error);
          console.error("Error details:", {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
          });
        }
      }

      setOpenEditModal(false);
      setSelectedLesson(null);
      toast.success("Lesson updated successfully!", { theme: "dark" });

      // 🔄 ГЛОБАЛЬНА СИНХРОНІЗАЦІЯ
      triggerGlobalSync("ClassManage-update", { updatedLesson });

      // Оновлюємо календарні події після оновлення уроку
      await fetchClasses();
    } catch (error: any) {
      console.error("Error updating lesson:", error);
      handleApiError(error);
    }
  };

  const handleApiError = (error: any) => {
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem("token");
        toast.error("Session expired. Please login again.", { theme: "dark" });
        navigate("/");
      } else {
        toast.error("Failed to perform the action. Please try again.", {
          theme: "dark",
        });
      }
    } else {
      toast.error("Network error. Please check your connection.", {
        theme: "dark",
      });
    }
  };

  // Оновлюємо функцію downloadCSV для включення календарних подій
  const downloadCSV = () => {
    if (tableData.length === 0) {
      toast.error("No class data available to download.", { theme: "dark" });
      return;
    }

    const csvData = tableData.map((item) => {
      let formattedDate = "-";
      let formattedStartTime = "-";

      if (item.lesson_date) {
        if (item.source === "lessons" && item.start_time) {
          const userStartTime = convertTimeToUserTimezone(
            item.start_time,
            timezone,
          );
          if (userStartTime) {
            formattedStartTime = formatTime(userStartTime, "HH:mm");
            const dayShift = getDayShift(
              item.start_time,
              DEFAULT_DB_TIMEZONE,
              timezone,
            );
            if (dayShift !== 0) {
              const adjustedDate = dayjs(item.lesson_date)
                .add(dayShift, "day")
                .format("YYYY-MM-DD");
              formattedDate = dayjs(adjustedDate).format("DD.MM.YYYY");
            } else {
              formattedDate = dayjs(item.lesson_date).format("DD.MM.YYYY");
            }
          }
        } else {
          formattedDate = dayjs(item.lesson_date).format("DD.MM.YYYY");
          formattedStartTime = item.start_time || "-";
        }
      }

      return {
        Source: item.source === "lessons" ? "Lesson" : "Calendar Event",
        "Class Date": formattedDate,
        "Start Time": formattedStartTime,
        "Student Name": item.student_name,
        "Teacher Name": item.teacher_name,
        "Class Type": item.class_type,
        "Class Status": item.class_status || "-",
        Timezone: timezone.replace(/_/g, " "),
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "combined_class_data.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Ця функція API'ye gönderilecek veriyi hazırlar
  const prepareTimeData = (
    lessonData: any,
    startTimeValue: string,
    endTimeValue: string,
  ) => {
    // Convert times to database timezone (PST)
    const startTimeDb = startTimeValue
      ? convertTimeToDbTimezone(startTimeValue, timezone)
      : null;

    const endTimeDb = endTimeValue
      ? convertTimeToDbTimezone(endTimeValue, timezone)
      : null;

    // Check if we need to adjust the date due to timezone differences
    let classDateStr = lessonData.class_date;
    if (startTimeValue) {
      const dayShift = getDayShift(
        startTimeValue,
        timezone,
        DEFAULT_DB_TIMEZONE,
      );
      if (dayShift !== 0) {
        // Adjust the date by the number of days shifted
        classDateStr = dayjs(lessonData.class_date)
          .add(dayShift, "day")
          .format("YYYY-MM-DD");
      }
    }

    return {
      ...lessonData,
      class_date: classDateStr,
      start_time: startTimeDb,
      end_time: endTimeDb,
    };
  };

  // Оновлюємо колонки таблиці
  const columns: TableColumnsType<CombinedTableData> = [
    {
      title: "No",
      dataIndex: "index",
      key: "index",
      width: "8%",
      fixed: "left",
      render: (_: any, __: any, index: number) => (
        <span className="font-medium text-gray-600 dark:text-gray-400">
          {index + 1}
        </span>
      ),
    },
    {
      title: "Date",
      dataIndex: "lesson_date",
      key: "lesson_date",
      render: (text: string, record: CombinedTableData) => {
        if (!text) {
          return (
            <span className="font-medium text-gray-400 dark:text-gray-500">
              --.--.----
            </span>
          );
        }

        let adjustedDate = text;
        if (record.start_time && record.source === "lessons") {
          const dayShift = getDayShift(
            record.start_time,
            DEFAULT_DB_TIMEZONE,
            timezone,
          );
          if (dayShift !== 0) {
            adjustedDate = dayjs(text)
              .add(dayShift, "day")
              .format("YYYY-MM-DD");
          }
        }

        return (
          <span className="font-medium text-gray-900 dark:text-white">
            {dayjs(adjustedDate).format("DD.MM.YYYY")}
          </span>
        );
      },
      sorter: (a: CombinedTableData, b: CombinedTableData) => {
        const aDate = new Date(a.lesson_date || "0000-01-01");
        const bDate = new Date(b.lesson_date || "0000-01-01");

        if (aDate.getTime() === bDate.getTime()) {
          const aTime = a.start_time || "00:00";
          const bTime = b.start_time || "00:00";
          return bTime.localeCompare(aTime);
        }

        return bDate.getTime() - aDate.getTime();
      },
    },
    {
      title: "Start Time",
      dataIndex: "start_time",
      key: "start_time",
      width: "12%",
      render: (text: string, record: CombinedTableData) => {
        if (!text) {
          return (
            <span className="font-medium text-gray-400 dark:text-gray-500">
              --:--
            </span>
          );
        }

        try {
          if (record.source === "calendar") {
            // Для календарних подій час вже в правильному форматі
            return (
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {text}
              </span>
            );
          } else {
            // Для уроків використовуємо існуючу логіку
            const today = dayjs().format("YYYY-MM-DD");
            const fullDateTime = `${today} ${text}`;
            const timeObj = dayjs(fullDateTime);

            if (timeObj.isValid()) {
              return (
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {timeObj.format("HH:mm")}
                </span>
              );
            } else {
              const userTime = convertTimeToUserTimezone(text, timezone);
              if (!userTime) {
                return (
                  <span className="font-medium text-gray-400 dark:text-gray-500">
                    --:--
                  </span>
                );
              }
              return (
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {formatTime(userTime, "HH:mm")}
                </span>
              );
            }
          }
        } catch (error) {
          console.error("Error formatting time:", error, "time:", text);
          return (
            <span className="font-medium text-gray-400 dark:text-gray-500">
              --:--
            </span>
          );
        }
      },
    },
    {
      title: "Student",
      dataIndex: "student_name",
      key: "student_name",
      fixed: "left",
      sorter: (a: CombinedTableData, b: CombinedTableData) =>
        a.student_name.localeCompare(b.student_name),
      filters:
        auth.user?.role !== "student"
          ? students
              .map((student) => ({
                text: `${student.first_name} ${student.last_name}`,
                value: `${student.first_name} ${student.last_name}`,
              }))
              .sort((a, b) => a.text.localeCompare(b.text))
          : undefined,
      onFilter: (value: any, record: CombinedTableData) =>
        record.student_name.includes(value),
      render: (text: string) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {text}
        </span>
      ),
    },
    {
      title: "Teacher",
      dataIndex: "teacher_name",
      key: "teacher_name",
      sorter: (a: CombinedTableData, b: CombinedTableData) =>
        a.teacher_name.localeCompare(b.teacher_name),
      filters:
        auth.user?.role !== "teacher"
          ? teachers
              .map((teacher) => ({
                text: `${teacher.first_name} ${teacher.last_name}`,
                value: `${teacher.first_name} ${teacher.last_name}`,
              }))
              .sort((a, b) => a.text.localeCompare(b.text))
          : undefined,
      onFilter: (value: any, record: CombinedTableData) =>
        record.teacher_name.includes(value),
      render: (text: string) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {text}
        </span>
      ),
    },
    {
      title: "Class Type",
      dataIndex: "class_type",
      key: "class_type",
      sorter: (a: CombinedTableData, b: CombinedTableData) =>
        a.class_type.localeCompare(b.class_type),
      filters: [
        { text: "Regular", value: "regular" },
        { text: "Trial", value: "trial" },
        { text: "Training", value: "training" },
        { text: "Instant", value: "instant" },
        { text: "Group", value: "group" },
      ],
      onFilter: (value: any, record: CombinedTableData) => {
        const classType = record.class_type.toLowerCase();
        const filterValue = value.toLowerCase();

        // Створюємо мапінг для різних варіантів назв
        const classTypeVariants: { [key: string]: string[] } = {
          regular: ["regular", "regular-lesson", "regular lesson"],
          trial: ["trial", "trial-lesson", "trial lesson"],
          training: ["training", "training-lesson", "training lesson"],
          instant: ["instant", "instant-lesson", "instant lesson"],
          group: ["group", "group-lesson", "group lesson"],
        };

        // Перевіряємо чи поточний class_type відповідає одному з варіантів
        const variants = classTypeVariants[filterValue] || [filterValue];
        return variants.some(
          (variant) =>
            classType.includes(variant) ||
            classType === variant ||
            classType.replace("-", " ") === variant ||
            classType.replace(" ", "-") === variant,
        );
      },
      render: (text: string) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {text}
        </span>
      ),
    },
    {
      title: "Class Status",
      dataIndex: "class_status",
      key: "class_status",
      width: "15%",
      filters: filteredClassStatusOptions.map((option) => ({
        text: option.label,
        value: option.value,
      })),
      onFilter: (value: any, record: CombinedTableData) =>
        record.class_status === value,
      render: (text: string) => {
        if (!text) {
          return <span className="font-medium text-gray-500">-</span>;
        }
        return (
          <span
            className={`font-medium ${
              text === "Cancelled"
                ? "text-red-500"
                : text === "Given"
                  ? "text-green-500"
                  : "text-yellow-500"
            }`}
          >
            {text}
          </span>
        );
      },
    },
  ];

  // Функції для роботи з календарними подіями
  const openEditCalendarEvent = (event: CalendarEvent) => {
    console.log("Opening calendar event for edit:", event);
    setSelectedCalendarEvent(event);

    // Конвертуємо дату та час календарної події
    if (event.startDate) {
      const startDateTime = dayjs(event.startDate).tz(timezone);
      setClassDate(startDateTime.format("YYYY-MM-DD"));
      setStartTime(startDateTime.format("HH:mm"));

      // Якщо є endDate, використовуємо його для end time
      if (event.endDate) {
        const endDateTime = dayjs(event.endDate).tz(timezone);
        setEndTime(endDateTime.format("HH:mm"));
      } else {
        // За замовчуванням додаємо 50 хвилин
        setEndTime(startDateTime.add(50, "minute").format("HH:mm"));
      }
    }

    // Встановлюємо студента
    if (event.student_id) {
      setSelectedStudent(event.student_id.toString());
    } else {
      setSelectedStudent("");
    }

    // Встановлюємо вчителя
    if (event.teacher_id) {
      setSelectedTeacher(event.teacher_id.toString());
    } else {
      setSelectedTeacher("");
    }

    // Встановлюємо тип класу - конвертуємо з calendar формату в lesson формат
    const classTypeMapping: { [key: string]: string } = {
      trial: "1",
      regular: "2",
      training: "3",
      instant: "2",
      group: "2",
    };

    const mappedClassType =
      classTypeMapping[event.class_type?.toLowerCase()] || "";
    setSelectedClassType(mappedClassType);

    // Встановлюємо статус
    setClassStatus(event.class_status || "");

    // Встановлюємо payment status як payState
    setPayState(event.payment_status === "paid");

    setOpenEditCalendarModal(true);
  };

  const updateCalendarEvent = async () => {
    if (!selectedCalendarEvent) return;

    try {
      // Підготовка даних для оновлення календарної події
      const startDateTime = `${classDate}T${startTime}:00`;
      const endDateTime = `${classDate}T${endTime}:00`;

      // Конвертація в UTC для збереження
      const startDate = dayjs.tz(startDateTime, timezone);
      const endDate = dayjs.tz(endDateTime, timezone);

      const calendarEventData = {
        id: parseInt(selectedCalendarEvent.id),
        start_date: startDate.utc().format(),
        end_date: endDate.utc().format(),
        class_status: classStatus || "scheduled",
        student_id: selectedStudent ? parseInt(selectedStudent) : null,
        teacher_id: selectedTeacher ? parseInt(selectedTeacher) : null,
        // Конвертуємо class_type назад в calendar формат
        class_type: (() => {
          const reverseMapping: { [key: string]: string } = {
            "1": "trial",
            "2": "regular",
            "3": "training",
          };
          return reverseMapping[selectedClassType] || "regular";
        })(),
        payment_status: payState ? "paid" : "reserved",
      };

      console.log("Updating calendar event with data:", calendarEventData);

      const response = await api.put(
        `/calendar/events/${selectedCalendarEvent.id}`,
        calendarEventData,
      );

      console.log("✅ Calendar event updated successfully:", response.data);

      setOpenEditCalendarModal(false);
      setSelectedCalendarEvent(null);
      toast.success("Calendar event updated successfully!", { theme: "dark" });

      // Оновлюємо дані після редагування
      await fetchClasses();
    } catch (error: any) {
      console.error("Error updating calendar event:", error);
      handleApiError(error);
    }
  };

  const deleteCalendarEvent = async (id: string) => {
    try {
      await api.delete(`/calendar/events/${id}`);
      toast.success("Calendar event deleted successfully!", { theme: "dark" });

      // Оновлюємо дані після видалення
      await fetchClasses();
    } catch (error: any) {
      console.error("Error deleting calendar event:", error);
      handleApiError(error);
    }
  };

  // Додаємо колонки для дій для всіх типів подій
  if (permissions.update || permissions.delete) {
    columns.push({
      title: "Action",
      key: "action",
      render: (_: any, record: CombinedTableData) => {
        if (record.source === "lessons") {
          // Дії для уроків
          return (
            <Space size="middle">
              {permissions.update && (
                <AntButton
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openEditLesson(record.original as Lesson)}
                  style={{ color: "white" }}
                  title="Edit Lesson"
                />
              )}
              {permissions.delete && (
                <AntButton
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => deleteLesson(Number(record.id))}
                  style={{ color: "#ef4444" }}
                  title="Delete Lesson"
                />
              )}
            </Space>
          );
        } else {
          // Дії для календарних подій
          return (
            <Space size="middle">
              {permissions.update && (
                <AntButton
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() =>
                    openEditCalendarEvent(record.original as CalendarEvent)
                  }
                  style={{ color: "#10b981" }}
                  title="Edit Calendar Event"
                />
              )}
              {permissions.delete && (
                <AntButton
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => deleteCalendarEvent(String(record.id))}
                  style={{ color: "#ef4444" }}
                  title="Delete Calendar Event"
                />
              )}
            </Space>
          );
        }
      },
    });
  }

  // Додаємо логування для діагностики
  console.log("📊 Combined table data:", {
    totalItems: tableData.length,
    lessons: tableData.filter((item) => item.source === "lessons").length,
    calendarEvents: tableData.filter((item) => item.source === "calendar")
      .length,
  });

  if (loading_1) {
    return <LoadingSpinner></LoadingSpinner>;
  }

  const cardStyles = {
    header: {
      background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
      borderRadius: "12px 12px 0 0",
      padding: "12px 16px", // Reduced padding for mobile
      border: "none",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      "@media (min-width: 640px)": {
        padding: "16px 24px",
      },
    },
    body: {
      padding: "10px", // Reduced padding for mobile
      borderRadius: "0 0 12px 12px",
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      height: "110vh", // Changed from fixed height
      maxHeight: "100vh",
      "@media (min-width: 640px)": {
        padding: "20px",
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex h-[84vh] w-full flex-col gap-4 overflow-y-auto p-3 md:p-6"
    >
      <Card
        title={
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-white">
              Class Manage
            </span>
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          </div>
        }
        className="overflow-hidden rounded-xl border-0 shadow-lg transition-shadow hover:shadow-xl"
        headStyle={cardStyles.header}
        bodyStyle={cardStyles.body}
        extra={
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row">
            <div className="flex flex-col gap-2 xs:flex-row">
              {permissions.create && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-900 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  onClick={() => {
                    setOpenModal(true);
                    setClassDate("");
                    setSelectedStudent("");
                    setSelectedTeacher("");
                    setSelectedClassType("");
                    setClassStatus("");
                    setStartTime("");
                    setEndTime("");
                  }}
                >
                  <PlusOutlined className="mr-2" />
                  Add Class
                </motion.button>
              )}
              {permissions.download && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                  onClick={downloadCSV}
                >
                  <DownloadOutlined className="mr-2" />
                  Download CSV
                </motion.button>
              )}
            </div>
          </div>
        }
      >
        <div className="custom-table overflow-hidden rounded-lg">
          {/* Table with combined data from lessons and calendar events */}
          <Table
            style={{ width: "100%" }}
            columns={columns}
            dataSource={tableData}
            pagination={{
              pageSize: 50,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} items`,
            }}
            loading={{
              spinning: loading,
              size: "large",
            }}
            scroll={{ x: "max-content", y: "calc(65vh - 200px)" }}
            size="large"
            className="custom-table"
          />
        </div>
      </Card>

      {/* Add Class Modal */}
      {permissions.create && (
        <Modal
          show={openModal}
          size="md"
          onClose={() => setOpenModal(false)}
          popup
          className="responsive-modal"
        >
          <Modal.Header className="border-b border-gray-200 dark:border-gray-700" />
          <Modal.Body>
            <div className="space-y-4">
              <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                Add Class
              </h3>

              <div>
                <Label htmlFor="class_date" value="Class Date" />
                <TextInput
                  id="lesson_date"
                  type="date"
                  required
                  value={classDate}
                  onChange={(e) => setClassDate(e.target.value)}
                  className="w-full rounded-lg"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="start_time" value="Start Time" />
                  <TextInput
                    id="start_time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="student" value="Student" />
                <Select
                  id="student"
                  required
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full rounded-lg"
                >
                  <option value="">Select Student</option>
                  {students
                    ?.sort((a, b) =>
                      `${a.first_name} ${a.last_name}`.localeCompare(
                        `${b.first_name} ${b.last_name}`,
                      ),
                    )
                    .map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.last_name}
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="teacher" value="Teacher" />
                <Select
                  id="teacher"
                  required
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  className="w-full rounded-lg"
                >
                  <option value="">Select Teacher</option>
                  {teachers
                    .sort((a, b) =>
                      `${a.first_name} ${a.last_name}`.localeCompare(
                        `${b.first_name} ${b.last_name}`,
                      ),
                    )
                    .map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.first_name} {teacher.last_name}
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="classType" value="Class Type" />
                <Select
                  id="classType"
                  required
                  value={selectedClassType}
                  onChange={(e) => setSelectedClassType(e.target.value)}
                  className="w-full rounded-lg"
                >
                  <option value="">Select Class Type</option>
                  {classTypes
                    .filter((classType) =>
                      VALID_CLASS_TYPE_IDS.includes(classType.id),
                    )
                    .map((classType) => (
                      <option key={classType.id} value={classType.id}>
                        {classType.name}
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="class_status" value="Class Status (Optional)" />
                <Select
                  id="class_status"
                  value={classStatus}
                  onChange={(e) => setClassStatus(e.target.value)}
                  className="w-full rounded-lg"
                >
                  {filteredClassStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-2 pt-4 xs:flex-row">
                <Button
                  className="w-full xs:w-auto"
                  gradientDuoTone="purpleToBlue"
                  onClick={createLesson}
                >
                  Add Class
                </Button>
                <Button
                  className="w-full xs:w-auto"
                  color="gray"
                  onClick={() => setOpenModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>
      )}

      {/* Edit Class Modal */}
      {permissions.update && (
        <Modal
          show={openEditModal}
          size="md"
          onClose={() => setOpenEditModal(false)}
          popup
          className="responsive-modal"
        >
          <Modal.Header className="border-b border-gray-200 dark:border-gray-700" />
          <Modal.Body>
            <div className="space-y-4">
              <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                Edit Class
              </h3>

              <div>
                <Label htmlFor="edit_class_date" value="Class Date" />
                <TextInput
                  id="edit_class_date"
                  type="date"
                  required
                  value={classDate}
                  onChange={(e) => setClassDate(e.target.value)}
                  className="w-full rounded-lg"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit_start_time" value="Start Time" />
                  <TextInput
                    id="edit_start_time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit_student" value="Student" />
                <Select
                  id="edit_student"
                  required
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full rounded-lg"
                >
                  <option value="">Select Student</option>
                  {students
                    ?.sort((a, b) =>
                      `${a.first_name} ${a.last_name}`.localeCompare(
                        `${b.first_name} ${b.last_name}`,
                      ),
                    )
                    .map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.last_name}
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="edit_teacher" value="Teacher" />
                <Select
                  id="edit_teacher"
                  required
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  className="w-full rounded-lg"
                >
                  <option value="">Select Teacher</option>
                  {teachers
                    .sort((a, b) =>
                      `${a.first_name} ${a.last_name}`.localeCompare(
                        `${b.first_name} ${b.last_name}`,
                      ),
                    )
                    .map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.first_name} {teacher.last_name}
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="edit_classType" value="Class Type" />
                <Select
                  id="edit_classType"
                  required
                  value={selectedClassType}
                  onChange={(e) => setSelectedClassType(e.target.value)}
                  className="w-full rounded-lg"
                >
                  <option value="">Select Class Type</option>
                  {classTypes
                    .filter((classType) =>
                      VALID_CLASS_TYPE_IDS.includes(classType.id),
                    )
                    .map((classType) => (
                      <option key={classType.id} value={classType.id}>
                        {classType.name}
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <Label
                  htmlFor="edit_class_status"
                  value="Class Status (Optional)"
                />
                <Select
                  id="edit_class_status"
                  value={classStatus}
                  onChange={(e) => setClassStatus(e.target.value)}
                  className="w-full rounded-lg"
                >
                  {filteredClassStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-2 pt-4 xs:flex-row">
                <Button
                  className="w-full xs:w-auto"
                  gradientDuoTone="purpleToBlue"
                  onClick={updateLesson}
                >
                  Update Class
                </Button>
                <Button
                  className="w-full xs:w-auto"
                  color="gray"
                  onClick={() => setOpenEditModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>
      )}
      {/* Edit Calendar Event Modal */}
      {permissions.update && (
        <Modal
          show={openEditCalendarModal}
          size="md"
          onClose={() => setOpenEditCalendarModal(false)}
          popup
          className="responsive-modal"
        >
          <Modal.Header className="border-b border-gray-200 dark:border-gray-700" />
          <Modal.Body>
            <div className="space-y-4">
              <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                Edit Calendar Event
              </h3>

              <div>
                <Label htmlFor="edit_calendar_date" value="Event Date" />
                <TextInput
                  id="edit_calendar_date"
                  type="date"
                  required
                  value={classDate}
                  onChange={(e) => setClassDate(e.target.value)}
                  className="w-full rounded-lg"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <Label
                    htmlFor="edit_calendar_start_time"
                    value="Start Time"
                  />
                  <TextInput
                    id="edit_calendar_start_time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_calendar_end_time" value="End Time" />
                  <TextInput
                    id="edit_calendar_end_time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-lg"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit_calendar_student" value="Student" />
                <Select
                  id="edit_calendar_student"
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full rounded-lg"
                >
                  <option value="">Select Student</option>
                  {students
                    ?.sort((a, b) =>
                      `${a.first_name} ${a.last_name}`.localeCompare(
                        `${b.first_name} ${b.last_name}`,
                      ),
                    )
                    .map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.last_name}
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="edit_calendar_teacher" value="Teacher" />
                <Select
                  id="edit_calendar_teacher"
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  className="w-full rounded-lg"
                >
                  <option value="">Select Teacher</option>
                  {teachers
                    .sort((a, b) =>
                      `${a.first_name} ${a.last_name}`.localeCompare(
                        `${b.first_name} ${b.last_name}`,
                      ),
                    )
                    .map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.first_name} {teacher.last_name}
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="edit_calendar_classType" value="Class Type" />
                <Select
                  id="edit_calendar_classType"
                  value={selectedClassType}
                  onChange={(e) => setSelectedClassType(e.target.value)}
                  className="w-full rounded-lg"
                >
                  <option value="">Select Class Type</option>
                  {classTypes
                    .filter((classType) =>
                      VALID_CLASS_TYPE_IDS.includes(classType.id),
                    )
                    .map((classType) => (
                      <option key={classType.id} value={classType.id}>
                        {classType.name}
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <Label
                  htmlFor="edit_calendar_class_status"
                  value="Class Status (Optional)"
                />
                <Select
                  id="edit_calendar_class_status"
                  value={classStatus}
                  onChange={(e) => setClassStatus(e.target.value)}
                  className="w-full rounded-lg"
                >
                  {filteredClassStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-2 pt-4 xs:flex-row">
                <Button
                  className="w-full xs:w-auto"
                  gradientDuoTone="purpleToBlue"
                  onClick={updateCalendarEvent}
                >
                  Update Event
                </Button>
                <Button
                  className="w-full xs:w-auto"
                  color="gray"
                  onClick={() => setOpenEditCalendarModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>
      )}
    </motion.div>
  );
};

export default ClassManage;
