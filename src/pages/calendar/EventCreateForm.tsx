import { useState, useRef, useEffect } from "react";
import { calendarApi } from "../../api/calendar";
import React from "react";
import "./EventCreateForm.css";
import { TeacherWithColor } from "../../store/CalendarContext";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
import dayjs from "dayjs";

export type LessonStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "student_no_show"
  | "teacher_no_show";

type PaymentStatus = "paid" | "reserved";

interface Student {
  id: number;
  first_name: string;
  last_name: string;
}

interface EventCreateFormProps {
  teachers: TeacherWithColor[];
  onClose: () => void;
  onSuccess?: (eventData: any) => void;
  timezone?: string;
  start?: Date | null;
  end?: Date | null;
  initialTeacherId?: string;
  initialClassType?: string;
  initialClassStatus?: string;
  initialEventId?: string;
  isEditMode: boolean;
  editEventData?: any;
}

const classTypes = [
  { value: "Trial-Lesson", label: "Trial Lesson ", duration: 30 },
  { value: "Regular-Lesson", label: "Regular Lesson", duration: 50 },
  { value: "Training-Lesson", label: "Training Lesson", duration: 50 },
  {
    value: "Unavailable-Lesson",
    label: "Unavailable",
    duration: 50,
    noStudent: true,
  },
  { value: "Group-Lesson", label: "Group", duration: 50 },
  { value: "Makeup-Lesson", label: "Makeup", duration: 50 },
  {
    value: "Speaking-Club",
    label: "Speaking Club",
    duration: 50,
    isGroup: true,
  },
  { value: "Holiday", label: "Holiday", duration: 480, noStudent: true }, // 8 hours
  { value: "Sick-Leave", label: "Sick Leave", duration: 480, noStudent: true }, // 8 hours
  {
    value: "Technical-Break",
    label: "Technical Break",
    duration: 30,
    noStudent: true,
  },
];

console.log("Available class types:", classTypes);

const durations = [30, 50, 80];

const weekDays = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

// Mock students and groups
const mockGroups = [
  { id: 1, name: "Group A" },
  { id: 2, name: "Group B" },
  { id: 3, name: "Group C" },
];

// Add a helper to format date in European style
function formatDateTimeEU(dt: string) {
  if (!dt) return "";
  try {
    return DateTime.fromISO(dt).toFormat("dd.MM.yyyy, HH:mm");
  } catch {
    return dt;
  }
}

// Додаю визначення timezone користувача
const getDefaultTimezone = () => {
  if (typeof window !== "undefined" && Intl && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv";
  }
  return "Europe/Kyiv";
};

// Add function to format time for display
const formatTime = (date: string, timezone: string): string => {
  return DateTime.fromISO(date, { zone: timezone }).toFormat("HH:mm");
};

// Add function to check if events overlap with buffer time
const doEventsOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string,
  timezone: string
) => {
  const BUFFER_MINUTES = 5; // Buffer time between lessons

  const s1 = DateTime.fromISO(start1, { zone: timezone });
  const e1 = DateTime.fromISO(end1, { zone: timezone });
  const s2 = DateTime.fromISO(start2, { zone: timezone });
  const e2 = DateTime.fromISO(end2, { zone: timezone });

  // Add buffer to event times
  const e1WithBuffer = e1.plus({ minutes: BUFFER_MINUTES });
  const s1WithBuffer = s1.minus({ minutes: BUFFER_MINUTES });
  const e2WithBuffer = e2.plus({ minutes: BUFFER_MINUTES });
  const s2WithBuffer = s2.minus({ minutes: BUFFER_MINUTES });

  // Check if events are on the same day
  const isSameDay = s1.hasSame(s2, "day");

  // If not same day, no overlap
  if (!isSameDay) return false;

  // Check time overlap including buffer
  return s1WithBuffer < e2WithBuffer && e1WithBuffer > s2WithBuffer;
};

