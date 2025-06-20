import React, { useState, useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  EventInput,
  EventSourceInput,
  EventClickArg,
  DateSelectArg,
} from "@fullcalendar/core";
import {
  Button,
  message,
  Modal,
  Form,
  DatePicker,
  TimePicker,
  Checkbox,
  Select,
  InputNumber,
  Input,
  Row,
  Col,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import api from "../../config";
import { calendarApi } from "../../api/calendar";
import CreateEventModal from "../../components/CreateEventModal";
import "./Calendar.css";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { useTimezone } from "../../contexts/TimezoneContext";
import EventCreateForm from "./EventCreateForm";
import { Event } from "../../../api/calendar";
import { DateTime } from "luxon";
import { DEFAULT_DB_TIMEZONE } from "../../utils/timezone";
import type { LessonStatus } from "./EventCreateForm";
import { toast } from "react-toastify";

dayjs.extend(utc);
dayjs.extend(timezone);

interface CalendarEventData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  class_type: string;
  eventColor?: string;
  teacherColor?: string;
  resourceId?: string | number;
  teacherId?: string | number;
  teacher_id?: string | number;
}

interface Teacher {
  id: number;
  first_name: string;
  last_name: string;
  color: string;
}

interface Student {
  id: number;
  first_name: string;
  last_name: string;
}

interface EventDetails {
  id: string;
  title: string;
  start: string;
  end: string;
  teacherId?: string;
  studentId?: string;
  class_status?: string;
  isNotAvailable?: boolean;
  rawEvent?: EventClickArg["event"];
  student_name_text?: string;
  class_type: string;
  teacher_name?: string;
}

interface EventExtendedProps {
  teacherId?: string;
  teacher_name?: string;
  studentId?: string;
  student_name_text?: string;
  class_status?: string;
  class_type?: string;
  payment_status?: string;
  originalStart?: string;
  originalEnd?: string;
  timezone?: string;
  utcStart?: string;
  utcEnd?: string;
  duration?: number;
  hoursUntilStart?: number;
}

// Use FullCalendar's native types
interface CustomEventInput extends EventInput {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
  backgroundColor?: string;
  resourceId?: string;
  teacherId?: string;
  teacher_name?: string;
  extendedProps?: {
    teacherId?: string;
    teacher_name?: string;
    studentId?: string;
    student_name_text?: string;
    class_status?: string;
    class_type?: string;
  };
}

type CalendarEvent = CustomEventInput & {
  extendedProps?: {
    teacherId?: string;
    teacher_name?: string;
    studentId?: string;
    student_name_text?: string;
    class_status?: string;
    class_type?: string;
  };
};

interface EventForm {
  teacherId: number | null;
  studentId: number | null;
  start: string;
  end: string;
  classType: string;
  status: string;
  duration: string;
  payment_status?: string;
  repeating: {
    type: "none" | "weekly";
    days: number[];
    weeks: number;
  };
}

const classTypes = [
  { value: "trial", label: "Trial", duration: 30 },
  { value: "regular", label: "Regular", duration: 50 },
  { value: "instant", label: "Instant", duration: 50 },
  { value: "group", label: "Group", duration: 50 },
  { value: "training", label: "Training", duration: 50, adminOnly: true },
];

const convertToTimezone = (dateStr: string, targetTimezone: string): string => {
  const date = dayjs.tz(dateStr, "UTC");
  return date.tz(targetTimezone).format();
};

// Проста перевірка - чи вже є подія на цей час
const isTimeSlotBusy = async (
  start: string,
  end: string,
  userTimezone: string
): Promise<boolean> => {
  try {
    const response = await api.get("/calendar/events");
    const events = Array.isArray(response.data)
      ? response.data
      : response.data.events?.rows || [];

    console.log("🔍 Total events to check:", events.length);

    // Convert input times to UTC for comparison
    // The input times are in user timezone, so we need to parse them correctly
    const newStart = dayjs.tz(start, userTimezone).utc();
    const newEnd = dayjs.tz(end, userTimezone).utc();

    console.log("🔍 Checking time slot:", {
      inputStart: start,
      inputEnd: end,
      convertedStart: newStart.format("YYYY-MM-DD HH:mm:ss"),
      convertedEnd: newEnd.format("YYYY-MM-DD HH:mm:ss"),
      timezone: userTimezone,
      dbTimezone: DEFAULT_DB_TIMEZONE,
    });

    for (const event of events) {
      if (event.class_status === "cancelled") {
        console.log("⏭️ Skipping cancelled event:", event.id);
        continue;
      }

      console.log("🔍 Processing event:", {
        id: event.id,
        startDate: event.startDate,
        endDate: event.endDate,
        class_status: event.class_status,
        class_type: event.class_type,
      });

      // Events from database are already in UTC
      const eventStart = dayjs.utc(event.startDate);
      const eventEnd = dayjs.utc(event.endDate);

      console.log("🔍 Comparing with event:", {
        eventId: event.id,
        eventStart: eventStart.format("YYYY-MM-DD HH:mm:ss"),
        eventEnd: eventEnd.format("YYYY-MM-DD HH:mm:ss"),
        newStart: newStart.format("YYYY-MM-DD HH:mm:ss"),
        newEnd: newEnd.format("YYYY-MM-DD HH:mm:ss"),
        hasOverlap: newStart.isBefore(eventEnd) && newEnd.isAfter(eventStart),
        overlapDetails: {
          newStartBeforeEventEnd: newStart.isBefore(eventEnd),
          newEndAfterEventStart: newEnd.isAfter(eventStart),
        },
      });

      // Перевіряємо чи є перекриття
      // Два часові проміжки перекриваються, якщо:
      // 1. Початок нового проміжку перед кінцем існуючого І
      // 2. Кінець нового проміжку після початку існуючого
      const hasOverlap =
        newStart.isBefore(eventEnd) && newEnd.isAfter(eventStart);

      // Додаткова перевірка для точного перекриття
      const exactOverlap =
        newStart.isSame(eventStart) && newEnd.isSame(eventEnd);
      const partialOverlap = hasOverlap || exactOverlap;

      if (partialOverlap) {
        console.log(
          "❌ Time slot is busy! Overlap detected with event:",
          event.id
        );
        console.log("Overlap type:", {
          hasOverlap,
          exactOverlap,
          partialOverlap,
        });
        return true; // Час зайнятий
      }
    }

    console.log("✅ Time slot is free!");
    return false; // Час вільний
  } catch (error) {
    console.error("Error checking time slot:", error);
    return false;
  }
};

