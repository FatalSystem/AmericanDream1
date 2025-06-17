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
import CreateEventModal from "./CreateEventModal";
import "./Calendar.css";
import dayjs from "dayjs";
import { useTimezone } from "../../contexts/TimezoneContext";

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
  };
}

type CalendarEvent = CustomEventInput & {
  extendedProps?: {
    teacherId?: string;
    studentId?: string;
    class_status?: string;
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
  const calendarRef = useRef<FullCalendar>(null);

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
      setStudents(
        Array.isArray(response.data.students) ? response.data.students : []
      );
    } catch (error) {
      setStudents([]);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await api.get("/calendar/events");
      let data = response.data;
      // Логування для діагностики
      console.log("EVENTS RESPONSE:", data);
      let eventsArray: any[] = [];
      if (Array.isArray(data)) eventsArray = data;
      else if (Array.isArray(data.events)) eventsArray = data.events;
      else if (data.events && Array.isArray(data.events.rows))
        eventsArray = data.events.rows;
      const formattedEvents: CustomEventInput[] = eventsArray.map(
        (event: any) => {
          const startDate = dayjs(event.startDate || event.start).tz(timezone);
          const endDate = dayjs(event.endDate || event.end).tz(timezone);
          return {
            id: String(event.id),
            title: event.name || event.title || "",
            start: startDate.isValid() ? startDate.format() : "",
            end: endDate.isValid() ? endDate.format() : "",
            allDay: false,
            backgroundColor: event.eventColor || event.teacherColor,
            teacherId: String(
              event.teacherId || event.teacher_id || event.resourceId || ""
            ),
            extendedProps: {
              teacherId: String(
                event.teacherId || event.teacher_id || event.resourceId || ""
              ),
              class_status: event.class_status || "scheduled",
            },
          };
        }
      );
      setEvents(formattedEvents);
      setDisplayedEvents(formattedEvents);
    } catch (error) {
      setEvents([]);
      setDisplayedEvents([]);
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
    fetchStudents();
    fetchEvents();
  }, [timezone]);

  // Filter events by selected teachers
  useEffect(() => {
    if (selectedTeacherIds.length > 0) {
      setDisplayedEvents(
        events.filter((e) => selectedTeacherIds.includes(Number(e.teacherId)))
      );
    } else {
      setDisplayedEvents(events);
    }
  }, [selectedTeacherIds, events]);

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
        const response = await api.post("/calendar/events", {
          teacher_id: eventForm.teacherId,
          start_date: start,
          end_date: end,
          class_status: "scheduled",
        });
        return response.data;
      };

      if (eventForm.repeating.type === "none") {
        await createSingleEvent(eventForm.start, eventForm.end);
      } else {
        const startDate = dayjs(eventForm.start);
        const endDate = dayjs(eventForm.end);
        const duration = endDate.diff(startDate, "minute");

        for (let week = 0; week < eventForm.repeating.weeks; week++) {
          for (const day of eventForm.repeating.days) {
            const currentDate = startDate.add(week, "week").day(day);
            const currentEndDate = currentDate.add(duration, "minute");

            await createSingleEvent(
              currentDate.format("YYYY-MM-DDTHH:mm:ss"),
              currentEndDate.format("YYYY-MM-DDTHH:mm:ss")
            );
          }
        }
      }

      message.success("Event(s) created successfully");
      setIsCreateModalOpen(false);
      fetchEvents();
    } catch (error) {
      console.error("Error creating event:", error);
      message.error("Failed to create event");
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    setSelectedDate(selectInfo.start);
    setIsCreateModalOpen(true);
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

  // Оновимо функцію рендерингу подій
  const renderEventContent = (eventInfo: any) => {
    const event = eventInfo.event;
    const isNotAvailable =
      event.title?.includes("Not Available") || event.title?.includes("Not A");

    // Базовий колір для різних статусів
    let backgroundColor = event.backgroundColor || "#3788d8";
    if (isNotAvailable) {
      backgroundColor = "#E57373"; // червоний для недоступних
    }

    // Форматуємо час
    const startTime = dayjs(event.start).format("HH:mm");
    const endTime = dayjs(event.end).format("HH:mm");

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(135deg, ${backgroundColor}, ${backgroundColor}ee)`,
          borderRadius: "8px",
          padding: "8px 10px",
          overflow: "hidden",
          color: "#FFFFFF",
          fontSize: "13px",
          lineHeight: "1.4",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          boxShadow:
            "0 2px 4px rgba(0,0,0,0.1), inset 0 1px rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontWeight: "600",
            fontSize: "14px",
            letterSpacing: "-0.3px",
          }}
        >
          {event.title}
        </div>
        <div
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            opacity: "0.9",
            fontSize: "12px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ opacity: 0.7 }}
          >
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z" />
          </svg>
          {startTime} - {endTime}
        </div>
      </div>
    );
  };

  const handleAvailabilityChange = (field: string, value: any) => {
    setAvailabilityForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddUnavailable = () => {
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
    const start = `${dateStr}T${startStr}`;
    const end = `${dateStr}T${endStr}`;

    const newEvent: CustomEventInput = {
      id: `unavailable-${Date.now()}`,
      title: "Unavailable",
      start,
      end,
      allDay: false,
      description: "Unavailable time",
      backgroundColor: "#ff4d4f",
      resourceId: String(availabilityForm.teacherId),
      teacherId: String(availabilityForm.teacherId),
      extendedProps: {
        teacherId: String(availabilityForm.teacherId),
        class_status: "scheduled",
      },
    };

    setEvents((prev) => [...prev, newEvent]);
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
    message.success("Unavailable time added to calendar");
  };

  const handleEventClick = (info: EventClickArg) => {
    console.log("Event clicked:", info.event);
    const event = info.event;
    const eventData = event.extendedProps;
    setEventDetails({
      id: event.id,
      title: event.title || "",
      start: event.start?.toISOString() || "",
      end: event.end?.toISOString() || "",
      teacherId: eventData.teacherId,
      class_status: eventData.class_status,
      isNotAvailable:
        event.title?.includes("Not Available") ||
        event.title?.includes("Not A"),
      rawEvent: event,
    });
    setIsEventDetailsOpen(true);
  };

  const handleSaveEvent = async (eventId: string) => {
    if (eventDetails?.isNotAvailable) {
      message.error("Cannot modify lessons marked as Not Available");
      return;
    }

    try {
      const response = await api.put(`/calendar/events/${eventId}`, {
        class_status: statusValue,
      });

      if (response.data) {
        message.success("Event updated successfully");
        setEventDetails(null);
        setIsEventDetailsOpen(false);
        fetchEvents();
      }
    } catch (error) {
      console.error("Error updating event:", error);
      message.error("Failed to update event");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (eventDetails?.isNotAvailable) {
      message.error("Cannot delete lessons marked as Not Available");
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
    { value: "Trial Lesson", label: "Trial Lesson" },
    { value: "Instant Lesson", label: "Instant Lesson" },
    { value: "Unavailable", label: "Unavailable" },
    { value: "Speaking Club", label: "Speaking Club" },
  ];

  const durationOptions = [
    { value: "30 min", label: "30 minutes" },
    { value: "50 min", label: "50 minutes" },
    { value: "80 min", label: "80 minutes" },
  ];

  const getFilteredStudents = (searchText: string) => {
    if (!Array.isArray(students)) return [];
    return students.filter((student) =>
      `${student.first_name} ${student.last_name}`
        .toLowerCase()
        .includes(searchText.toLowerCase())
    );
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

  // Додамо логування при зміні view
  const handleViewChange = (view: any) => {
    console.log("View changed to:", view);
    console.log("Current calendar api:", calendarRef.current?.getApi());
    // Перезавантажимо події при зміні виду
    fetchEvents();
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
        <div className="calendar-header">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalOpen(true)}
            style={{ marginRight: 12 }}
          >
            Create Event
          </Button>
          <Button
            type="default"
            onClick={() => setIsAvailabilityModalOpen(true)}
          >
            Availability
          </Button>
        </div>
        <div
          className="calendar-wrapper"
          style={{
            background: "#1a1f2e",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "none",
          }}
        >
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            initialView="timeGridWeek"
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            events={displayedEvents}
            eventClick={handleEventClick}
            select={handleDateSelect}
            eventContent={renderEventContent}
            viewDidMount={handleViewChange}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            allDaySlot={false}
            slotDuration="00:30:00"
            height={window.innerHeight - 200}
            eventDisplay="block"
            eventOverlap={false}
            slotEventOverlap={false}
            timeZone={timezone}
            views={{
              timeGridWeek: {
                titleFormat: {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                },
                slotLabelFormat: {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                },
                slotMinWidth: 100,
              },
              timeGridDay: {
                titleFormat: {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                },
                slotLabelFormat: {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                },
                slotMinWidth: 100,
              },
            }}
            eventTimeFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            datesSet={fetchEvents}
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
                  { value: "cancelled", label: "Cancelled" },
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
          footer={[
            <Button
              key="delete"
              danger
              onClick={() => handleDeleteEvent(eventDetails?.id || "")}
            >
              Delete
            </Button>,
            <Button
              key="save"
              type="primary"
              onClick={() => handleSaveEvent(eventDetails?.id || "")}
            >
              Save
            </Button>,
          ]}
          width={400}
          centered
          className="availability-modal"
        >
          <div style={{ fontSize: "16px" }}>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontWeight: 500, marginBottom: "8px" }}>Start:</div>
              <div>
                {eventDetails &&
                  dayjs(eventDetails.start)
                    .tz(timezone)
                    .format("DD.MM.YYYY, HH:mm")}
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontWeight: 500, marginBottom: "8px" }}>End:</div>
              <div>
                {eventDetails &&
                  dayjs(eventDetails.end)
                    .tz(timezone)
                    .format("DD.MM.YYYY, HH:mm")}
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontWeight: 500, marginBottom: "8px" }}>
                Teacher:
              </div>
              <div>
                {(() => {
                  if (!eventDetails) return "";
                  const teacherId = Number(eventDetails.teacherId);
                  const teacher = teachers.find((t) => t.id === teacherId);
                  return teacher
                    ? `${teacher.first_name} ${teacher.last_name}`
                    : "No teacher assigned";
                })()}
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontWeight: 500, marginBottom: "8px" }}>
                Student:
              </div>
              <div>
                {(() => {
                  if (!eventDetails) return "";
                  console.log("Full event details:", eventDetails);

                  // Спробуємо знайти студента за title події або за groupId
                  const eventTitle = eventDetails.rawEvent?.title || "";
                  const groupId = eventDetails.rawEvent?._def?.groupId;

                  console.log("Event title:", eventTitle);
                  console.log("Group ID:", groupId);

                  // Якщо є пряме ім'я студента в даних події, використовуємо його
                  if (eventDetails.student_name_text) {
                    return eventDetails.student_name_text;
                  }

                  // Якщо є title, можливо там є ім'я студента
                  if (eventTitle && eventTitle !== "regular") {
                    return eventTitle;
                  }

                  return "No student assigned";
                })()}
              </div>
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
                  { value: "cancelled", label: "Cancelled" },
                ]}
                style={{ width: "100%" }}
                disabled={eventDetails?.isNotAvailable}
              />
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default Calendar;