// Add function to check if new event overlaps with existing events
const checkEventOverlap = async (
  teacherId: string | number,
  startDate: string,
  endDate: string,
  timezone: string
): Promise<{ hasOverlap: boolean; existingEvent?: any }> => {
  try {
    console.log("Checking overlap for:", {
      teacherId,
      startDate,
      endDate,
      timezone,
    });

    const response = await calendarApi.getAllEvents();
    if (!response?.events?.rows) {
      throw new Error("Failed to get events");
    }

    console.log("All events:", response.events.rows);

    // Filter events for the same teacher that are not cancelled
    const teacherEvents = response.events.rows.filter((event: any) => {
      const eventTeacherIdStr = String(event.teacher_id || event.resourceId);
      const newEventTeacherIdStr = String(teacherId);

      // If the existing event is 'unavailable', only consider it a conflict
      // if it belongs to the *same* teacher.
      if (
        event.class_type === "unavailable" ||
        event.class_type === "Unavailable"
      ) {
        if (eventTeacherIdStr !== newEventTeacherIdStr) {
          // This is an 'unavailable' block for a *different* teacher, so we can ignore it.
          return false;
        }
      }

      const isTeacherMatch = eventTeacherIdStr === newEventTeacherIdStr;
      const isNotCancelled = !["cancelled", "completed"].includes(
        event.class_status
      );
      const hasValidDates = Boolean(event.startDate && event.endDate);
      const isFutureEvent = DateTime.fromISO(event.startDate) >= DateTime.now();

      console.log("Event check:", {
        event,
        isTeacherMatch,
        isNotCancelled,
        hasValidDates,
        isFutureEvent,
        eventTeacherId: event.teacher_id,
        eventResourceId: event.resourceId,
        teacherIdStr: newEventTeacherIdStr,
      });

      return isTeacherMatch && isNotCancelled && hasValidDates && isFutureEvent;
    });

    console.log("Filtered teacher events:", teacherEvents);

    // Check overlap with each existing event
    for (const event of teacherEvents) {
      console.log("Checking event for overlap:", {
        event,
        newStart: startDate,
        newEnd: endDate,
        existingStart: event.startDate,
        existingEnd: event.endDate,
      });

      const overlap = doEventsOverlap(
        startDate,
        endDate,
        event.startDate,
        event.endDate,
        timezone
      );

      console.log("Overlap result:", overlap);

      if (overlap) {
        // Format the event type for display
        const eventType = event.class_type?.replace(/-/g, " ") || "Unknown";
        const eventTime = `${formatTime(
          event.startDate,
          timezone
        )} - ${formatTime(event.endDate, timezone)}`;

        console.log("Found overlapping event:", {
          event,
          eventType,
          eventTime,
        });

        return {
          hasOverlap: true,
          existingEvent: {
            ...event,
            class_type: eventType,
            formattedTime: eventTime,
          },
        };
      }
    }

    return { hasOverlap: false };
  } catch (error) {
    console.error("Error checking event overlap:", error);
    throw error;
  }
};

// Show all class types without filtering
const availableClassTypes = classTypes;

console.log("Rendering EventCreateForm");

// Helper function to validate class type
const isValidClassType = (type: string): boolean => {
  const isValid = classTypes.some((ct) => ct.value === type);
  console.log("Validating class type:", {
    type,
    isValid,
    availableTypes: classTypes.map((ct) => ct.value),
  });
  return isValid;
};

// Helper function to get class type details
const getClassTypeDetails = (type: string) => {
  const details = classTypes.find((ct) => ct.value === type);
  console.log("Getting class type details:", { type, details });
  return details;
};

