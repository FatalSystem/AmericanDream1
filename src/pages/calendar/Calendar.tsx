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
  studentId?: string;
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
  extendedProps?: {
    teacherId?: string;
    studentId?: string;
    class_status?: string;
    class_type?: string;
  };
}

type CalendarEvent = CustomEventInput & {
  extendedProps?: {
    teacherId?: string;
    studentId?: string;
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
  repeating: {
    type: "none" | "weekly";
    days: number[];
    weeks: number;
  };
}

const classTypes = [
  { value: "trial", label: "Trial Lesson", duration: 30 },
  { value: "regular", label: "Regular Lesson", duration: 50 },
  { value: "instant", label: "Instant Lesson", duration: 50 },
  { value: "group", label: "Group Lesson", duration: 50 },
  { value: "training", label: "Training", duration: 50, adminOnly: true },
];

const convertToTimezone = (dateStr: string, targetTimezone: string): string => {
  try {
    // If the date is already in ISO format with timezone info
    if (
      dateStr.includes("Z") ||
      (dateStr.includes("T") && dateStr.includes("+"))
    ) {
      return dayjs(dateStr).tz(targetTimezone).format();
    }

    // If it's a plain datetime, assume it's in DB timezone
    return dayjs.tz(dateStr, DEFAULT_DB_TIMEZONE).tz(targetTimezone).format();
  } catch (error) {
    console.error("Error converting timezone:", error);
    return dateStr;
  }
};

const checkLessonOverlap = async (
  teacherId: number,
  startDate: string,
  endDate: string
): Promise<boolean> => {
  try {
    // Convert dates to the DB timezone for comparison
    const start = dayjs(startDate).tz(DEFAULT_DB_TIMEZONE);
    const end = dayjs(endDate).tz(DEFAULT_DB_TIMEZONE);

    // Add 5 minutes buffer
    const startWithBuffer = start.subtract(5, "minute");
    const endWithBuffer = end.add(5, "minute");

    console.log("Checking overlap for:", {
      teacherId,
      start: start.format(),
      end: end.format(),
      startWithBuffer: startWithBuffer.format(),
      endWithBuffer: endWithBuffer.format(),
    });

    // Get all events for this teacher
    const response = await api.get("/calendar/events", {
      params: {
        teacherId: teacherId,
        start: startWithBuffer.format(),
        end: endWithBuffer.format(),
      },
    });

    const existingEvents = Array.isArray(response.data)
      ? response.data
      : response.data.events?.rows || [];

    // Filter out cancelled events and the current event being edited
    const activeEvents = existingEvents.filter(
      (event: any) =>
        event.class_status !== "cancelled" && event.teacher_id === teacherId
    );

    console.log("Existing active events:", activeEvents);

    // Check for overlaps
    for (const event of activeEvents) {
      const eventStart = dayjs(event.startDate).tz(DEFAULT_DB_TIMEZONE);
      const eventEnd = dayjs(event.endDate).tz(DEFAULT_DB_TIMEZONE);

      // Check if events overlap (including buffer)
      if (
        (start.isBefore(eventEnd) && end.isAfter(eventStart)) ||
        (startWithBuffer.isBefore(eventEnd) &&
          endWithBuffer.isAfter(eventStart))
      ) {
        console.log("Found overlap with event:", {
          existingEvent: event,
          overlap: {
            start: start.format(),
            end: end.format(),
            eventStart: eventStart.format(),
            eventEnd: eventEnd.format(),
          },
        });
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking lesson overlap:", error);
    throw error;
  }
};

const checkExactTimeSlot = async (startDate: string): Promise<boolean> => {
  try {
    // Convert to DB timezone for comparison
    const start = dayjs(startDate).tz(DEFAULT_DB_TIMEZONE).format();

    console.log("Checking if time slot exists:", start);

    // Get all events
    const response = await api.get("/calendar/events");
    const existingEvents = Array.isArray(response.data)
      ? response.data
      : response.data.events?.rows || [];

    // Check if any event starts at exactly the same time
    const hasExactMatch = existingEvents.some((event: any) => {
      const eventStart = dayjs(event.startDate)
        .tz(DEFAULT_DB_TIMEZONE)
        .format();
      return eventStart === start;
    });

    if (hasExactMatch) {
      console.log("Found exact time match");
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking time slot:", error);
    throw error;
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
    classType: "Regular Lesson",
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
      setLoading(true);

      const startDate = dayjs(view.activeStart)
        .tz(DEFAULT_DB_TIMEZONE)
        .format();
      const endDate = dayjs(view.activeEnd).tz(DEFAULT_DB_TIMEZONE).format();

      console.log("Fetch period:", { startDate, endDate });

      const response = await api.get("/calendar/events", {
        params: {
          start: startDate,
          end: endDate,
          teacherId: selectedTeacherIds.join(","),
        },
      });

      console.log("Successfully fetched events:", response.data);

      let eventsArray = Array.isArray(response.data)
        ? response.data
        : response.data.events?.rows || [];

      // Let the backend handle reserved class checks
      console.log("Checking for expired reserved classes...");
      await api.get("/calendar/check-reserved");

      const events = eventsArray.map((event: any) => {
        let title = event.name || event.title || "";

        // Handle trial lessons
        if (
          event.class_type === "trial" ||
          event.class_type === "trial lesson"
        ) {
          title = `Trial - ${title}`;
          console.log("Marked as trial lesson:", title);
        }

        // Handle reserved lessons
        if (event.payment_status === "reserved") {
          title = `RSVR - ${title}`;
          console.log("Marked as reserved lesson:", title);
        }

        const teacherId =
          event.teacherId || event.teacher_id || event.resourceId;

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

        // Log timezone conversions for debugging
        console.log("Event timezone conversion:", {
          eventId: event.id,
          title: title,
          originalStart: event.startDate,
          utcStart: utcStart.format(),
          tzStart: tzStart.format(),
          hoursUntilStart,
        });

        return {
          id: String(event.id),
          title: title,
          start: tzStart.format("YYYY-MM-DDTHH:mm:ss"),
          end: finalEnd.format("YYYY-MM-DDTHH:mm:ss"),
          allDay: false,
          backgroundColor: event.eventColor || event.teacherColor,
          teacherId: teacherId,
          extendedProps: {
            teacherId: teacherId,
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
          },
        };
      });

      console.log("Processed events:", events.length);
      setEvents(events);

      if (selectedTeacherIds.length > 0) {
        console.log("Filtering events for teachers:", selectedTeacherIds);
        const filteredEvents = events.filter((event) => {
          const eventTeacherId = Number(
            event.teacherId || event.extendedProps?.teacherId
          );
          return selectedTeacherIds.includes(eventTeacherId);
        });
        console.log("Filtered events:", filteredEvents.length);
        setDisplayedEvents(filteredEvents);
      } else {
        setDisplayedEvents(events);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
      message.error("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  };

  const checkReservedClasses = async () => {
    try {
      // Get current time once to ensure consistent comparisons
      const now = dayjs();

      // Get all reserved events
      const reservedEvents = events.filter(
        (event) =>
          (event.extendedProps as EventExtendedProps)?.payment_status ===
          "reserved"
      );

      // Find events that need to be deleted (less than 12 hours until start)
      const eventsToDelete = reservedEvents.filter((event) => {
        const startTime = dayjs(event.start);
        const hoursUntilStart = startTime.diff(now, "hour");
        return hoursUntilStart < 12;
      });

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
            hoursUntilStart: dayjs(event.start).diff(now, "hour"),
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
    fetchTeachers();
    fetchStudents();
    fetchEvents();
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

      const createSingleEvent = async (start: string, end: string) => {
        // Check if exact time slot exists
        const timeSlotTaken = await checkExactTimeSlot(start);
        if (timeSlotTaken) {
          throw new Error("This exact time slot is already taken");
        }

        const eventData = {
          class_type: eventForm.classType,
          student_id: eventForm.studentId,
          teacher_id: eventForm.teacherId,
          class_status: eventForm.status,
          payment_status: "reserved",
          startDate: dayjs(start).tz(DEFAULT_DB_TIMEZONE).format(),
          endDate: dayjs(end).tz(DEFAULT_DB_TIMEZONE).format(),
          duration:
            eventForm.classType === "Trial Lesson"
              ? 30
              : dayjs(end).diff(dayjs(start), "minute"),
        };

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
          const timeSlotTaken = await checkExactTimeSlot(slot.start.format());
          if (timeSlotTaken) {
            throw new Error(
              `Time slot ${slot.start.format(
                "DD.MM.YYYY HH:mm"
              )} is already taken`
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
      fetchEvents();
    } catch (error: any) {
      console.error("Error creating event:", error);
      message.error(error.message || "Failed to create event");
    }
  };

  const handleDateSelect = async (selectInfo: any) => {
    const startTime = dayjs(selectInfo.start);
    const hoursUntilStart = startTime.diff(dayjs(), "hour");

    try {
      // Check if trying to create event less than 12 hours in advance
      if (hoursUntilStart < 12) {
        message.error("Cannot create classes less than 12 hours in advance");
        return;
      }

      // If a teacher is already selected in the form, check for overlaps
      if (eventForm.teacherId) {
        const hasOverlap = await checkLessonOverlap(
          eventForm.teacherId,
          selectInfo.start,
          selectInfo.end
        );

        if (hasOverlap) {
          message.error("This time slot is already taken");
          return;
        }
      }

      // Check student's remaining classes
      if (eventForm.studentId) {
        const response = await api.get(
          `/students/${eventForm.studentId}/remaining-classes`
        );
        const remainingClasses = response.data.remainingClasses || 0;

        if (remainingClasses <= 0) {
          message.warning(
            "This class will be marked as reserved due to insufficient paid classes"
          );
        }

        setEventForm((prev) => ({
          ...prev,
          start: selectInfo.start,
          end: selectInfo.end,
          payment_status: remainingClasses <= 0 ? "reserved" : "paid",
        }));
      } else {
        setEventForm((prev) => ({
          ...prev,
          start: selectInfo.start,
          end: selectInfo.end,
        }));
      }

      setIsCreateModalOpen(true);
    } catch (error) {
      console.error("Error during class creation:", error);
      message.error("Failed to create class");
    }
  };

  const handleCreateButtonClick = () => {
    console.log("Create button clicked");
    console.log("Current modal state:", isCreateModalOpen);
    setIsCreateModalOpen(true);
    console.log("Modal state after setState:", true);
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

    // Format time in selected timezone
    const startTime = dayjs(event.start).format("HH:mm");
    const endTime = dayjs(event.end).format("HH:mm");

    const isNotAvailable = isUnavailableEvent(event);

    // Remove prefixes for display
    const studentName = event.title
      .replace(/^Trial\s*-\s*/gi, "")
      .replace(/^RSVR\s*-\s*/gi, "")
      .replace(/^Not Available\s*-\s*/gi, "")
      .trim();

    const classTypeDisplay =
      classTypes.find((type) => type.value === classType)?.label || classType;

    let backgroundColor;
    if (isNotAvailable) {
      backgroundColor = "#d32f2f";
    } else {
      switch (classType.toLowerCase()) {
        case "trial":
        case "trial lesson":
          backgroundColor = "#ff9800";
          break;
        case "regular":
        case "regular lesson":
          backgroundColor = "#2196f3";
          break;
        case "instant":
        case "instant lesson":
          backgroundColor = "#4caf50";
          break;
        case "group":
        case "group lesson":
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
          padding: "4px 6px",
          backgroundColor,
          height: "100%",
          minHeight: "50px",
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
              fontSize: "11px",
              fontWeight: "600",
              color: textColor,
              lineHeight: "1.2",
              marginBottom: "2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {isNotAvailable ? "Unavailable" : classTypeDisplay}
            {paymentStatus === "reserved" && " (Reserved)"}
          </div>
          {!isNotAvailable && studentName && (
            <div
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: textColor,
                lineHeight: "1.2",
                marginBottom: "2px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {studentName}
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: "500",
            color: textColor,
            lineHeight: "1.2",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            opacity: 0.9,
          }}
        >
          {startTime} - {endTime}
        </div>
      </div>
    );
  };

  const handleAvailabilityChange = (field: string, value: any) => {
    setAvailabilityForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddUnavailable = async () => {
    if (
      !availabilityForm.teacherId ||
      !availabilityForm.date ||
      !availabilityForm.startTime ||
      !availabilityForm.endTime
    ) {
      message.error("Please fill in all fields");
      return;
    }

    const dateStr = availabilityForm.date.format("YYYY-MM-DD");
    const startStr = availabilityForm.startTime.format("HH:mm");
    const endStr = availabilityForm.endTime.format("HH:mm");
    // Use dayjs.tz to create correct datetime in selected timezone
    const start = dayjs.tz(`${dateStr}T${startStr}`, timezone).toISOString();
    const end = dayjs.tz(`${dateStr}T${endStr}`, timezone).toISOString();

    try {
      // Send to backend
      const eventData = {
        class_type: "unavailable",
        student_id: 0,
        teacher_id: availabilityForm.teacherId,
        class_status: "scheduled",
        payment_status: "reserved",
        startDate: start,
        endDate: end,
        duration: dayjs(end).diff(dayjs(start), "minute"),
        isUnavailable: true,
        title: "Unavailable",
      };
      await api.post("/calendar/events", {
        events: {
          added: [eventData],
        },
      });
      message.success("Unavailable time added to calendar");
      setIsAvailabilityModalOpen(false);
      setAvailabilityForm({
        teacherId: null,
        date: null,
        repeat: false,
        startTime: null,
        endTime: null,
        repeatDays: [],
        repeatWeeks: 1,
      });
      fetchEvents();
    } catch (error) {
      message.error("Failed to save unavailable time");
    }
  };

  // Update event handlers to handle unavailable events
  const handleEventDrop = async (dropInfo: any) => {
    const event = dropInfo.event;

    if (isUnavailableEvent(event)) {
      dropInfo.revert();
      message.error("Cannot modify unavailable time slots");
      return;
    }

    try {
      const startDate = dayjs(event.start).tz(DEFAULT_DB_TIMEZONE).format();

      // Check if exact time slot exists
      const timeSlotTaken = await checkExactTimeSlot(startDate);
      if (timeSlotTaken) {
        dropInfo.revert();
        message.error("This time slot is already taken");
        return;
      }

      const endDate = dayjs(event.end).tz(DEFAULT_DB_TIMEZONE).format();
      await calendarApi.updateCalendar(event.id, {
        startDate,
        endDate,
      });

      message.success("Event updated successfully");
      fetchEvents();
    } catch (error) {
      console.error("Error updating event:", error);
      message.error("Failed to update event");
      dropInfo.revert();
    }
  };

  const handleEventResize = async (resizeInfo: any) => {
    const event = resizeInfo.event;

    if (isUnavailableEvent(event)) {
      resizeInfo.revert();
      message.error("Cannot modify unavailable time slots");
      return;
    }

    try {
      const startDate = dayjs(event.start).tz(DEFAULT_DB_TIMEZONE).format();

      // Check if exact time slot exists
      const timeSlotTaken = await checkExactTimeSlot(startDate);
      if (timeSlotTaken) {
        resizeInfo.revert();
        message.error("This time slot is already taken");
        return;
      }

      const endDate = dayjs(event.end).tz(DEFAULT_DB_TIMEZONE).format();
      await calendarApi.updateCalendar(event.id, {
        startDate,
        endDate,
      });

      message.success("Event updated successfully");
      fetchEvents();
    } catch (error) {
      console.error("Error updating event:", error);
      message.error("Failed to update event");
      resizeInfo.revert();
    }
  };

  // Update event click handler to handle unavailable events
  const handleEventClick = (clickInfo: any) => {
    const event = clickInfo.event;
    const isNotAvailable = isUnavailableEvent(event);
    const teacherId = event.extendedProps?.teacherId || event.teacherId;
    const teacher = teachers.find((t) => String(t.id) === String(teacherId));
    const classType = event.extendedProps?.class_type || "";

    setEventDetails({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end || dayjs(event.start).add(1, "hour").toDate(),
      teacherId: teacherId,
      class_type: classType,
      isNotAvailable: isNotAvailable,
      teacher_name: teacher
        ? `${teacher.first_name} ${teacher.last_name}`
        : undefined,
      student_name_text: event.title
        .replace(
          /^(Trial|Regular|Instant|Group|Trial Lesson|Regular Lesson|Instant Lesson|Group Lesson)\s*-\s*/gi,
          ""
        )
        .replace(/^RSVR\s*-\s*/gi, "")
        .replace(/^Not Available\s*-\s*/gi, "")
        .trim(),
    });

    setStatusValue(event.extendedProps?.class_status || "scheduled");
    setIsEventDetailsOpen(true);
  };

  const handleSaveEvent = async (eventId: string) => {
    if (eventDetails?.isNotAvailable) {
      message.error("Cannot modify unavailable time slots");
      return;
    }

    try {
      await calendarApi.updateCalendar(eventId, {
        class_status: statusValue,
      });

      message.success("Event updated successfully");
      setEventDetails(null);
      setIsEventDetailsOpen(false);
      fetchEvents();
    } catch (error) {
      console.error("Error updating event:", error);
      message.error("Failed to update event");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (eventDetails?.isNotAvailable) {
      message.error("Cannot delete unavailable time slots");
      return;
    }

    try {
      const response = await api.delete(`/calendar/events/${eventId}`);

      if (response.data) {
        message.success("Event deleted successfully");
        setEventDetails(null);
        setIsEventDetailsOpen(false);
        fetchEvents();
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      message.error("Failed to delete event");
    }
  };

  const classTypeOptions = [
    { value: "Regular Lesson", label: "Regular Lesson" },
    { value: "Unavailable Lesson", label: "Unavailable Lesson" },
    { value: "Training Lesson", label: "Training Lesson" },
    { value: "Trial Lesson", label: "Trial Lesson" },
    { value: "Instant Lesson", label: "Instant Lesson" },
    { value: "Group Lesson", label: "Group Lesson" },
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
    setEditEventData(eventDetails);
    setIsEditModalOpen(true);
    setIsEventDetailsOpen(false);
  };

  // Додаю функцію для збереження редагованої події
  const handleUpdateEvent = async (updatedData: any) => {
    try {
      await api.put(`/calendar/events/${updatedData.id}`, updatedData);
      setIsEditModalOpen(false);
      setEditEventData(null);
      fetchEvents();
      message.success("Event updated successfully");
    } catch (error) {
      message.error("Failed to update event");
    }
  };

  // Add test function for creating a reserved class
  const createTestReservedClass = async () => {
    try {
      // Create a class that starts in 13 hours (will be deleted in ~1 hour)
      const startTime = dayjs().add(13, "hours");
      const endTime = startTime.add(50, "minutes");

      const testEvent = {
        title: "Test Student",
        start: startTime.format(),
        end: endTime.format(),
        payment_status: "reserved",
        class_type: "regular",
        teacherId: selectedTeacherIds[0], // Use first selected teacher
        studentId: "test_student",
      };

      // Create the event
      const response = await api.post("/calendar/events", testEvent);

      if (response.data) {
        message.success(
          "Created test reserved class. It will be automatically removed in about 1 hour"
        );
        console.log("Created test class:", {
          ...testEvent,
          hoursUntilStart: 13,
          willBeDeletedIn: 1,
        });

        // Refresh calendar to show new event
        fetchEvents();
      }
    } catch (error) {
      console.error("Failed to create test class:", error);
      message.error("Failed to create test class");
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
          }}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalOpen(true)}
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
          onCancel={() => setIsCreateModalOpen(false)}
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
                  if (v === "Unavailable Lesson") {
                    setIsCreateModalOpen(false);
                    setIsAvailabilityModalOpen(true);
                    return;
                  }
                  setEventForm((prev) => ({
                    ...prev,
                    classType: v,
                    duration: v === "Trial Lesson" ? "30 min" : prev.duration,
                  }));
                }}
                options={classTypeOptions}
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item label="Teacher" style={formItemStyle}>
              <Select
                value={eventForm.teacherId}
                onChange={(v) =>
                  setEventForm((prev) => ({ ...prev, teacherId: v }))
                }
                options={teachers.map((t) => ({
                  value: t.id,
                  label: `${t.first_name} ${t.last_name}`,
                }))}
                placeholder="Select teacher"
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item label="Student" style={formItemStyle}>
              <Select
                showSearch
                value={eventForm.studentId}
                onChange={(v) =>
                  setEventForm((prev) => ({ ...prev, studentId: v }))
                }
                onSearch={(value) => setStudentSearch(value)}
                filterOption={false}
                options={getFilteredStudents(studentSearch).map((s) => ({
                  value: s.id,
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
                disabled={eventForm.classType === "Trial Lesson"}
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
                  ...([
                    "manager",
                    "accountant",
                    "administrator",
                    "super_admin",
                  ].includes(getUserRole())
                    ? [{ value: "teacher_no_show", label: "Teacher not show" }]
                    : []),
                ]}
                style={{ width: "100%" }}
              />
            </Form.Item>

            <Form.Item label="Start Time" style={formItemStyle}>
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm"
                value={eventForm.start ? dayjs(eventForm.start) : null}
                onChange={(v) => {
                  if (v) {
                    const duration =
                      eventForm.classType === "Trial Lesson"
                        ? 30
                        : parseInt(eventForm.duration);
                    const end = v.add(duration, "minute");
                    setEventForm((prev) => ({
                      ...prev,
                      start: v.format("YYYY-MM-DDTHH:mm:ss"),
                      end: end.format("YYYY-MM-DDTHH:mm:ss"),
                    }));
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
          onCancel={() => setIsEventDetailsOpen(false)}
          footer={null}
          width={400}
          centered
          className="availability-modal"
        >
          {isEditingStatus ? (
            <Form layout="vertical">
              <Form.Item label="Start Time">
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  value={eventDetails?.start ? dayjs(eventDetails.start) : null}
                  onChange={(v) => {
                    if (v && eventDetails) {
                      setEventDetails({
                        ...eventDetails,
                        start: v.toISOString(),
                      });
                    }
                  }}
                  style={{ width: "100%" }}
                  disabled={eventDetails?.isNotAvailable}
                />
              </Form.Item>
              <Form.Item label="End Time">
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  value={eventDetails?.end ? dayjs(eventDetails.end) : null}
                  onChange={(v) => {
                    if (v && eventDetails) {
                      setEventDetails({
                        ...eventDetails,
                        end: v.toISOString(),
                      });
                    }
                  }}
                  style={{ width: "100%" }}
                  disabled={eventDetails?.isNotAvailable}
                />
              </Form.Item>
              <Form.Item label="Teacher">
                <Select
                  value={eventDetails?.teacherId}
                  options={teachers.map((t) => ({
                    value: t.id,
                    label: `${t.first_name} ${t.last_name}`,
                  }))}
                  onChange={(v) =>
                    setEventDetails(
                      eventDetails
                        ? { ...eventDetails, teacherId: v }
                        : eventDetails
                    )
                  }
                  style={{ width: "100%" }}
                  disabled={eventDetails?.isNotAvailable}
                />
              </Form.Item>
              <Form.Item label="Status">
                <Select
                  value={eventDetails?.class_status}
                  onChange={(v) =>
                    setEventDetails(
                      eventDetails
                        ? { ...eventDetails, class_status: v }
                        : eventDetails
                    )
                  }
                  options={[
                    { value: "scheduled", label: "Scheduled" },
                    { value: "given", label: "Given" },
                    { value: "student_no_show", label: "Student No Show" },
                    { value: "cancelled", label: "Cancelled" },
                    { value: "teacher_no_show", label: "Teacher not show" },
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
                <Button onClick={() => setIsEditingStatus(false)}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  onClick={async () => {
                    if (!eventDetails || eventDetails.isNotAvailable) return;

                    try {
                      await api.put(`/calendar/events/${eventDetails.id}`, {
                        startDate: eventDetails.start,
                        endDate: eventDetails.end,
                        teacher_id: eventDetails.teacherId,
                        class_status: eventDetails.class_status,
                      });
                      setIsEditingStatus(false);
                      fetchEvents();
                      message.success("Event updated successfully");
                    } catch (error) {
                      console.error("Error updating event:", error);
                      message.error("Failed to update event");
                    }
                  }}
                  disabled={eventDetails?.isNotAvailable}
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
                      { value: "given", label: "Given" },
                      { value: "student_no_show", label: "Student No Show" },
                      { value: "teacher_no_show", label: "Teacher No Show" },
                      { value: "cancelled", label: "Cancelled" },
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
                  disabled={eventDetails?.isNotAvailable}
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
              // Додати інші потрібні пропси для передачі даних у форму
            />
          )}
        </Modal>
      </div>
    </div>
  );
};

export default Calendar;