const Calendar: React.FC = () => {
  const { timezone } = useTimezone();
  const [events, setEvents] = useState<CustomEventInput[]>([]);
  const [displayedEvents, setDisplayedEvents] = useState<CustomEventInput[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>([]);
  const [availabilityForm, setAvailabilityForm] = useState({
    teacherId: null as number | null,
    date: null as any,
    repeat: false,
    startTime: null as any,
    endTime: null as any,
    repeatDays: [] as number[],
    repeatWeeks: 1,
  });
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [isEventDetailsOpen, setIsEventDetailsOpen] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [statusValue, setStatusValue] = useState<string>("scheduled");
  const [eventForm, setEventForm] = useState<EventForm>({
    teacherId: null,
    studentId: null,
    start: "",
    end: "",
    classType: "Regular",
    status: "scheduled",
    duration: "50 min",
    repeating: {
      type: "none",
      days: [],
      weeks: 2,
    },
  });
  const [studentSearch, setStudentSearch] = useState("");
  const [eventError, setEventError] = useState("");
  const calendarRef = useRef<any>(null);
  const [editEventData, setEditEventData] = useState<EventDetails | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Log timezone information
  console.log("🌍 Timezone Info:", {
    currentTimezone: timezone,
    browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userTimezone: dayjs.tz.guess(),
    currentTime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    currentTimeInUserTz: dayjs().tz(timezone).format("YYYY-MM-DD HH:mm:ss"),
    currentTimeInBrowserTz: dayjs()
      .tz(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .format("YYYY-MM-DD HH:mm:ss"),
  });

  // Додамо логування при зміні view
  const handleViewChange = (view: any) => {
    console.log("View changed to:", view);
    console.log("Current calendar api:", calendarRef.current?.getApi());
    // Перезавантажимо події при зміні виду
    fetchEvents();
  };

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/teachers");
      let data = response.data;
      // Логування для діагностики
      console.log("TEACHERS RESPONSE:", data);
      let arr: Teacher[] = [];
      if (Array.isArray(data)) arr = data;
      else if (Array.isArray(data.teachers)) arr = data.teachers;

      console.log("Processed teachers array:", arr);
      console.log(
        "Teachers with ID 82:",
        arr.filter((t) => t.id === 82 || String(t.id) === "82")
      );

      // Log all teachers for debugging
      console.log(
        "All teachers loaded:",
        arr.map((t) => ({
          id: t.id,
          name: `${t.first_name} ${t.last_name}`,
          first_name: t.first_name,
          last_name: t.last_name,
        }))
      );

      setTeachers(arr);
    } catch (error) {
      setTeachers([]);
      console.error("Error fetching teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await api.get("/students");
      console.log("API /students response:", response.data);
      const sorted = Array.isArray(response.data)
        ? response.data
            .map((s) => ({
              ...s,
              last_name: s.last_name ? s.last_name.trim() : "",
              first_name: s.first_name ? s.first_name.trim() : "",
            }))
            .sort((a, b) => {
              // Ті, у кого є last_name, йдуть першими
              if (a.last_name && !b.last_name) return -1;
              if (!a.last_name && b.last_name) return 1;
              // Далі сортуємо за last_name, потім за first_name
              const last = a.last_name.localeCompare(b.last_name);
              if (last !== 0) return last;
              return a.first_name.localeCompare(b.first_name);
            })
        : [];
      setStudents(sorted);
    } catch (error) {
      setStudents([]);
      console.error("Error fetching students:", error);
    }
  };

  const fetchEvents = async () => {
    if (!calendarRef.current) return;

    const calendarApi = calendarRef.current.getApi();
    const view = calendarApi.view;

    try {
      console.log("Fetching calendar events...");
      console.log("Current teachers count:", teachers.length);

      // If teachers are not loaded yet, wait a bit and try again
      if (teachers.length === 0) {
        setTimeout(() => fetchEvents(), 100);
        return;
      }

      setLoading(true);

      const startDate = dayjs(view.activeStart)
        .tz(DEFAULT_DB_TIMEZONE)
        .format("YYYY-MM-DDTHH:mm:ss");
      const endDate = dayjs(view.activeEnd)
        .tz(DEFAULT_DB_TIMEZONE)
        .format("YYYY-MM-DDTHH:mm:ss");

      console.log("Fetch period:", { startDate, endDate, selectedTeacherIds });

      // Формуємо параметри запиту
      const params: any = {
        start: startDate,
        end: endDate,
      };

      // Додаємо teacherId тільки якщо є вибрані вчителі
      if (selectedTeacherIds.length > 0) {
        params.teacherId = selectedTeacherIds.join(",");
      }

      const response = await api.get("/calendar/events", {
        params,
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      console.log("Raw events data:", response.data);

      let eventsArray = Array.isArray(response.data)
        ? response.data
        : response.data.events?.rows || [];

      console.log("Processing events:", eventsArray.length);
      console.log("📊 Raw events array sample:", eventsArray.slice(0, 3));
      console.log(
        "🔍 Raw events with teacher data:",
        eventsArray.map((event) => ({
          id: event.id,
          teacher_id: event.teacher_id,
          teacherId: event.teacherId,
          resourceId: event.resourceId,
          teacher_name: event.teacher_name,
          teacherName: event.teacherName,
        }))
      );

      // Let the backend handle reserved class checks
      await api.get("/calendar/check-reserved");

      const events = eventsArray.map((event: any) => {
        console.log("🔍 Processing event from database:", {
          id: event.id,
          name: event.name,
          title: event.title,
          student_name_text: event.student_name_text,
          resourceId: event.resourceId,
          teacherId: event.teacherId,
          teacher_id: event.teacher_id,
          teacher_name: event.teacher_name,
          teacherName: event.teacherName,
          class_type: event.class_type,
          class_status: event.class_status,
          payment_status: event.payment_status,
        });

        let title = event.name || event.title || event.student_name_text || "";

        // Handle reserved lessons
        if (event.payment_status === "reserved") {
          const studentName = event.student_name_text || title;
          title = `RSVR - ${studentName}`;
        }

        // Handle trial lessons
        if (
          event.class_type === "trial" ||
          event.class_type === "trial lesson"
        ) {
          const studentName = event.student_name_text || title;
          title = `Trial - ${studentName}`;
        }

        // Try to get teacherId from multiple sources, prioritizing resourceId
        const teacherId =
          event.resourceId || event.teacherId || event.teacher_id;
        console.log("Processing event:", event.id, "teacherId:", teacherId);

        // Try to find teacher by ID first
        let teacher = teachers.find((t) => String(t.id) === String(teacherId));
        console.log("Found teacher by ID:", teacher);

        // Log the search details
        console.log("🔍 Teacher search details:", {
          eventId: event.id,
          teacherId: teacherId,
          teachersCount: teachers.length,
          teacherIds: teachers.map((t) => t.id),
          searchString: String(teacherId),
          foundTeacher: teacher,
        });

        // If no teacher found by ID but we have a name, try to find by name
        if (
          !teacher &&
          event.teacher_name &&
          event.teacher_name !== "Unknown Teacher"
        ) {
          teacher = teachers.find(
            (t) => `${t.first_name} ${t.last_name}` === event.teacher_name
          );
          console.log("Found teacher by name:", teacher);
        }

        // Additional fallback: try to find teacher by any available field
        if (!teacher) {
          // Try to find by teacherId field if it's different from resourceId
          if (event.teacherId && event.teacherId !== event.resourceId) {
            teacher = teachers.find(
              (t) => String(t.id) === String(event.teacherId)
            );
            console.log("Found teacher by teacherId fallback:", teacher);
          }

          // Try to find by teacher_id field if it's different from resourceId
          if (
            !teacher &&
            event.teacher_id &&
            event.teacher_id !== event.resourceId
          ) {
            teacher = teachers.find(
              (t) => String(t.id) === String(event.teacher_id)
            );
            console.log("Found teacher by teacher_id fallback:", teacher);
          }
        }

        // Set default teacher name if no teacher found
        const teacherName = teacher
          ? `${teacher.first_name} ${teacher.last_name}`
          : event.teacher_name || "No Teacher Assigned";

        const finalTeacherId = teacher ? String(teacher.id) : teacherId;

        console.log("Final teacher info:", {
          id: finalTeacherId,
          name: teacherName,
          originalTeacherId: teacherId,
          foundTeacher: teacher,
        });

        // First convert to UTC
        const utcStart = dayjs.utc(event.startDate);
        const utcEnd = event.endDate
          ? dayjs.utc(event.endDate)
          : utcStart.add(50, "minute");

        // Then convert to selected timezone
        const tzStart = utcStart.tz(timezone);
        const tzEnd = utcEnd.tz(timezone);

        // Ensure end time is after start time
        const finalEnd = tzEnd.isBefore(tzStart)
          ? tzStart.add(50, "minute")
          : tzEnd;

        // Calculate hours until start for validation
        const hoursUntilStart = tzStart.diff(dayjs(), "hour");

        return {
          id: String(event.id),
          title: title,
          start: tzStart.format("YYYY-MM-DDTHH:mm:ss"),
          end: finalEnd.format("YYYY-MM-DDTHH:mm:ss"),
          allDay: false,
          backgroundColor: event.eventColor || event.teacherColor,
          resourceId: teacherId, // Keep original resourceId
          teacherId: finalTeacherId,
          teacher_name: teacherName,
          extendedProps: {
            teacherId: finalTeacherId,
            teacher_name: teacherName,
            class_status: event.class_status || "scheduled",
            class_type: event.class_type || "",
            payment_status: event.payment_status || "",
            originalStart: event.startDate,
            originalEnd: event.endDate,
            timezone: timezone,
            utcStart: utcStart.format(),
            utcEnd: utcEnd.format(),
            duration: finalEnd.diff(tzStart, "minute"),
            hoursUntilStart: hoursUntilStart,
            studentId: event.studentId || event.student_id,
            student_name_text: event.student_name_text,
          },
        };
      });

      console.log("Processed events:", events);
      console.log("Events count:", events.length);
      console.log(
        "📊 Final processed events with teacher data:",
        events.map((event) => ({
          id: event.id,
          title: event.title,
          teacherId: event.teacherId,
          teacher_name: event.teacher_name,
          resourceId: event.resourceId,
          student_name_text: event.extendedProps?.student_name_text,
          studentId: event.extendedProps?.studentId,
          extendedProps: event.extendedProps,
        }))
      );

      setEvents(events);
      setDisplayedEvents(events);

      console.log(
        "Events state updated. displayedEvents count:",
        events.length
      );
    } catch (error) {
      console.error("Error fetching events:", error);
      message.error("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  };

  const checkReservedClasses = async () => {
    try {
      // Get current time in user timezone for consistent comparisons
      const currentTimeInUserTz = dayjs().tz(timezone);
      console.log(
        "🕐 Current time in user timezone:",
        currentTimeInUserTz.format("YYYY-MM-DD HH:mm:ss")
      );
      console.log("🕐 User timezone:", timezone);

      // Get all reserved events
      const reservedEvents = events.filter(
        (event) =>
          (event.extendedProps as EventExtendedProps)?.payment_status ===
          "reserved"
      );

      console.log("📋 Found reserved events:", reservedEvents.length);

      // Find events that need to be deleted (less than 12 hours until start)
      const eventsToDelete = reservedEvents.filter((event) => {
        // event.start вже в часовому поясі користувача, тому використовуємо його без додаткової конвертації
        const startTime = dayjs(event.start);
        const currentTimeInUserTz = dayjs().tz(timezone);
        const hoursUntilStart = startTime.diff(currentTimeInUserTz, "hour");

        console.log("🔍 Checking event:", {
          id: event.id,
          title: event.title,
          start: startTime.format("YYYY-MM-DD HH:mm:ss"),
          currentTimeInUserTz: currentTimeInUserTz.format(
            "YYYY-MM-DD HH:mm:ss"
          ),
          hoursUntilStart: hoursUntilStart,
          willDelete: hoursUntilStart < 12,
        });

        return hoursUntilStart < 12;
      });

      console.log("🗑️ Events to delete:", eventsToDelete.length);

      // If we have events to delete
      if (eventsToDelete.length > 0) {
        console.log(
          "Found reserved classes to remove:",
          eventsToDelete.map((event) => ({
            id: event.id,
            title: event.title,
            start: dayjs(event.start).format("YYYY-MM-DD HH:mm:ss"),
          }))
        );

        // Delete each event from backend
        for (const event of eventsToDelete) {
          try {
            await api.delete(`/calendar/events/${event.id}`);
          } catch (error) {
            console.error(`Failed to delete event ${event.id}:`, error);
          }
        }

        // Update frontend state
        const updatedEvents = events.filter(
          (event) => !eventsToDelete.some((e) => e.id === event.id)
        );

        setEvents(updatedEvents);
        setDisplayedEvents(updatedEvents);

        message.success(
          `Removed ${eventsToDelete.length} expired reserved classes`
        );
      }

      // Log remaining reserved events
      const remainingReserved = events.filter(
        (event) =>
          !eventsToDelete.some((e) => e.id === event.id) &&
          (event.extendedProps as EventExtendedProps)?.payment_status ===
            "reserved"
      );

      if (remainingReserved.length > 0) {
        console.log(
          "Remaining reserved classes:",
          remainingReserved.map((event) => ({
            id: event.id,
            title: event.title,
            start: dayjs(event.start).format("YYYY-MM-DD HH:mm:ss"),
            hoursUntilStart: dayjs(event.start).diff(
              currentTimeInUserTz,
              "hour"
            ),
          }))
        );
      }
    } catch (error) {
      console.error("Error checking reserved classes:", error);
      message.error("Failed to check reserved classes");
    }
  };

  // Add useEffect to run check periodically
  useEffect(() => {
    // Check immediately when component mounts
    checkReservedClasses();

    // Then check every 5 minutes
    const interval = setInterval(checkReservedClasses, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [events]); // Re-create interval when events change

  // Add useEffect to refetch events when timezone changes
  useEffect(() => {
    if (calendarRef.current) {
      fetchEvents();
    }
  }, [timezone]);

  // Add periodic check for reserved classes
  useEffect(() => {
    const checkReservedClasses = async () => {
      try {
        await api.get("/calendar/check-reserved");
        // Refresh events after checking
        fetchEvents();
      } catch (error) {
        console.error("Error checking reserved classes:", error);
      }
    };

    // Check immediately when component mounts
    checkReservedClasses();

    // Then check every 5 minutes
    const interval = setInterval(checkReservedClasses, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []); // Remove fetchEvents from dependencies since it's defined in component

  // Initial events fetch
  useEffect(() => {
    const initializeData = async () => {
      console.log("🔄 Initializing calendar data...");
      await fetchTeachers();
      await fetchStudents();
      await fetchEvents();
      console.log("✅ Calendar data initialized");
    };

    initializeData();
  }, []);

  // Update events filtering
  useEffect(() => {
    if (selectedTeacherIds.length > 0) {
      const filteredEvents = events.filter((event) => {
        const eventTeacherId = Number(
          event.teacherId || event.extendedProps?.teacherId
        );
        return selectedTeacherIds.includes(eventTeacherId);
      });
      setDisplayedEvents(filteredEvents);
    } else {
      setDisplayedEvents(events);
    }
  }, [selectedTeacherIds, events]);

  // Add useEffect to initialize selected teachers
  useEffect(() => {
    if (teachers.length > 0 && selectedTeacherIds.length === 0) {
      // If no teachers selected, select the first one by default
      setSelectedTeacherIds([teachers[0].id]);
    }
  }, [teachers]);

  // Refetch events when teachers are loaded
  useEffect(() => {
    if (teachers.length > 0 && calendarRef.current) {
      console.log("Teachers loaded, refetching events...");
      fetchEvents();
    }
  }, [teachers]);

  const handleCreateEvent = async () => {
    try {
      if (!eventForm.teacherId || !eventForm.start || !eventForm.end) {
        message.error("Please fill in all required fields");
        return;
      }

      if (
        eventForm.repeating.type === "weekly" &&
        eventForm.repeating.days.length === 0
      ) {
        message.error("Please select at least one day for weekly repeat");
        return;
      }

      // Check student's remaining classes if student is selected
      let paymentStatus = "reserved";
      if (eventForm.studentId) {
        try {
          const response = await api.get(
            `/students/${eventForm.studentId}/remaining-classes`
          );
          const remainingClasses = response.data.remainingClasses || 0;
          paymentStatus = remainingClasses > 0 ? "paid" : "reserved";

          // Silent handling of reserved status
        } catch (error) {
          console.error("Error checking remaining classes:", error);
          paymentStatus = "reserved";
        }
      }

      const createSingleEvent = async (start: string, end: string) => {
        console.log("🚀 Creating single event:", {
          start,
          end,
          teacherId: eventForm.teacherId,
        });

        // Перевіряємо чи час зайнятий
        const isBusy = await isTimeSlotBusy(start, end, timezone);
        if (isBusy) {
          throw new Error("This time is already occupied by another event.");
        }

        // Додаємо логування для діагностики
        console.log("🔍 Creating event with times:");
        console.log("Original start:", start);
        console.log("Original end:", end);
        console.log("User timezone:", timezone);
        console.log("DB timezone:", DEFAULT_DB_TIMEZONE);

        // Parse the input dates in the user's timezone
        const startInUserTz = dayjs.tz(start, timezone);
        const endInUserTz = dayjs.tz(end, timezone);

        // Convert to UTC for storage
        const startInUtc = startInUserTz.utc();
        const endInUtc = endInUserTz.utc();

        console.log(
          "Start in user timezone:",
          startInUserTz.format("YYYY-MM-DD HH:mm:ss")
        );
        console.log("Start in UTC:", startInUtc.format("YYYY-MM-DD HH:mm:ss"));
        console.log(
          "End in user timezone:",
          endInUserTz.format("YYYY-MM-DD HH:mm:ss")
        );
        console.log("End in UTC:", endInUtc.format("YYYY-MM-DD HH:mm:ss"));

        const eventData = {
          class_type: eventForm.classType,
          student_id: eventForm.studentId,
          teacher_id: eventForm.teacherId,
          class_status: eventForm.status,
          payment_status: paymentStatus,
          startDate: startInUtc.format(),
          endDate: endInUtc.format(),
          duration:
            eventForm.classType === "Trial"
              ? 30
              : endInUserTz.diff(startInUserTz, "minute"),
        };

        console.log("Sending event data:", eventData);

        const response = await api.post("/calendar/events", {
          events: {
            added: [eventData],
          },
        });
        return response.data;
      };

      if (eventForm.repeating.type === "none") {
        await createSingleEvent(eventForm.start, eventForm.end);
      } else {
        const startDate = dayjs(eventForm.start);
        const endDate = dayjs(eventForm.end);
        const duration = endDate.diff(startDate, "minute");

        // For repeating events, check all slots first
        const slots = [];
        for (let week = 0; week < eventForm.repeating.weeks; week++) {
          for (const day of eventForm.repeating.days) {
            const currentDate = startDate.add(week, "week").day(day);
            const currentEndDate = currentDate.add(duration, "minute");
            slots.push({ start: currentDate, end: currentEndDate });
          }
        }

        // Check all slots first
        for (const slot of slots) {
          const isBusy = await isTimeSlotBusy(
            slot.start.format("YYYY-MM-DDTHH:mm:ss"),
            slot.end.format("YYYY-MM-DDTHH:mm:ss"),
            timezone
          );
          if (isBusy) {
            throw new Error(
              `Час ${slot.start.format("DD.MM.YYYY HH:mm")} вже зайнятий`
            );
          }
        }

        // If all slots are free, create events
        for (const slot of slots) {
          await createSingleEvent(
            slot.start.format("YYYY-MM-DDTHH:mm:ss"),
            slot.end.format("YYYY-MM-DDTHH:mm:ss")
          );
        }
      }

      message.success("Event(s) created successfully");
      setIsCreateModalOpen(false);

      // Reset form after successful creation
      setEventForm({
        teacherId: null,
        studentId: null,
        start: "",
        end: "",
        classType: "Regular",
        status: "scheduled",
        duration: "50 min",
        repeating: {
          type: "none",
          days: [],
          weeks: 2,
        },
      });
      setEventError("");
      setStudentSearch("");

      console.log("🔄 Calling fetchEvents after creation...");
      await fetchEvents();
      console.log("✅ fetchEvents completed after creation");

      // Force FullCalendar to refresh
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.refetchEvents();
      }

      // Helper function to update displayedEvents based on current filters
      updateDisplayedEvents();

      // Notify other components that events have been updated
      localStorage.setItem("calendarEventsUpdated", Date.now().toString());
    } catch (error: any) {
      console.error("Error creating event:", error);
      message.error(error.message || "Failed to create event");
    }
  };

  const handleDateSelect = async (selectInfo: any) => {
    // FullCalendar provides dates in local timezone, so we need to parse them correctly
    const startTime = dayjs.tz(selectInfo.start, timezone);
    const currentTimeInUserTz = dayjs().tz(timezone);
    const hoursUntilStart = startTime.diff(currentTimeInUserTz, "hour");

    console.log("📅 Date selected - DETAILED:", {
      originalStart: selectInfo.start,
      originalEnd: selectInfo.end,
      startTime: startTime.format("YYYY-MM-DD HH:mm:ss"),
      startTimeISO: startTime.toISOString(),
      currentTime: currentTimeInUserTz.format("YYYY-MM-DD HH:mm:ss"),
      hoursUntilStart: hoursUntilStart,
      timezone: timezone,
      userTimezone: dayjs.tz.guess(),
      localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    try {
      // Check if trying to create event less than 12 hours in advance
      if (hoursUntilStart < 12) {
        message.error("Cannot create classes less than 12 hours in advance");
        return;
      }

      // Check if time slot is already occupied
      const isBusy = await isTimeSlotBusy(
        selectInfo.start,
        selectInfo.end,
        timezone
      );

      if (isBusy) {
        message.error("This time is already occupied by another event.");
        return;
      }

      // Format the time properly in the user's timezone
      const formattedStart = startTime.format("YYYY-MM-DDTHH:mm:ss");
      const formattedEnd = dayjs
        .tz(selectInfo.end, timezone)
        .format("YYYY-MM-DDTHH:mm:ss");

      console.log("🕐 Time formatting in handleDateSelect:", {
        originalStart: selectInfo.start,
        originalEnd: selectInfo.end,
        formattedStart: formattedStart,
        formattedEnd: formattedEnd,
        timezone: timezone,
        startTimeLocal: dayjs(selectInfo.start).format("YYYY-MM-DD HH:mm:ss"),
        startTimeUserTz: startTime.format("YYYY-MM-DD HH:mm:ss"),
        startTimeUTC: startTime.utc().format("YYYY-MM-DD HH:mm:ss"),
      });

      // Check student's remaining classes
      if (eventForm.studentId) {
        const response = await api.get(
          `/students/${eventForm.studentId}/remaining-classes`
        );
        const remainingClasses = response.data.remainingClasses || 0;

        setEventForm((prev) => ({
          ...prev,
          start: formattedStart,
          end: formattedEnd,
          payment_status: remainingClasses <= 0 ? "reserved" : "paid",
        }));
      } else {
        setEventForm((prev) => ({
          ...prev,
          start: formattedStart,
          end: formattedEnd,
        }));
      }

      setIsCreateModalOpen(true);
    } catch (error) {
      console.error("Error during class creation:", error);
      message.error("Failed to create class");
    }
  };

  const handleCreateButtonClick = () => {
    setEventForm({
      teacherId: null,
      studentId: null,
      start: "",
      end: "",
      classType: "Regular",
      status: "scheduled",
      duration: "50 min",
      payment_status: "unpaid",
      repeating: {
        type: "none",
        days: [],
        weeks: 1,
      },
    });
    setIsCreateModalOpen(true);
  };

  const resetEventForm = () => {
    setEventForm({
      teacherId: null,
      studentId: null,
      start: "",
      end: "",
      classType: "Regular",
      status: "scheduled",
      duration: "50 min",
      payment_status: "unpaid",
      repeating: {
        type: "none",
        days: [],
        weeks: 1,
      },
    });
  };

  useEffect(() => {
    console.log("Modal state changed:", isCreateModalOpen);
  }, [isCreateModalOpen]);

  // Додамо функцію для визначення кольору тексту залежно від фону
  const getContrastColor = (bgColor: string) => {
    // Якщо колір не вказано, повертаємо чорний
    if (!bgColor) return "#000000";

    // Конвертуємо HEX в RGB
    const hex = bgColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Розраховуємо яскравість
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    // Повертаємо білий для темних кольорів і чорний для світлих
    return brightness > 128 ? "#000000" : "#FFFFFF";
  };

  // Add this function to format the event title with payment status
  const formatEventTitle = (event: any) => {
    let title = event.name || "";

    // Add payment status indicator
    if (event.payment_status === "reserved") {
      title = `🔒 ${title}`; // Add lock emoji for reserved classes
    } else if (event.payment_status === "paid") {
      title = `✅ ${title}`; // Add checkmark for paid classes
    }

    return title;
  };

  // Proper unavailable event check
  const isUnavailableEvent = (event: any) => {
    const classType =
      (event.extendedProps as EventExtendedProps)?.class_type || "";
    return classType.toLowerCase() === "unavailable";
  };

  // Update events processing to handle unavailable events
  const processEvents = (events: any[], timezone: string) => {
    return events.map((event) => {
      const isUnavailable = isUnavailableEvent(event);
      const processedEvent = {
        ...event,
        editable: !isUnavailable,
        startEditable: !isUnavailable,
        durationEditable: !isUnavailable,
      };

      // Convert times if they exist
      if (event.start) {
        processedEvent.start = convertToTimezone(event.start, timezone);
      }
      if (event.end) {
        processedEvent.end = convertToTimezone(event.end, timezone);
      }

      return processedEvent;
    });
  };

  // Event rendering with original appearance
  const renderEventContent = (eventInfo: any) => {
    const event = eventInfo.event;
    const classType =
      (event.extendedProps as EventExtendedProps)?.class_type || "";
    const paymentStatus =
      (event.extendedProps as EventExtendedProps)?.payment_status || "";
    const teacherName = event.extendedProps?.teacher_name;

    console.log("🎨 Rendering event:", {
      id: event.id,
      title: event.title,
      teacherName: teacherName,
      teacherId: event.extendedProps?.teacherId,
      classType: classType,
      paymentStatus: paymentStatus,
      extendedProps: event.extendedProps,
    });

    // Format time in selected timezone
    const startTime = dayjs(event.start).format("HH:mm");
    const endTime = dayjs(event.end).format("HH:mm");

    console.log("🕐 Time formatting:", {
      eventStart: event.start,
      eventEnd: event.end,
      startTime,
      endTime,
      timezone,
    });

    const isNotAvailable = isUnavailableEvent(event);

    // Use the full title without removing RSVR prefix
    const displayTitle = event.title;

    const classTypeDisplay =
      classTypes.find((type) => type.value === classType)?.label || classType;

    let backgroundColor;
    if (isNotAvailable) {
      backgroundColor = "#d32f2f";
    } else {
      switch (classType.toLowerCase()) {
        case "trial":
          backgroundColor = "#ff9800";
          break;
        case "regular":
          backgroundColor = "#2196f3";
          break;
        case "instant":
          backgroundColor = "#4caf50";
          break;
        case "group":
          backgroundColor = "#9c27b0";
          break;
        default:
          backgroundColor = event.backgroundColor || "#2196f3";
      }
    }

    // Adjust opacity for reserved classes
    if (paymentStatus === "reserved") {
      backgroundColor = backgroundColor + "99"; // Add 60% opacity
    }

    const textColor = "#ffffff";

    return (
      <div
        className="fc-event-main-content"
        style={{
          padding: "2px 4px",
          backgroundColor,
          height: "100%",
          minHeight: "65px",
          borderLeft: `3px solid ${backgroundColor.slice(0, 7)}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
          borderRadius: "3px",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: "500",
              color: textColor,
              lineHeight: "1.1",
              marginBottom: "1px",
              whiteSpace: "normal",
              overflow: "visible",
              wordBreak: "break-word",
              opacity: 0.9,
            }}
          >
            {isNotAvailable ? "Unavailable" : classTypeDisplay}
          </div>
          {!isNotAvailable && displayTitle && (
            <div
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: textColor,
                lineHeight: "1.1",
                marginBottom: "1px",
                whiteSpace: "normal",
                overflow: "visible",
                wordBreak: "break-word",
              }}
            >
              {displayTitle}
            </div>
          )}
          {!isNotAvailable && teacherName && (
            <div
              style={{
                fontSize: "10px",
                fontWeight: "500",
                color: textColor,
                lineHeight: "1.1",
                marginBottom: "1px",
                whiteSpace: "normal",
                overflow: "visible",
                wordBreak: "break-word",
                opacity: 0.9,
              }}
            >
              {teacherName}
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: "10px",
            fontWeight: "500",
            color: textColor,
            lineHeight: "1.1",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            opacity: 0.8,
          }}
        >
          {startTime} - {endTime}
        </div>
      </div>
    );
  };

  const handleEventClick = (clickInfo: any) => {
    const event = clickInfo.event;
    console.log("🎯 Event clicked:", {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      extendedProps: event.extendedProps,
      student_name_text: event.extendedProps?.student_name_text,
      studentId: event.extendedProps?.studentId,
    });

    // Check if this is an unavailable event
    const isNotAvailable = isUnavailableEvent(event);

    const eventDetailsData: EventDetails = {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      teacherId: event.extendedProps?.teacherId,
      studentId: event.extendedProps?.studentId,
      class_status: event.extendedProps?.class_status,
      isNotAvailable: isNotAvailable,
      rawEvent: event,
      student_name_text: event.extendedProps?.student_name_text,
      class_type: event.extendedProps?.class_type || "",
      teacher_name: event.extendedProps?.teacher_name,
    };

    console.log("📋 Event details for modal:", eventDetailsData);

    setEventDetails(eventDetailsData);
    setStatusValue(
      mapServerStatus(eventDetailsData.class_status || "scheduled")
    );
    setIsEventDetailsOpen(true);
  };

  const handleSaveEvent = async (eventId: string) => {
    try {
      console.log("🔧 handleSaveEvent called with:", {
        eventId,
        statusValue,
        eventDetails,
        originalStatus: eventDetails?.class_status,
        mappedStatus: statusValue,
        isNotAvailable: eventDetails?.isNotAvailable,
      });

      if (eventDetails?.isNotAvailable) {
        // For unavailable events, update the time using the calendarApi
        // Convert times to UTC for the API
        const startUTC = dayjs
          .tz(eventDetails.start, timezone)
          .utc()
          .format("YYYY-MM-DDTHH:mm:ss");
        const endUTC = dayjs
          .tz(eventDetails.end, timezone)
          .utc()
          .format("YYYY-MM-DDTHH:mm:ss");

        const updateData = {
          id: eventId,
          start: startUTC, // Змінено з start_date на start
          end: endUTC, // Змінено з end_date на end
          class_status: statusValue,
          class_type: eventDetails.class_type || "Unavailable",
          teacher_id: eventDetails.teacherId,
        };

        console.log("🔄 Updating unavailable event with:", {
          originalStart: eventDetails.start,
          originalEnd: eventDetails.end,
          convertedStart: startUTC,
          convertedEnd: endUTC,
          timezone: timezone,
          updateData,
        });

        const response = await calendarApi.updateCalendarEvent(updateData);

        console.log(
          "✅ handleSaveEvent - Response for unavailable event:",
          response
        );

        // Додаткове логування для відстеження
        console.log("🔄 After API call - checking if event was updated...");

        message.success("Unavailable time slot updated successfully");

        console.log("Save event request details:", {
          eventId: eventId,
          statusValue: statusValue,
          endpoint:
            "POST /calendar/events (via calendarApi.updateCalendarEvent)",
          requestBody: updateData,
        });
      } else {
        // Use PATCH /calendar/events/:id/status for updating only event status
        const response = await api.patch(`/calendar/events/${eventId}/status`, {
          class_status: statusValue,
        });

        console.log("✅ handleSaveEvent - Response:", response.data);
        message.success("Event status updated successfully");

        console.log("Save event request details:", {
          eventId: eventId,
          statusValue: statusValue,
          endpoint: `/calendar/events/${eventId}/status`,
          requestBody: { class_status: statusValue },
        });
      }

      setEventDetails(null);
      setIsEventDetailsOpen(false);
      setIsEditingStatus(false); // Reset editing status

      // Clear events state first
      console.log("🧹 Clearing events state...");
      setEvents([]);
      setDisplayedEvents([]);

      // Wait a bit for state to clear
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Refresh events to show updated status
      console.log("🔄 Refreshing events...");
      await fetchEvents();

      // Force FullCalendar to refresh
      if (calendarRef.current) {
        console.log("🔄 Forcing FullCalendar refresh...");
        const calendarApi = calendarRef.current.getApi();
        calendarApi.refetchEvents();

        // Also try to rerender the calendar
        setTimeout(() => {
          calendarApi.render();
          console.log("🔄 Calendar re-rendered");
        }, 200);
      }

      // Helper function to update displayedEvents based on current filters
      console.log("🔄 Updating displayed events...");
      updateDisplayedEvents();

      // Notify other components that events have been updated
      localStorage.setItem("calendarEventsUpdated", Date.now().toString());

      console.log("✅ Event update completed successfully");

      // Додаткове оновлення для unavailable events
      if (eventDetails?.isNotAvailable) {
        console.log("🔄 Additional refresh for unavailable event...");
        setTimeout(async () => {
          await fetchEvents();
          if (calendarRef.current) {
            const calendarApi = calendarRef.current.getApi();
            calendarApi.refetchEvents();
          }
        }, 500);
      }
    } catch (error) {
      console.error("❌ Error updating event:", error);
      message.error("Failed to update event");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const response = await api.delete(`/calendar/events/${eventId}`);

      if (response.data) {
        message.success("Event deleted successfully");
        setEventDetails(null);
        setIsEventDetailsOpen(false);

        // Immediately remove the deleted event from displayed events
        setDisplayedEvents((prev) =>
          prev.filter((event) => event.id !== eventId)
        );
        setEvents((prev) => prev.filter((event) => event.id !== eventId));

        // Force FullCalendar to refresh
        if (calendarRef.current) {
          const calendarApi = calendarRef.current.getApi();
          calendarApi.refetchEvents();
        }

        // Then fetch fresh data to ensure everything is in sync
        setTimeout(async () => {
          await fetchEvents();
          updateDisplayedEvents();
        }, 100);

        // Notify other components that events have been updated
        localStorage.setItem("calendarEventsUpdated", Date.now().toString());
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      message.error("Failed to delete event");
    }
  };

  const classTypeOptions = [
    { value: "Regular", label: "Regular" },
    { value: "Unavailable", label: "Unavailable" },
    { value: "Training", label: "Training" },
    { value: "Trial", label: "Trial" },
    { value: "Instant", label: "Instant" },
    { value: "Group", label: "Group" },
  ];

  const durationOptions = [
    { value: "30 min", label: "30 minutes" },
    { value: "50 min", label: "50 minutes" },
    { value: "80 min", label: "80 minutes" },
  ];

  console.log("students in state:", students);
  const getFilteredStudents = (searchText: string) => {
    if (!Array.isArray(students)) return [];
    const search = searchText.trim().toLowerCase();
    if (!search) {
      console.log("filtered students (all):", students);
      return students;
    }
    // Якщо введено одну букву — шукаємо по першій букві імені або прізвища
    if (search.length === 1) {
      const filtered = students.filter(
        (student) =>
          student.first_name.toLowerCase().startsWith(search) ||
          student.last_name.toLowerCase().startsWith(search)
      );
      console.log("filtered students (first letter):", filtered);
      return filtered;
    }
    // Інакше — шукаємо по входженню
    const filtered = students.filter(
      (student) =>
        student.first_name.toLowerCase().includes(search) ||
        student.last_name.toLowerCase().includes(search) ||
        `${student.first_name} ${student.last_name}`
          .toLowerCase()
          .includes(search) ||
        `${student.first_name} ${student.last_name}`
          .toLowerCase()
          .includes(searchText.toLowerCase())
    );
    console.log("filtered students:", filtered);
    return filtered;
  };

  // Add styles for the modal
  const modalStyle = {
    content: {
      width: "400px",
      padding: "32px",
      borderRadius: "8px",
    },
  };

  const formItemStyle = {
    marginBottom: "24px",
  };

  const buttonStyle = {
    height: "40px",
    borderRadius: "6px",
    fontWeight: 500,
  };

  // Add a helper to get user role
  function getUserRole() {
    if (typeof window !== "undefined") {
      return localStorage.getItem("user-role") || "teacher";
    }
    return "teacher";
  }

  // Додаю функцію для відкриття модального редагування
  const handleEditEvent = () => {
    if (!eventDetails) return;

    console.log("Editing event details:", eventDetails);
    console.log("Available teachers:", teachers);

    // Use teacherId from eventDetails (already processed in handleEventClick)
    let teacherId = eventDetails.teacherId;

    console.log("TeacherId from eventDetails:", teacherId);

    // If no teacherId, try to find by teacher name
    if (!teacherId && eventDetails.teacher_name) {
      const teacher = teachers.find(
        (t) => `${t.first_name} ${t.last_name}` === eventDetails.teacher_name
      );
      if (teacher) {
        teacherId = String(teacher.id);
        console.log("Found teacher by name:", teacher, "teacherId:", teacherId);
      }
    }

    // Final fallback: try to get from raw event
    if (!teacherId && eventDetails.rawEvent) {
      const rawTeacherId =
        eventDetails.rawEvent.extendedProps?.teacherId ||
        eventDetails.rawEvent.extendedProps?.teacher_id ||
        eventDetails.rawEvent.extendedProps?.resourceId;

      if (rawTeacherId) {
        teacherId = String(rawTeacherId);
        console.log("Found teacherId from raw event:", teacherId);
      }
    }

    console.log("Final teacherId for edit:", teacherId);

    const editData = {
      ...eventDetails,
      class_type: eventDetails.class_type || "Regular",
      class_status: statusValue,
      teacherId: teacherId,
    };

    console.log("📝 Setting editEventData:", editData);
    console.log("👨‍🏫 Teacher data in editEventData:", {
      teacherId: editData.teacherId,
      teacher_name: editData.teacher_name,
      originalTeacherId: eventDetails.teacherId,
    });

    setEditEventData(editData);

    setIsEventDetailsOpen(false);
    setIsEditModalOpen(true);
  };

  // Додаю функцію для збереження редагованої події
  const handleUpdateEvent = async (updatedData: any) => {
    try {
      console.log("🔄 Updating event with data:", updatedData);
      console.log("📋 EditEventData:", editEventData);

      // Get teacher information from editEventData
      const teacherId = editEventData?.teacherId;
      const teacher = teachers.find((t) => String(t.id) === String(teacherId));
      const teacher_name = teacher
        ? `${teacher.first_name} ${teacher.last_name}`
        : editEventData?.teacher_name || "Unknown Teacher";

      console.log("👨‍🏫 Teacher info for update:", {
        teacherId,
        teacher,
        teacher_name,
        teachersCount: teachers.length,
      });

      // В режимі редагування оновлюємо start_date, end_date, class_status та teacher_id
      const eventDataForUpdate = {
        id: parseInt(updatedData.id),
        start_date: updatedData.start_date,
        end_date: updatedData.end_date,
        class_status: updatedData.class_status,
      };

      console.log("📤 Final event data for update:", eventDataForUpdate);
      console.log("🔍 Teacher ID details:", {
        teacherId,
        teacher_id: teacherId ? parseInt(teacherId) : undefined,
        teacherIdType: typeof teacherId,
        parsedTeacherId: teacherId ? parseInt(teacherId) : undefined,
      });

      // Use POST /calendar/events for updating events
      const requestData = {
        events: {
          updated: [eventDataForUpdate],
        },
      };

      console.log("📡 Sending update request:", requestData);

      const response = await api.post("/calendar/events", requestData);

      console.log("✅ Update response:", response.data);
      console.log("🔍 Response details:", {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
      });

      setIsEditModalOpen(false);
      setEditEventData(null);

      // Оновлюємо всі події
      await fetchEvents();

      // Оновлюємо відображення
      updateDisplayedEvents();

      message.success("Event updated successfully");
    } catch (error) {
      console.error("❌ Error updating event:", error);
      message.error("Failed to update event");
    }
  };

  // Helper function to check time slot busy excluding a specific event
  const checkTimeSlotBusyExcludingEvent = async (
    start: string,
    end: string,
    userTimezone: string,
    excludeEventId: string | number
  ): Promise<boolean> => {
    try {
      const response = await api.get("/calendar/events");
      const events = Array.isArray(response.data)
        ? response.data
        : response.data.events?.rows || [];

      console.log("🔍 Total events to check (excluding event):", events.length);

      // Convert input times to UTC for comparison
      const newStart = dayjs.tz(start, userTimezone).utc();
      const newEnd = dayjs.tz(end, userTimezone).utc();

      console.log("🔍 Checking time slot (excluding event):", {
        inputStart: start,
        inputEnd: end,
        excludeEventId: excludeEventId,
        convertedStart: newStart.format("YYYY-MM-DD HH:mm:ss"),
        convertedEnd: newEnd.format("YYYY-MM-DD HH:mm:ss"),
        timezone: userTimezone,
      });

      for (const event of events) {
        // Skip cancelled events and the event being edited
        if (event.class_status === "cancelled") {
          console.log("⏭️ Skipping cancelled event:", event.id);
          continue;
        }

        if (String(event.id) === String(excludeEventId)) {
          console.log("⏭️ Skipping excluded event:", event.id);
          continue;
        }

        console.log("🔍 Processing event (excluding check):", {
          id: event.id,
          startDate: event.startDate,
          endDate: event.endDate,
          class_status: event.class_status,
          class_type: event.class_type,
        });

        // Events from database are already in UTC
        const eventStart = dayjs.utc(event.startDate);
        const eventEnd = dayjs.utc(event.endDate);

        console.log("🔍 Comparing with event (excluding check):", {
          eventId: event.id,
          eventStart: eventStart.format("YYYY-MM-DD HH:mm:ss"),
          eventEnd: eventEnd.format("YYYY-MM-DD HH:mm:ss"),
          newStart: newStart.format("YYYY-MM-DD HH:mm:ss"),
          newEnd: newEnd.format("YYYY-MM-DD HH:mm:ss"),
          hasOverlap: newStart.isBefore(eventEnd) && newEnd.isAfter(eventStart),
          overlapDetails: {
            newStartBeforeEventEnd: newStart.isBefore(eventEnd),
            newEndAfterEventStart: newEnd.isAfter(eventStart),
          },
        });

        // Перевіряємо чи є перекриття
        // Два часові проміжки перекриваються, якщо:
        // 1. Початок нового проміжку перед кінцем існуючого І
        // 2. Кінець нового проміжку після початку існуючого
        const hasOverlap =
          newStart.isBefore(eventEnd) && newEnd.isAfter(eventStart);

        // Додаткова перевірка для точного перекриття
        const exactOverlap =
          newStart.isSame(eventStart) && newEnd.isSame(eventEnd);
        const partialOverlap = hasOverlap || exactOverlap;

        if (partialOverlap) {
          console.log(
            "❌ Time slot is busy! Overlap detected with event:",
            event.id
          );
          console.log("Overlap type:", {
            hasOverlap,
            exactOverlap,
            partialOverlap,
          });
          return true; // Час зайнятий
        }
      }

      console.log("✅ Time slot is free!");
      return false; // Час вільний
    } catch (error) {
      console.error("Error checking time slot:", error);
      return false;
    }
  };

  // Helper function to update displayedEvents based on current filters
  const updateDisplayedEvents = () => {
    console.log("🔄 Updating displayed events:", {
      totalEvents: events.length,
      selectedTeacherIds: selectedTeacherIds,
    });

    if (selectedTeacherIds.length > 0) {
      const filteredEvents = events.filter((event) => {
        const eventTeacherId = Number(
          event.teacherId || event.extendedProps?.teacherId
        );
        const isIncluded = selectedTeacherIds.includes(eventTeacherId);

        console.log("🔍 Filtering event:", {
          id: event.id,
          title: event.title,
          eventTeacherId: eventTeacherId,
          isIncluded: isIncluded,
          teacherName: event.extendedProps?.teacher_name,
        });

        return isIncluded;
      });

      console.log("📊 Filtered events count:", filteredEvents.length);
      setDisplayedEvents(filteredEvents);
    } else {
      console.log("📊 Showing all events:", events.length);
      setDisplayedEvents(events);
    }
  };

  // Helper function to map server status values to our format
  const mapServerStatus = (serverStatus: string): string => {
    const statusMap: { [key: string]: string } = {
      given: "Given",
      student_no_show: "No show student",
      teacher_no_show: "No show teacher",
      cancelled: "Cancelled",
      scheduled: "scheduled",
      not_available: "Not Available",
      // Direct mappings for server values
      Given: "Given",
      "No show student": "No show student",
      "No show teacher": "No show teacher",
      Cancelled: "Cancelled",
      "Not Available": "Not Available",
    };

    return statusMap[serverStatus] || "scheduled";
  };

  const handleAvailabilityChange = (field: string, value: any) => {
    setAvailabilityForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddUnavailable = async () => {
    try {
      if (
        !availabilityForm.teacherId ||
        !availabilityForm.date ||
        !availabilityForm.startTime ||
        !availabilityForm.endTime
      ) {
        message.error("Please fill in all required fields");
        return;
      }

      const teacher = teachers.find((t) => t.id === availabilityForm.teacherId);
      if (!teacher) {
        message.error("Teacher not found");
        return;
      }

      // Convert times to UTC for the API
      const startDate = dayjs.tz(availabilityForm.date, timezone);
      const startTime = dayjs.tz(availabilityForm.startTime, timezone);
      const endTime = dayjs.tz(availabilityForm.endTime, timezone);

      const startDateTime = startDate
        .hour(startTime.hour())
        .minute(startTime.minute());
      const endDateTime = startDate
        .hour(endTime.hour())
        .minute(endTime.minute());

      const startUTC = startDateTime.utc().format("YYYY-MM-DDTHH:mm:ss");
      const endUTC = endDateTime.utc().format("YYYY-MM-DDTHH:mm:ss");

      console.log("🔄 Adding unavailable time:", {
        teacherId: availabilityForm.teacherId,
        startDate: startDateTime.format("YYYY-MM-DD HH:mm:ss"),
        endDate: endDateTime.format("YYYY-MM-DD HH:mm:ss"),
        startUTC,
        endUTC,
        timezone,
      });

      const eventData = {
        class_type: "Unavailable",
        teacher_id: availabilityForm.teacherId,
        class_status: "Not Available",
        startDate: startUTC,
        endDate: endUTC,
      };

      if (availabilityForm.repeat) {
        // Handle repeating unavailable times
        const slots = [];
        for (let week = 0; week < availabilityForm.repeatWeeks; week++) {
          for (const day of availabilityForm.repeatDays) {
            const currentDate = startDate.add(week, "week").day(day);
            const currentStart = currentDate
              .hour(startTime.hour())
              .minute(startTime.minute());
            const currentEnd = currentDate
              .hour(endTime.hour())
              .minute(endTime.minute());

            slots.push({
              class_type: "Unavailable",
              teacher_id: availabilityForm.teacherId,
              class_status: "Not Available",
              startDate: currentStart.utc().format("YYYY-MM-DDTHH:mm:ss"),
              endDate: currentEnd.utc().format("YYYY-MM-DDTHH:mm:ss"),
            });
          }
        }

        // Create all events
        for (const slot of slots) {
          await api.post("/calendar/events", {
            events: {
              added: [slot],
            },
          });
        }
      } else {
        // Create single event
        await api.post("/calendar/events", {
          events: {
            added: [eventData],
          },
        });
      }

      message.success("Unavailable time added successfully");
      setIsAvailabilityModalOpen(false);

      // Reset form
      setAvailabilityForm({
        teacherId: null,
        date: null,
        repeat: false,
        startTime: null,
        endTime: null,
        repeatDays: [],
        repeatWeeks: 1,
      });

      // Refresh events
      await fetchEvents();
    } catch (error) {
      console.error("Error adding unavailable time:", error);
      message.error("Failed to add unavailable time");
    }
  };

  const handleEventUpdate = async (info: any) => {
    console.log("handleEventUpdate called with:", info);
    console.log("Event details:", {
      id: info.event.id,
      title: info.event.title,
      start: info.event.start,
      end: info.event.end,
      oldStart: info.oldEvent.start,
      oldEnd: info.oldEvent.end,
    });

    try {
      // Перевіряємо чи це unavailable event
      const isUnavailable = isUnavailableEvent(info.event);
      let updatedEvent: CustomEventInput;

      if (isUnavailable) {
        // Для unavailable events використовуємо спеціальну обробку
        const startUTC = dayjs(info.event.start)
          .utc()
          .format("YYYY-MM-DDTHH:mm:ss");
        const endUTC = dayjs(info.event.end)
          .utc()
          .format("YYYY-MM-DDTHH:mm:ss");

        const updateData = {
          id: info.event.id,
          start: startUTC,
          end: endUTC,
          class_status:
            info.event.extendedProps?.class_status || "Not Available",
          class_type: info.event.extendedProps?.class_type || "Unavailable",
          teacher_id:
            info.event.extendedProps?.teacherId ||
            info.event.extendedProps?.teacher_id,
        };

        console.log(
          "🔄 Updating unavailable event via drag/resize:",
          updateData
        );

        const response = await calendarApi.updateCalendarEvent(updateData);
        console.log("Update response for unavailable event:", response);

        message.success("Unavailable time slot updated successfully");

        // Створюємо updatedEvent для unavailable events
        updatedEvent = {
          id: info.event.id,
          title: info.event.title,
          start: info.event.start,
          end: info.event.end,
          allDay: info.event.allDay || false,
          teacher_name: info.event.extendedProps?.teacher_name,
          backgroundColor: info.event.backgroundColor,
          borderColor: info.event.borderColor,
          textColor: info.event.textColor,
          extendedProps: {
            ...info.event.extendedProps,
            teacherId: info.event.extendedProps?.teacher_id,
            studentId: info.event.extendedProps?.student_id,
            teacher_name: info.event.extendedProps?.teacher_name,
            student_name_text: info.event.extendedProps?.student_name,
          },
        };
      } else {
        // Звичайна обробка для інших подій
        updatedEvent = {
          id: info.event.id,
          title: info.event.title,
          start: info.event.start,
          end: info.event.end,
          allDay: info.event.allDay || false,
          teacher_name: info.event.extendedProps.teacher_name,
          backgroundColor: info.event.backgroundColor,
          borderColor: info.event.borderColor,
          textColor: info.event.textColor,
          extendedProps: {
            ...info.event.extendedProps,
            teacherId: info.event.extendedProps.teacher_id,
            studentId: info.event.extendedProps.student_id,
            teacher_name: info.event.extendedProps.teacher_name,
            student_name_text: info.event.extendedProps.student_name,
          },
        };

        console.log("Sending updated event:", updatedEvent);

        const response = await calendarApi.updateCalendarEvent(updatedEvent);
        console.log("Update response:", response);
      }

      // Оновлюємо локальний стан
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === updatedEvent.id ? updatedEvent : event
        )
      );

      // Оновлюємо displayedEvents
      setDisplayedEvents((prevDisplayedEvents) =>
        prevDisplayedEvents.map((event) =>
          event.id === updatedEvent.id ? updatedEvent : event
        )
      );

      // Примусово оновлюємо календар
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.refetchEvents();
      }

      // Викликаємо updateDisplayedEvents для правильного фільтрування
      setTimeout(() => {
        updateDisplayedEvents();
      }, 100);

      toast.success("Event successfully updated!");
    } catch (error) {
      console.error("Failed to update event:", error);
      toast.error("Помилка при оновленні події");
      // Відновлюємо оригінальний стан події
      info.revert();
    }
  };

  return (
    <div className="calendar-container with-sidebar">
      <div className="calendar-sidebar">
        <div className="sidebar-title">Teachers</div>
        {loading ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            Loading teachers...
          </div>
        ) : teachers.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#fff" }}>
            No teachers found
          </div>
        ) : (
          <ul className="teacher-list">
            {teachers.map((teacher) => (
              <li
                key={teacher.id}
                className={`teacher-item${
                  selectedTeacherIds.includes(teacher.id) ? " selected" : ""
                }`}
                onClick={() => {
                  setSelectedTeacherIds((prev) =>
                    prev.includes(teacher.id)
                      ? prev.filter((id) => id !== teacher.id)
                      : [...prev, teacher.id]
                  );
                }}
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTeacherIds.includes(teacher.id)}
                  readOnly
                  style={{ marginRight: 8 }}
                />
                <span
                  className="teacher-color"
                  style={{ background: teacher.color || "#1677ff" }}
                />
                <span className="teacher-name">
                  {teacher.first_name} {teacher.last_name}
                </span>
              </li>
            ))}
            <li
              className={`teacher-item${
                selectedTeacherIds.length === 0 ? " selected" : ""
              }`}
              onClick={() => setSelectedTeacherIds([])}
              style={{ cursor: "pointer", marginTop: 12, fontWeight: 600 }}
            >
              <input
                type="checkbox"
                checked={selectedTeacherIds.length === 0}
                readOnly
                style={{ marginRight: 8 }}
              />
              <span className="teacher-color" style={{ background: "#bbb" }} />
              <span className="teacher-name">All Teachers</span>
            </li>
          </ul>
        )}
      </div>
      <div className="calendar-main">
        <div
          className="calendar-header"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#1a1f2e",
            padding: "8px 0 4px 0",
            marginBottom: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1 }}></div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateButtonClick}
            style={{ height: 36, fontSize: 15 }}
          >
            Create Event
          </Button>
        </div>
        <div
          className="calendar-wrapper"
          style={{
            background: "#1a1f2e",
            borderRadius: "12px",
            padding: 0,
            boxShadow: "none",
            height: "calc(100vh - 0px)",
            minHeight: 400,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            headerToolbar={{
              left: "prev,next",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            initialView="timeGridWeek"
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            firstDay={1}
            events={displayedEvents}
            eventClick={handleEventClick}
            select={handleDateSelect}
            eventContent={renderEventContent}
            viewDidMount={handleViewChange}
            eventDrop={handleEventUpdate}
            eventResize={handleEventUpdate}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            allDaySlot={false}
            slotDuration="00:30:00"
            height="100%"
            eventDisplay="block"
            eventOverlap={false}
            slotEventOverlap={false}
            timeZone="local"
            slotLabelFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            eventTimeFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            nowIndicator={true}
            scrollTime={dayjs().format("HH:mm:ss")}
            eventMinHeight={50}
            displayEventTime={true}
            displayEventEnd={true}
          />
        </div>
        <Modal
          title="Create Event"
          open={isCreateModalOpen}
          onCancel={() => {
            setIsCreateModalOpen(false);
            resetEventForm();
          }}
          footer={null}
          width={400}
          centered
          className="availability-modal"
        >
          {eventError && (
            <div
              style={{
                color: "#d32f2f",
                background: "#fff0f0",
                border: "1px solid #ffbdbd",
                borderRadius: 8,
                padding: "16px 20px",
                margin: "0 auto 20px auto",
                textAlign: "center",
                fontWeight: 500,
                maxWidth: 380,
                fontSize: 16,
              }}
            >
              {eventError}
            </div>
          )}
          <Form layout="vertical">
            <Form.Item label="Class Type" style={formItemStyle}>
              <Select
                value={eventForm.classType}
                onChange={(v) => {
                  if (v === "Unavailable") {
                    setIsCreateModalOpen(false);
                    setIsAvailabilityModalOpen(true);
                    return;
                  }
                  setEventForm((prev) => ({
                    ...prev,
                    classType: v,
                    duration: v === "Trial" ? "30 min" : prev.duration,
                  }));
                }}
                options={classTypeOptions}
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item label="Teacher" style={formItemStyle}>
              <Select
                value={eventForm.teacherId ? String(eventForm.teacherId) : null}
                onChange={(v) =>
                  setEventForm((prev) => ({
                    ...prev,
                    teacherId: v ? parseInt(v) : null,
                  }))
                }
                options={teachers.map((t) => ({
                  value: String(t.id),
                  label: `${t.first_name} ${t.last_name}`,
                }))}
                placeholder="Select teacher"
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item label="Student" style={formItemStyle}>
              <Select
                showSearch
                value={eventForm.studentId ? String(eventForm.studentId) : null}
                onChange={(v) =>
                  setEventForm((prev) => ({
                    ...prev,
                    studentId: v ? parseInt(v) : null,
                  }))
                }
                onSearch={(value) => setStudentSearch(value)}
                filterOption={false}
                options={getFilteredStudents(studentSearch).map((s) => ({
                  value: String(s.id),
                  label: `${s.last_name} ${s.first_name}`,
                }))}
                placeholder="Type first letter or name to search"
                notFoundContent={
                  studentSearch ? "No students found" : "Type to search"
                }
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item label="Duration" style={formItemStyle}>
              <Select
                value={eventForm.duration}
                onChange={(v) =>
                  setEventForm((prev) => ({ ...prev, duration: v }))
                }
                options={durationOptions}
                disabled={eventForm.classType === "Trial"}
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item label="Class Status" style={formItemStyle}>
              <Select
                value={eventForm.status}
                onChange={(v) =>
                  setEventForm((prev) => ({ ...prev, status: v }))
                }
                options={[
                  { value: "scheduled", label: "Scheduled" },
                  { value: "given", label: "Given" },
                  { value: "student_no_show", label: "Student No Show" },
                  { value: "teacher_no_show", label: "Teacher No Show" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item label="Start Time" style={formItemStyle}>
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm"
                value={
                  eventForm.start ? dayjs.tz(eventForm.start, timezone) : null
                }
                onChange={(v) => {
                  if (v) {
                    const duration =
                      eventForm.classType === "Trial"
                        ? 30
                        : parseInt(eventForm.duration.replace(" min", ""));
                    const end = v.add(duration, "minute");

                    console.log("📅 DatePicker onChange - DETAILED:", {
                      selectedValue: v.format("YYYY-MM-DD HH:mm:ss"),
                      selectedValueISO: v.toISOString(),
                      timezone: timezone,
                      duration: duration,
                      durationString: eventForm.duration,
                      calculatedEnd: end.format("YYYY-MM-DD HH:mm:ss"),
                      calculatedEndISO: end.toISOString(),
                      selectedValueLocal: dayjs(v).format(
                        "YYYY-MM-DD HH:mm:ss"
                      ),
                      selectedValueUserTz: v
                        .tz(timezone)
                        .format("YYYY-MM-DD HH:mm:ss"),
                      selectedValueUTC: v.utc().format("YYYY-MM-DD HH:mm:ss"),
                    });

                    setEventForm({
                      teacherId: null,
                      studentId: null,
                      start: v.format("YYYY-MM-DD HH:mm:ss"),
                      end: end.format("YYYY-MM-DD HH:mm:ss"),
                      classType: "Regular",
                      status: "scheduled",
                      duration: "50 min",
                      payment_status: "unpaid",
                      repeating: {
                        type: "none",
                        days: [],
                        weeks: 1,
                      },
                    });
                  }
                }}
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item label="Repeating" style={formItemStyle}>
              <Select
                value={eventForm.repeating.type}
                onChange={(v) =>
                  setEventForm((prev) => ({
                    ...prev,
                    repeating: {
                      ...prev.repeating,
                      type: v as "none" | "weekly",
                    },
                  }))
                }
                options={[
                  { value: "none", label: "Does not repeat" },
                  { value: "weekly", label: "Weekly on certain days" },
                ]}
                style={{ width: "100%" }}
              />
            </Form.Item>

            {eventForm.repeating.type === "weekly" && (
              <>
                <Form.Item label="Repeat on" style={formItemStyle}>
                  <Select
                    mode="multiple"
                    value={eventForm.repeating.days}
                    onChange={(v) =>
                      setEventForm((prev) => ({
                        ...prev,
                        repeating: { ...prev.repeating, days: v },
                      }))
                    }
                    options={[
                      { value: 1, label: "Mon" },
                      { value: 2, label: "Tue" },
                      { value: 3, label: "Wed" },
                      { value: 4, label: "Thu" },
                      { value: 5, label: "Fri" },
                      { value: 6, label: "Sat" },
                      { value: 0, label: "Sun" },
                    ]}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item label="Number of weeks" style={formItemStyle}>
                  <InputNumber
                    min={1}
                    max={12}
                    value={eventForm.repeating.weeks}
                    onChange={(v) =>
                      setEventForm((prev) => ({
                        ...prev,
                        repeating: { ...prev.repeating, weeks: v || 1 },
                      }))
                    }
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </>
            )}

            <Row gutter={16}>
              <Col span={12}>
                <Button
                  block
                  onClick={() => setIsCreateModalOpen(false)}
                  style={buttonStyle}
                >
                  Cancel
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  type="primary"
                  onClick={handleCreateEvent}
                  block
                  style={buttonStyle}
                >
                  Create
                </Button>
              </Col>
            </Row>
          </Form>
        </Modal>
        <Modal
          open={isAvailabilityModalOpen}
          onCancel={() => setIsAvailabilityModalOpen(false)}
          footer={null}
          title="Set Your Availability"
          className="availability-modal"
          width={480}
        >
          <Form layout="vertical">
            <Form.Item label="Teacher">
              <Select
                value={availabilityForm.teacherId || undefined}
                options={teachers.map((t) => ({
                  value: t.id,
                  label: `${t.first_name} ${t.last_name}`,
                }))}
                onChange={(v) => handleAvailabilityChange("teacherId", v)}
              />
            </Form.Item>
            <Form.Item label="Date">
              <DatePicker
                style={{ width: "100%" }}
                value={availabilityForm.date}
                onChange={(v) => handleAvailabilityChange("date", v)}
              />
            </Form.Item>
            <Form.Item label="Repeat" valuePropName="checked">
              <Checkbox
                checked={availabilityForm.repeat}
                onChange={(e) =>
                  handleAvailabilityChange("repeat", e.target.checked)
                }
              />
            </Form.Item>
            {availabilityForm.repeat && (
              <>
                <Form.Item label="Repeat on days">
                  <Select
                    mode="multiple"
                    value={availabilityForm.repeatDays}
                    onChange={(v) => handleAvailabilityChange("repeatDays", v)}
                    options={[
                      { value: 1, label: "Mon" },
                      { value: 2, label: "Tue" },
                      { value: 3, label: "Wed" },
                      { value: 4, label: "Thu" },
                      { value: 5, label: "Fri" },
                      { value: 6, label: "Sat" },
                      { value: 0, label: "Sun" },
                    ]}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item label="Repeat for (weeks)">
                  <InputNumber
                    min={1}
                    max={12}
                    value={availabilityForm.repeatWeeks}
                    onChange={(v) =>
                      handleAvailabilityChange("repeatWeeks", v || 1)
                    }
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </>
            )}
            <Form.Item label="Start Time">
              <TimePicker
                style={{ width: "100%" }}
                value={availabilityForm.startTime}
                onChange={(v) => handleAvailabilityChange("startTime", v)}
                format="HH:mm"
              />
            </Form.Item>
            <Form.Item label="End Time">
              <TimePicker
                style={{ width: "100%" }}
                value={availabilityForm.endTime}
                onChange={(v) => handleAvailabilityChange("endTime", v)}
                format="HH:mm"
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" block onClick={handleAddUnavailable}>
                Add Unavailable Time
              </Button>
            </Form.Item>
          </Form>
        </Modal>
        <Modal
          title="Event Details"
          open={isEventDetailsOpen}
          onCancel={() => {
            setIsEventDetailsOpen(false);
            setEventDetails(null);
            setIsEditingStatus(false);
          }}
          footer={null}
          width={400}
          centered
          className="availability-modal"
        >
          {isEditingStatus ? (
            <Form layout="vertical">
              {eventDetails?.isNotAvailable && (
                <>
                  <Form.Item label="Start Time">
                    <DatePicker
                      showTime={{ format: "HH:mm" }}
                      format="DD.MM.YYYY HH:mm"
                      value={dayjs(eventDetails.start)}
                      onChange={(date) => {
                        if (date && eventDetails) {
                          console.log("🕐 Updating start time:", {
                            original: eventDetails.start,
                            new: date.toISOString(),
                            formatted: date.format("YYYY-MM-DDTHH:mm:ss"),
                          });
                          setEventDetails({
                            ...eventDetails,
                            start: date.format("YYYY-MM-DDTHH:mm:ss"),
                          });
                        }
                      }}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Form.Item label="End Time">
                    <DatePicker
                      showTime={{ format: "HH:mm" }}
                      format="DD.MM.YYYY HH:mm"
                      value={eventDetails.end ? dayjs(eventDetails.end) : null}
                      onChange={(date) => {
                        if (date && eventDetails) {
                          console.log("🕐 Updating end time:", {
                            original: eventDetails.end,
                            new: date.toISOString(),
                            formatted: date.format("YYYY-MM-DDTHH:mm:ss"),
                          });
                          setEventDetails({
                            ...eventDetails,
                            end: date.format("YYYY-MM-DDTHH:mm:ss"),
                          });
                        }
                      }}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </>
              )}
              <Form.Item label="Status">
                <Select
                  value={statusValue}
                  onChange={(v) => setStatusValue(v)}
                  options={[
                    { value: "scheduled", label: "Scheduled" },
                    { value: "Given", label: "Given" },
                    { value: "No show student", label: "Student No Show" },
                    { value: "No show teacher", label: "Teacher No Show" },
                    { value: "Cancelled", label: "Cancelled" },
                    { value: "Not Available", label: "Not Available" },
                  ]}
                  style={{ width: "100%" }}
                  disabled={eventDetails?.isNotAvailable}
                />
              </Form.Item>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Button
                  onClick={() => {
                    setIsEditingStatus(false);
                    setStatusValue(
                      mapServerStatus(eventDetails?.class_status || "scheduled")
                    );
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  onClick={() => handleSaveEvent(eventDetails?.id || "")}
                >
                  Save
                </Button>
              </div>
            </Form>
          ) : (
            <>
              <div style={{ fontSize: "16px" }}>
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontWeight: 500, marginBottom: "8px" }}>
                    Start:
                  </div>
                  <div>
                    {eventDetails &&
                      dayjs(eventDetails.start).format("DD.MM.YYYY, HH:mm")}
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontWeight: 500, marginBottom: "8px" }}>
                    End:
                  </div>
                  <div>
                    {eventDetails && eventDetails.end
                      ? dayjs(eventDetails.end).format("DD.MM.YYYY, HH:mm")
                      : "Not specified"}
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontWeight: 500, marginBottom: "8px" }}>
                    Teacher:
                  </div>
                  <div>
                    {eventDetails?.teacher_name || "No teacher assigned"}
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontWeight: 500, marginBottom: "8px" }}>
                    Student:
                  </div>
                  <div>{eventDetails?.student_name_text || "—"}</div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontWeight: 500, marginBottom: "8px" }}>
                    Status:
                  </div>
                  <Select
                    value={statusValue}
                    onChange={(value) => setStatusValue(value)}
                    options={[
                      { value: "scheduled", label: "Scheduled" },
                      { value: "Given", label: "Given" },
                      { value: "No show student", label: "Student No Show" },
                      { value: "No show teacher", label: "Teacher No Show" },
                      { value: "Cancelled", label: "Cancelled" },
                      { value: "Not Available", label: "Not Available" },
                    ]}
                    style={{ width: "100%" }}
                    disabled={eventDetails?.isNotAvailable}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontWeight: 500, marginBottom: "8px" }}>
                    Lesson Type:
                  </div>
                  <div>
                    {eventDetails?.class_type
                      ? classTypes.find(
                          (type) =>
                            type.value.toLowerCase() ===
                            eventDetails.class_type.toLowerCase()
                        )?.label || eventDetails.class_type
                      : "Not specified"}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  alignItems: "center",
                  marginTop: "20px",
                  paddingTop: "20px",
                  borderTop: "1px solid #f0f0f0",
                }}
              >
                <Button
                  key="edit"
                  type="default"
                  icon={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ marginRight: 4 }}
                    >
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  }
                  onClick={() => setIsEditingStatus(true)}
                  style={{
                    fontWeight: 500,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Edit
                </Button>
                <Button
                  key="delete"
                  danger
                  onClick={() => handleDeleteEvent(eventDetails?.id || "")}
                  style={{ fontWeight: 500, borderRadius: 6 }}
                >
                  Delete
                </Button>
                <Button
                  key="save"
                  type="primary"
                  onClick={() => handleSaveEvent(eventDetails?.id || "")}
                  style={{ fontWeight: 500, borderRadius: 6 }}
                >
                  Save
                </Button>
              </div>
            </>
          )}
        </Modal>
        <Modal
          title="Edit Event"
          open={isEditModalOpen}
          onCancel={() => setIsEditModalOpen(false)}
          footer={null}
          width={800}
          destroyOnClose
          maskClosable={false}
          className="create-event-modal"
          style={{ top: 20 }}
        >
          {editEventData && (
            <EventCreateForm
              teachers={teachers}
              onClose={() => setIsEditModalOpen(false)}
              onSuccess={handleUpdateEvent}
              start={
                editEventData.start ? new Date(editEventData.start) : undefined
              }
              end={editEventData.end ? new Date(editEventData.end) : undefined}
              initialTeacherId={String(editEventData.teacherId || "")}
              initialClassType={editEventData.class_type}
              initialClassStatus={statusValue}
              initialEventId={editEventData.id}
              isEditMode={true}
            />
          )}
        </Modal>
      </div>
    </div>
  );
};

export default Calendar;