export default function EventCreateForm({
  teachers,
  onClose,
  onSuccess,
  timezone = getDefaultTimezone(),
  start: defaultStart = null,
  end: defaultEnd = null,
  initialTeacherId,
  initialClassType = "Regular-Lesson",
  initialClassStatus = "scheduled",
  initialEventId,
  isEditMode,
  editEventData,
}: EventCreateFormProps) {
  console.log("EventCreateForm props:", {
    initialTeacherId,
    initialClassType,
    initialClassStatus,
    teachersCount: teachers.length,
    teachers: teachers.map((t) => ({
      id: t.id,
      name: `${t.first_name} ${t.last_name}`,
    })),
  });

  console.log("🔍 EventCreateForm - Detailed teacher info:", {
    initialTeacherId,
    initialTeacherIdType: typeof initialTeacherId,
    initialTeacherIdValue: initialTeacherId,
    isEditMode,
    initialClassType,
    teachersAvailable: teachers.length > 0,
    allTeachers: teachers.map((t) => ({
      id: t.id,
      name: `${t.first_name} ${t.last_name}`,
      idType: typeof t.id,
    })),
    foundTeacher: teachers.find(
      (t) => String(t.id) === String(initialTeacherId)
    ),
  });

  console.log("Initial render with class types:", classTypes);

  const [start, setStart] = useState(
    defaultStart ? defaultStart.toISOString().slice(0, 16) : ""
  );
  const [end, setEnd] = useState(
    defaultEnd ? defaultEnd.toISOString().slice(0, 16) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [classStatus, setClassStatus] = useState<LessonStatus>(
    initialClassStatus as LessonStatus
  );
  const [classStatusDropdownOpen, setClassStatusDropdownOpen] = useState(false);

  const [classType, setClassType] = useState(() => {
    console.log("Initializing class type:", {
      initialType: initialClassType,
      isValid: isValidClassType(initialClassType),
      availableTypes: classTypes.map((t) => t.value),
    });
    return initialClassType;
  });
  const [duration, setDuration] = useState(50);
  const [durationDropdownOpen, setDurationDropdownOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");

  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  const [repeatMode, setRepeatMode] = useState("none");
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [repeatWeeks, setRepeatWeeks] = useState(2);

  const durationDropdownRef = useRef<HTMLDivElement>(null);
  const groupDropdownRef = useRef<HTMLDivElement>(null);
  const classStatusDropdownRef = useRef<HTMLDivElement>(null);
  const repeatModeDropdownRef = useRef<HTMLDivElement>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  // Add missing variables
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [repeatingType, setRepeatingType] = useState<string>("none");

  // Add missing function
  const getRepeatingData = () => {
    return {
      type: repeatingType,
      days: repeatDays,
      weeks: repeatWeeks,
    };
  };

  // Add a separate state for end input display
  const [endInput, setEndInput] = useState(
    defaultEnd ? defaultEnd.toISOString().slice(0, 16) : ""
  );

  // Show all lesson status options
  const lessonStatusOptions: { value: LessonStatus; label: string }[] = [
    { value: "scheduled", label: "Scheduled" },
    { value: "completed", label: "Given" },
    { value: "cancelled", label: "Cancelled" },
    { value: "student_no_show", label: "Student No Show" },
    { value: "teacher_no_show", label: "Teacher not show" },
  ];

  // Add state for showing/hiding student selection
  const shouldShowStudentSelection = !classTypes.find(
    (type) => type.value === classType
  )?.noStudent;

  useEffect(() => {
    async function fetchStudents() {
      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const res = await fetch("/api/proxy/students", {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setStudents(
            (data as Student[]).sort((a: Student, b: Student) =>
              a.last_name.localeCompare(b.last_name)
            )
          );
        } else if (Array.isArray(data.students)) {
          setStudents(
            (data.students as Student[]).sort((a: Student, b: Student) =>
              a.last_name.localeCompare(b.last_name)
            )
          );
        }
      } catch {
        setStudents([]);
      }
    }
    fetchStudents();
  }, []);

  useEffect(() => {
    if (start && duration) {
      const startDate = DateTime.fromISO(start, { zone: timezone });
      const endDate = startDate.plus({ minutes: duration });
      setEnd(endDate.toISO()); // for event data (ISO)
      setEndInput(endDate.toFormat("yyyy-MM-dd'T'HH:mm")); // for input field
    }
  }, [start, duration, timezone]);

  useEffect(() => {
    const selectedType = classTypes.find((type) => type.value === classType);
    if (selectedType) {
      setDuration(selectedType.duration);
    }
  }, [classType]);

  useEffect(() => {
    if (classType === "group") {
      setStudentId("");
    } else {
      setSelectedGroupId("");
    }
  }, [classType]);

  useEffect(() => {
    console.log("Available class types:", availableClassTypes);
    console.log("Class type select state:", { classType, classTypes });
  }, [classType, availableClassTypes]);

  const handleSubmit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Логіка редагування залишається без змін
      if (isEditMode) {
        if (!start || !end) {
          setLoading(false);
          toast.error("Please select start and end time");
          return;
        }

        // Convert start and end to UTC
        const startUTC =
          DateTime.fromISO(start, { zone: timezone }).toUTC().toISO() || "";
        const endUTC =
          DateTime.fromISO(end, { zone: timezone }).toUTC().toISO() || "";

        if (!startUTC || !endUTC) {
          setLoading(false);
          toast.error("Invalid date format");
          return;
        }

        // Check if this is a reserved lesson being marked as "Given"
        const isBeingMarkedAsGiven = classStatus === "completed";
        const hasStudent = editEventData?.studentId;

        console.log(
          "🔍 EventCreateForm - Checking lesson status change conditions:",
          {
            isBeingMarkedAsGiven,
            hasStudent,
            studentId: editEventData?.studentId,
            classStatus,
          }
        );

        // If this is being marked as "Given" and has a student, check if student has paid lessons
        if (isBeingMarkedAsGiven && hasStudent) {
          try {
            console.log(
              "🔍 EventCreateForm - Checking student's remaining classes before setting 'Given' status..."
            );
            const token =
              typeof window !== "undefined"
                ? localStorage.getItem("token")
                : null;
            const studentResponse = await fetch(
              `/api/proxy/students/${hasStudent}/remaining-classes`,
              {
                credentials: "include",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              }
            );

            if (!studentResponse.ok) {
              throw new Error("Failed to fetch student class balance");
            }

            const studentData = await studentResponse.json();
            const remainingClasses = studentData.remaining || 0;

            console.log("🔍 EventCreateForm - Student remaining classes:", {
              studentId: hasStudent,
              remainingClasses,
              canSetGiven: remainingClasses > 0,
            });

            // If student has no paid classes, prevent setting status to "Given"
            if (remainingClasses <= 0) {
              console.log(
                "❌ EventCreateForm - Cannot set status to 'Given' - student has no paid classes"
              );
              toast.error(
                "Cannot mark lesson as 'Given' - student has no paid classes"
              );
              setLoading(false);
              return; // Exit early - prevent status change
            }
          } catch (error) {
            console.error("Error checking student's remaining classes:", error);
            toast.error("Failed to verify student's class balance");
            setLoading(false);
            return; // Exit early if we can't verify student's balance
          }
        }

        const eventData = {
          id: parseInt(initialEventId || ""),
          start_date: startUTC,
          end_date: endUTC,
          class_status: classStatus,
          student_id: editEventData?.studentId
            ? parseInt(editEventData.studentId)
            : undefined,
        };

        console.log("📝 EventCreateForm - Submitting edit data:", eventData);

        if (onSuccess) {
          onSuccess(eventData);
        }
        return;
      }

      // --- Виправлена логіка створення ---
      if (!initialTeacherId) {
        setLoading(false);
        toast.error("Please select a teacher");
        return;
      }

      if (!start || !end) {
        setLoading(false);
        toast.error("Please select start and end time");
        return;
      }

      const startUTC =
        DateTime.fromISO(start, { zone: timezone }).toUTC().toISO() || "";
      const endUTC =
        DateTime.fromISO(end, { zone: timezone }).toUTC().toISO() || "";

      if (!startUTC || !endUTC) {
        setLoading(false);
        toast.error("Invalid date format");
        return;
      }

      // 1. ЄДИНА ПРАВИЛЬНА ПЕРЕВІРКА НА КОНФЛІКТИ
      const overlapResult = await checkEventOverlap(
        initialTeacherId,
        startUTC,
        endUTC,
        timezone
      );
      if (overlapResult.hasOverlap) {
        const { existingEvent } = overlapResult;
        const errorMessage = `This time is already occupied by a '${existingEvent.class_type}' event from ${existingEvent.formattedTime}.`;
        toast.error(errorMessage);
        setLoading(false);
        return;
      }

      // 2. ПОВЕРТАЄМО ЛОГІКУ СТВОРЕННЯ ПОДІЇ
      const studentId =
        selectedStudent && selectedStudent !== "group"
          ? selectedStudent
          : undefined;
      let paymentStatusToUse: PaymentStatus = "reserved";

      if (classType !== "Group-Lesson" && studentId) {
        const balanceRes = await calendarApi.getStudentRemainingClasses(
          studentId.toString()
        );
        const paidCount = balanceRes?.remaining || 0;
        const isTrial = classType === "Trial-Lesson";

        if (!isTrial && paidCount > 0) {
          paymentStatusToUse = "paid";
        }
      }

      const eventData = {
        class_type: classType,
        student_id: studentId ? parseInt(studentId) : undefined,
        teacher_id: parseInt(String(initialTeacherId)),
        group_id: selectedGroupId ? parseInt(selectedGroupId) : undefined,
        class_status: classStatus,
        payment_status: paymentStatusToUse,
        startDate: startUTC,
        endDate: endUTC,
        duration: dayjs(end).diff(dayjs(start), "minute"),
        repeating: repeatingType !== "none" ? getRepeatingData() : undefined,
      };

      await calendarApi.createCalendar(eventData);

      toast.success("Event created successfully!");
      if (onSuccess) onSuccess(eventData);
      else onClose();
    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      toast.error(err.message || "Failed to create event.");
    } finally {
      setLoading(false);
    }
  };

  const selectedClassType = availableClassTypes.find(
    (type) => type.value === classType
  );

  return (
    <form onSubmit={handleSubmit} className="form compact">
      {error && (
        <div
          className="error-message"
          style={{
            color: "#dc2626",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            fontWeight: 600,
            fontSize: "1.1rem",
            padding: "18px 24px",
            margin: "0 auto 1.5rem auto",
            maxWidth: 420,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(220,38,38,0.08)",
          }}
        >
          {error}
        </div>
      )}

      {/* Show current event info in edit mode */}
      {isEditMode && (
        <div
          style={{
            background: "#f8f9fa",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #e9ecef",
          }}
        >
          <h4
            style={{
              margin: "0 0 12px 0",
              color: "#495057",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            Current Event Information (Read Only)
          </h4>
          <div style={{ fontSize: "13px", color: "#6c757d" }}>
            <div style={{ marginBottom: "4px" }}>
              <strong>Class Type:</strong>{" "}
              {classTypes.find((t) => t.value === classType)?.label ||
                classType}
            </div>
            <div style={{ marginBottom: "4px" }}>
              <strong>Teacher:</strong>{" "}
              {(() => {
                const teacher = teachers.find(
                  (t) => String(t.id) === String(initialTeacherId)
                );
                return teacher
                  ? `${teacher.first_name} ${teacher.last_name}`
                  : "Not selected";
              })()}
            </div>
            <div style={{ marginBottom: "4px" }}>
              <strong>Duration:</strong> {duration} minutes
            </div>
          </div>
        </div>
      )}

      {/* В режимі редагування показуємо тільки 3 поля */}
      {isEditMode ? (
        <>
          {/* Teacher Information (Read-only) */}
          <div style={{ marginBottom: "20px" }}>
            <label className="label">Teacher</label>
            <div
              style={{
                padding: "8px 12px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                background: "#f3f4f6",
                color: "#666",
                fontSize: "14px",
              }}
            >
              {(() => {
                const teacher = teachers.find(
                  (t) => String(t.id) === String(initialTeacherId)
                );
                return teacher
                  ? `${teacher.first_name} ${teacher.last_name}`
                  : "Teacher not found";
              })()}
            </div>
          </div>

          {/* Class Status */}
          <div style={{ marginBottom: "20px" }}>
            <label className="label">Class Status</label>
            <div className="dropdown" ref={classStatusDropdownRef}>
              <button
                type="button"
                className="dropdown-button"
                onClick={() => setClassStatusDropdownOpen((v) => !v)}
                style={{ color: "#222" }}
              >
                <span className="flex items-center gap-2">
                  {lessonStatusOptions.find((opt) => opt.value === classStatus)
                    ?.label || "Select status"}
                </span>
                <svg
                  className={`ml-2 size-4 transition-transform ${
                    classStatusDropdownOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {classStatusDropdownOpen && (
                <div className="dropdown-menu">
                  {lessonStatusOptions.map((type) => (
                    <button
                      type="button"
                      key={type.value}
                      className={`dropdown-item ${
                        type.value === classStatus ? "selected" : ""
                      }`}
                      onClick={() => {
                        setClassStatus(type.value);
                        setClassStatusDropdownOpen(false);
                      }}
                      style={{ color: "#222" }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Date and Time Selection */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="label">Start Time</label>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="input"
                required
              />
            </div>
            <div className="flex-1">
              <label className="label">End Time</label>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="input"
                required
              />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Class Type and Class Status - Side by side - ONLY FOR CREATE MODE */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="label">Class Type</label>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={classType}
                  onChange={(e) => {
                    const selectedValue = e.target.value;
                    setClassType(selectedValue);
                    const selectedType = classTypes.find(
                      (t) => t.value === selectedValue
                    );
                    if (selectedType) {
                      setDuration(selectedType.duration);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  {classTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Hide class status if unavailable */}
            {classType !== "unavailable" && (
              <div className="flex-1">
                <label className="label">Class Status</label>
                <div className="dropdown" ref={classStatusDropdownRef}>
                  <button
                    type="button"
                    className="dropdown-button"
                    onClick={() => setClassStatusDropdownOpen((v) => !v)}
                    style={{ color: "#222" }}
                  >
                    <span className="flex items-center gap-2">
                      {lessonStatusOptions.find(
                        (opt) => opt.value === classStatus
                      )?.label || "Select status"}
                    </span>
                    <svg
                      className={`ml-2 size-4 transition-transform ${
                        classStatusDropdownOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {classStatusDropdownOpen && (
                    <div className="dropdown-menu">
                      {lessonStatusOptions.map((type) => (
                        <button
                          type="button"
                          key={type.value}
                          className={`dropdown-item ${
                            type.value === classStatus ? "selected" : ""
                          }`}
                          onClick={() => {
                            setClassStatus(type.value);
                            setClassStatusDropdownOpen(false);
                          }}
                          style={{ color: "#222" }}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Duration (only for non-trial lessons, hide for unavailable) */}
          {classType === "trial" ? (
            <div>
              <label className="label">Duration</label>
              <input
                className="input"
                value={30}
                disabled
                style={{ background: "#f3f4f6", color: "#888" }}
              />
            </div>
          ) : classType !== "unavailable" ? (
            <div>
              <label className="label">Duration</label>
              <div className="dropdown" ref={durationDropdownRef}>
                <button
                  type="button"
                  className="dropdown-button"
                  onClick={() => setDurationDropdownOpen((v) => !v)}
                  style={{ color: "#222" }}
                >
                  <span>{duration} min</span>
                  <svg
                    className={`ml-2 size-4 transition-transform ${
                      durationDropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {durationDropdownOpen && (
                  <div className="dropdown-menu">
                    {durations.map((dur) => (
                      <button
                        type="button"
                        key={dur}
                        className={`dropdown-item ${
                          dur === duration ? "selected" : ""
                        }`}
                        onClick={() => {
                          setDuration(dur);
                          setDurationDropdownOpen(false);
                        }}
                        style={{ color: "#222" }}
                      >
                        {dur} minutes
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Show student selection only if not unavailable */}
          {!isEditMode && shouldShowStudentSelection && (
            <div className="flex-1">
              <label className="label">
                {classType === "group" ? "Group" : "Student"}
              </label>
              {classType === "group" ? (
                <>
                  <label className="label">Select Group</label>
                  <div className="dropdown">
                    <button
                      type="button"
                      className="dropdown-button"
                      onClick={() => setGroupDropdownOpen((v) => !v)}
                      style={{ color: "#222" }}
                    >
                      <span>
                        {selectedGroupId
                          ? mockGroups.find(
                              (g) => g.id.toString() === selectedGroupId
                            )?.name
                          : "Select group"}
                      </span>
                      <svg
                        className={`ml-2 size-4 transition-transform ${
                          groupDropdownOpen ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {groupDropdownOpen && (
                      <div className="dropdown-menu">
                        {mockGroups.map((group) => (
                          <button
                            type="button"
                            key={group.id}
                            className={`dropdown-item ${
                              group.id.toString() === selectedGroupId
                                ? "selected"
                                : ""
                            }`}
                            onClick={() => {
                              setSelectedGroupId(group.id.toString());
                              setGroupDropdownOpen(false);
                            }}
                            style={{ color: "#222" }}
                          >
                            {group.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <label className="label">Student</label>
                  <input
                    className="input"
                    placeholder="Search by name or first letter..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    style={{ marginBottom: 8 }}
                  />
                  <div className="dropdown">
                    <button
                      type="button"
                      className="dropdown-button"
                      onClick={() => setGroupDropdownOpen((v) => !v)}
                      style={{ color: "#222" }}
                    >
                      <span>{studentName || "Select student"}</span>
                      <svg
                        className={`ml-2 size-4 transition-transform ${
                          groupDropdownOpen ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {groupDropdownOpen && (
                      <div className="dropdown-menu">
                        {students.map((student) => (
                          <button
                            type="button"
                            key={student.id}
                            className={`dropdown-item ${
                              student.id.toString() === studentId
                                ? "selected"
                                : ""
                            }`}
                            onClick={() => {
                              setStudentId(student.id.toString());
                              setStudentName(
                                student.first_name + " " + student.last_name
                              );
                              setGroupDropdownOpen(false);
                            }}
                            style={{ color: "#222" }}
                          >
                            {student.first_name + " " + student.last_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Submit Button */}
      <div className="flex justify-end gap-4 mt-6">
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Creating..." : "Create Event"}
        </button>
      </div>
    </form>
  );
}
