import { useState, useEffect } from "react";
import { Card, DatePicker, Button, Table, TableColumnsType } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import type { Dayjs } from "dayjs";
import { motion } from "framer-motion";
import api from "../../config";
import { useAuth } from "../../hooks/useAuth";
import "./dashboard.css"; // Import custom CSS for table styling

const { RangePicker } = DatePicker;

interface ClassState {
  name: string;
  total_classes: number;
  paid_classes: number;
  unpaid_classes: number;
  classes_taken: number;
  id?: string;
}

interface LessonData {
  id: string;
  student_id: string;
  teacher_id?: string;
  class_status: string;
  lesson_date?: string;
  calendar_id?: string;
  class_type_id?: number;
  class_type: {
    id: number;
    name: string;
  };
  Student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  Teacher?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  source?: string; // Для розрізнення джерела даних
}

interface TeacherSalary {
  id?: string;
  name: string;
  class_type_stats: {
    class_type: string;
    status?: string;
    total_classes_taught: number;
    total_salary: string;
  }[];
}

// Update cardStyles to be more responsive
const cardStyles = {
  header: {
    background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
    borderRadius: "12px 12px 0 0",
    padding: "12px 16px", // Reduced padding for mobile
    border: "none",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    "@media (minWidth: 640px)": {
      padding: "16px 24px",
    },
  },
  body: {
    padding: "10px", // Reduced padding for mobile
    borderRadius: "0 0 12px 12px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    height: "auto", // Changed from fixed height
    maxHeight: "80vh",
    "@media (minWidth: 640px)": {
      padding: "20px",
    },
  },
};

// Burayı güncelliyorum - Class type ve status kombinasyonları için sütun başlıklarını ve hesaplamaları tanımlayalım
// Bu özel kombinasyonlar için sabit bir liste tanımlıyoruz
const CLASS_TYPE_STATUS_COMBOS = [
  // Given status for all class types
  {
    display: "Regular-Lesson / Given",
    type: "Regular-Lesson",
    status: "Given",
  },
  { display: "Trial-Lesson / Given", type: "Trial-Lesson", status: "Given" },
  { display: "Training / Given", type: "Training", status: "Given" },

  // No show student status for all class types
  {
    display: "Regular-Lesson / No show student",
    type: "Regular-Lesson",
    status: "No show student",
  },
  {
    display: "Trial-Lesson / No show student",
    type: "Trial-Lesson",
    status: "No show student",
  },
  {
    display: "Training / No show student",
    type: "Training",
    status: "No show student",
  },

  // No show teacher status for all class types (these result in negative earnings)
  {
    display: "Regular-Lesson / No show teacher",
    type: "Regular-Lesson",
    status: "No show teacher",
  },
  {
    display: "Trial-Lesson / No show teacher",
    type: "Trial-Lesson",
    status: "No show teacher",
  },
  {
    display: "Training / No show teacher",
    type: "Training",
    status: "No show teacher",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [classStateData, setStateTypeData] = useState<ClassState[]>([]);
  const [teacherSalaryData, setTeacherSalaryData] = useState<TeacherSalary[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([
    null,
    null,
  ]);
  // Add a debug mode flag - you can turn this to true for troubleshooting
  const [debugMode] = useState(false);
  const auth = useAuth();

  // Function to calculate classes taken based on lesson data
  const calculateClassesTaken = (
    lessonData: LessonData[],
    studentId: string,
  ) => {
    // Add robust error handling
    try {
      // Ensure lessonData is an array
      if (!lessonData || !Array.isArray(lessonData)) {
        console.warn("Lesson data is not an array:", lessonData);
        return 0;
      }

      // Check if studentId is valid
      if (!studentId) {
        console.warn("Invalid student ID provided");
        return 0;
      }

      // Log the lessonData for debugging
      console.log(
        `Calculating classes taken for student ID ${studentId} with ${lessonData.length} lessons`,
      );

      // Count classes that match our criteria:
      // 1. Belong to this student
      // 2. ONLY count Trial-Lesson or Regular-Lesson (Training is NEVER counted)
      // 3. Status is Given or No show student
      const classCount = lessonData.filter((lesson) => {
        // Skip if lesson is invalid or doesn't belong to this student
        if (!lesson || lesson.student_id !== studentId) {
          return false;
        }

        // Skip if class_type is missing
        if (!lesson.class_type || !lesson.class_type.name) {
          return false;
        }

        // ONLY count these two specific class types (Training is NEVER counted)
        const isValidType =
          lesson.class_type.name === "Trial-Lesson" ||
          lesson.class_type.name === "Regular-Lesson";

        // ONLY count these two specific statuses
        const isValidStatus =
          lesson.class_status === "Given" ||
          lesson.class_status === "No show student";

        // Must satisfy BOTH conditions to be counted
        return isValidType && isValidStatus;
      }).length;

      console.log(
        `Found ${classCount} valid classes taken for student ID ${studentId}`,
      );
      return classCount;
    } catch (error) {
      console.error("Error calculating classes taken:", error);
      return 0;
    }
  };

  // Fallback function for paid_classes if API doesn't provide proper data
  const getFallbackClassesTaken = (item: ClassState) => {
    // If paid_classes is available in the data, we can use it as a fallback
    // This assumes paid_classes is supposed to represent the same value as classes_taken
    if (typeof item.paid_classes === "number") {
      return item.paid_classes;
    }

    // Default fallback is 0
    return 0;
  };

  // Function to request appropriate teacher salary endpoint and get raw lesson data + calendar events
  const fetchTeacherSalaryData = async (userId?: string, dateParams?: any) => {
    try {
      // First, fetch the teachers WITH their rates included
      const teachersRes = userId
        ? await api.get(`/teachers/${userId}`)
        : await api.get("/teachers");

      let teachers = Array.isArray(teachersRes.data)
        ? teachersRes.data
        : userId
          ? [teachersRes.data]
          : [];

      console.log("Teachers with rates from API:", teachers);

      // If teachers data doesn't include rates, fetch them separately for each teacher
      const teachersWithRates = await Promise.all(
        teachers.map(async (teacher) => {
          // If teacher already has TeacherRates, use them
          if (teacher.TeacherRates && teacher.TeacherRates.length > 0) {
            return teacher;
          }

          // Otherwise, fetch rates specifically for this teacher
          try {
            const teacherRatesRes = await api.get(
              `/teachers/${teacher.id}/rates`,
            );
            const rates = teacherRatesRes.data;

            // Add rates to teacher object
            return {
              ...teacher,
              TeacherRates: Array.isArray(rates) ? rates : [],
            };
          } catch (error) {
            console.error(
              `Error fetching rates for teacher ${teacher.id}:`,
              error,
            );
            // Return original teacher if rates fetch fails
            return teacher;
          }
        }),
      );

      // Fetch lesson data directly to get all details including status
      console.log("Fetching lessons with date params:", dateParams);

      // Only send date params if they exist and are valid
      let lessonsRes;
      if (dateParams && dateParams.start_date && dateParams.end_date) {
        console.log(
          `Filtering lessons by ISO date range: ${dateParams.start_date} to ${dateParams.end_date}`,
        );
        lessonsRes = await api.get("/lessons", {
          params: {
            start_date: dateParams.start_date,
            end_date: dateParams.end_date,
          },
        });
      } else {
        console.log("Fetching all lessons without date filtering");
        lessonsRes = await api.get("/lessons");
      }

      console.log(`Received ${lessonsRes.data?.length || 0} lessons from API`);

      if (!Array.isArray(lessonsRes.data)) {
        console.error("Lessons data is not an array:", lessonsRes.data);
        throw new Error("Lessons data is not in expected format");
      }

      // Special debug for August 4-10 week
      if (dateParams && dateParams.start_date && dateParams.end_date) {
        const startDate = dateParams.start_date.split("T")[0];
        const endDate = dateParams.end_date.split("T")[0];
        if (startDate === "2024-08-04" && endDate === "2024-08-10") {
          console.log(
            `=== AUGUST 4-10 DEBUG: Fetched ${lessonsRes.data.length} lessons from lessons API ===`,
          );
          lessonsRes.data.forEach((lesson) => {
            const lessonDate = lesson.lesson_date
              ? lesson.lesson_date.split("T")[0]
              : "unknown";
            console.log(
              `=== AUGUST 4-10 LESSON FROM API: ${lessonDate} - Teacher: ${lesson.teacher_id} - Type: ${lesson.class_type?.name} - Status: ${lesson.class_status} ===`,
            );
          });
        }
      }

      // 🆕 ДОДАЄМО: Fetch calendar events data
      console.log("Fetching calendar events with date params:", dateParams);

      let calendarEventsRes;
      if (dateParams && dateParams.start_date && dateParams.end_date) {
        console.log(
          `Filtering calendar events by date range: ${dateParams.start_date} to ${dateParams.end_date}`,
        );
        calendarEventsRes = await api.get("/calendar/events", {
          params: {
            start: dateParams.start_date,
            end: dateParams.end_date,
          },
        });
      } else {
        console.log("Fetching all calendar events without date filtering");
        calendarEventsRes = await api.get("/calendar/events");
      }

      // Process calendar events data
      let calendarEvents = Array.isArray(calendarEventsRes.data)
        ? calendarEventsRes.data
        : calendarEventsRes.data.events?.rows || [];

      console.log(`Received ${calendarEvents.length} calendar events from API`);

      // Special debug for August 4-10 week
      if (dateParams && dateParams.start_date && dateParams.end_date) {
        const startDate = dateParams.start_date.split("T")[0];
        const endDate = dateParams.end_date.split("T")[0];
        if (startDate === "2024-08-04" && endDate === "2024-08-10") {
          console.log(
            `=== AUGUST 4-10 DEBUG: Fetched ${calendarEvents.length} calendar events from calendar API ===`,
          );
          calendarEvents.forEach((event) => {
            const eventDate = event.startDate
              ? event.startDate.split("T")[0]
              : "unknown";
            console.log(
              `=== AUGUST 4-10 CALENDAR EVENT: ${eventDate} - Teacher: ${event.teacher_id} - Type: ${event.class_type} - Status: ${event.class_status} ===`,
            );
          });
        }
      }

      // 🆕 ДОДАЄМО: Функція нормалізації типів класів для узгодження з Dashboard
      const normalizeClassType = (classType: string): string => {
        if (!classType) return "Unknown";

        const lowerType = classType.toLowerCase().trim();

        // Мапінг різних варіантів назв до стандартних назв Dashboard
        const typeMapping: { [key: string]: string } = {
          // Regular варіанти
          regular: "Regular-Lesson",
          "regular-lesson": "Regular-Lesson",
          "regular lesson": "Regular-Lesson",

          // Trial варіанти
          trial: "Trial-Lesson",
          "trial-lesson": "Trial-Lesson",
          "trial lesson": "Trial-Lesson",

          // Training варіанти
          training: "Training",
          "training-lesson": "Training",
          "training lesson": "Training",

          // Instant варіанти (treated as Regular)
          instant: "Regular-Lesson",
          "instant-lesson": "Regular-Lesson",
          "instant lesson": "Regular-Lesson",

          // Group варіанти (treated as Regular)
          group: "Regular-Lesson",
          "group-lesson": "Regular-Lesson",
          "group lesson": "Regular-Lesson",
        };

        const normalized = typeMapping[lowerType];
        if (normalized) {
          console.log(
            `🔄 Dashboard: Normalized class type: "${classType}" -> "${normalized}"`,
          );
          return normalized;
        }

        return classType;
      };

      // 🆕 ДОДАЄМО: Конвертуємо календарні події в формат, сумісний з lessons
      const convertedCalendarEvents = calendarEvents
        .filter((event) => {
          // Пропускаємо "Unavailable" події для розрахунків зарплати
          const isUnavailable =
            event.class_type === "Unavailable" ||
            event.class_type === "unavailable" ||
            event.class_status === "Unavailable" ||
            event.title === "Unavailable";

          if (isUnavailable) {
            console.log(`📅 Skipping unavailable event: ${event.id}`);
            return false;
          }

          return true;
        })
        .map((event) => {
          // Конвертуємо дату з startDate
          let lessonDate = event.startDate;

          // Знаходимо student_id та teacher_id
          const studentId = event.student_id ? String(event.student_id) : null;
          const teacherId = String(
            event.teacher_id || event.resourceId || event.teacherId,
          );

          console.log(
            `📅 Converting calendar event ${event.id}: student=${studentId}, teacher=${teacherId}, type=${event.class_type}, status=${event.class_status}`,
          );

          return {
            id: `calendar_${event.id}`, // Додаємо префікс щоб уникнути конфліктів ID
            student_id: studentId,
            teacher_id: teacherId,
            class_status: event.class_status || "scheduled",
            lesson_date: lessonDate,
            calendar_id: event.id,
            class_type_id: null, // Буде визначено нижче
            class_type: {
              id: 0, // Буде оновлено
              name: normalizeClassType(event.class_type),
            },
            source: "calendar", // Для діагностики
          };
        });

      console.log(
        `📅 Converted ${convertedCalendarEvents.length} calendar events to lesson format`,
      );

      // Get class types to access rates
      const classTypesRes = await api.get("/class-types");
      const classTypes = Array.isArray(classTypesRes.data)
        ? classTypesRes.data
        : [];

      // 🆕 ДОДАЄМО: Оновлюємо class_type_id для конвертованих календарних подій
      convertedCalendarEvents.forEach((event) => {
        const classType = classTypes.find(
          (ct) => ct.name === event.class_type.name,
        );
        if (classType) {
          event.class_type_id = classType.id;
          event.class_type.id = classType.id;
          console.log(
            `📅 Updated class_type_id for event ${event.id}: ${event.class_type.name} -> ID ${classType.id}`,
          );
        } else {
          console.log(
            `⚠️ No matching class type found for: ${event.class_type.name}`,
          );
        }
      });

      // 🆕 ЗМІНЮЄМО: Об'єднуємо lessons та calendar events з уникненням дублікатів
      const lessonsMap = new Map();

      // Спочатку додаємо всі lessons (основне джерело)
      lessonsRes.data.forEach((lesson: any) => {
        const key = `${lesson.teacher_id}_${lesson.lesson_date}_${lesson.class_type?.name}`;
        lessonsMap.set(key, { ...lesson, source: "lessons" });
      });

      // Потім додаємо calendar events тільки якщо немає відповідного lesson
      convertedCalendarEvents.forEach((event: any) => {
        const key = `${event.teacher_id}_${event.lesson_date}_${event.class_type?.name}`;

        // Перевіряємо чи вже є lesson з такими ж параметрами
        if (!lessonsMap.has(key)) {
          lessonsMap.set(key, event);
          console.log(
            `📅 Added calendar event as lesson: ${event.id} (${event.teacher_id}, ${event.lesson_date}, ${event.class_type?.name})`,
          );
        } else {
          console.log(
            `📅 Skipped duplicate calendar event: ${event.id} (already exists as lesson)`,
          );
        }
      });

      const combinedLessons = Array.from(lessonsMap.values());

      console.log(
        `📊 Total combined lessons: ${combinedLessons.length} (${lessonsRes.data.length} from lessons + ${convertedCalendarEvents.length} from calendar, ${convertedCalendarEvents.length - (combinedLessons.length - lessonsRes.data.length)} duplicates removed)`,
      );

      // Special debug for August 4-10 week
      if (dateParams && dateParams.start_date && dateParams.end_date) {
        const startDate = dateParams.start_date.split("T")[0];
        const endDate = dateParams.end_date.split("T")[0];
        if (startDate === "2024-08-04" && endDate === "2024-08-10") {
          console.log(
            `=== AUGUST 4-10 DEBUG: Final combined lessons: ${combinedLessons.length} ===`,
          );
          combinedLessons.forEach((lesson) => {
            const lessonDate = lesson.lesson_date
              ? lesson.lesson_date.split("T")[0]
              : "unknown";
            console.log(
              `=== AUGUST 4-10 FINAL LESSON: ${lessonDate} - Teacher: ${lesson.teacher_id} - Type: ${lesson.class_type?.name} - Status: ${lesson.class_status} - Source: ${lesson.source} ===`,
            );
          });
        }
      }

      // Process and return the combined data
      return {
        teachers: teachersWithRates,
        lessons: combinedLessons, // 🆕 ЗМІНЮЄМО: Повертаємо об'єднані дані
        classTypes,
      };
    } catch (error) {
      console.error("Error fetching teacher salary raw data:", error);
      return {
        teachers: [],
        lessons: [],
        classTypes: [],
      };
    }
  };

  // Helper to get a rate for a teacher/class type
  const getTeacherRate = (
    teacher: any,
    classTypeId: number,
    classTypeName: string,
  ) => {
    // First try to get from TeacherRates in the teacher object
    if (teacher.TeacherRates && Array.isArray(teacher.TeacherRates)) {
      const rateObj = teacher.TeacherRates.find(
        (rate: any) => rate.class_type_id === classTypeId,
      );

      if (rateObj && typeof rateObj.rate !== "undefined") {
        console.log(
          `Found rate for ${teacher.first_name} ${teacher.last_name}, type=${classTypeName}: ${rateObj.rate}`,
        );
        return parseFloat(rateObj.rate);
      }
    }

    // If not found in TeacherRates, try teacher_rates (different API format)
    if (teacher.teacher_rates && Array.isArray(teacher.teacher_rates)) {
      const rateObj = teacher.teacher_rates.find(
        (rate: any) => rate.class_type_id === classTypeId,
      );

      if (rateObj && typeof rateObj.rate !== "undefined") {
        console.log(
          `Found rate in teacher_rates for ${teacher.first_name} ${teacher.last_name}, type=${classTypeName}: ${rateObj.rate}`,
        );
        return parseFloat(rateObj.rate);
      }
    }

    // If still not found, use a default based on class type
    const defaultRates: Record<string, number> = {
      "Regular-Lesson": 14,
      "Trial-Lesson": 8,
      Training: 10,
    };

    console.log(
      `Using default rate for ${teacher.first_name} ${teacher.last_name}, type=${classTypeName}: ${defaultRates[classTypeName] || 10}`,
    );
    return defaultRates[classTypeName] || 10;
  };

  // Process teacher salary data to match our display format
  const processTeacherSalaryData = async (
    userId?: string,
    dateParams?: any,
  ) => {
    try {
      // Fetch raw data from APIs
      const { teachers, lessons, classTypes } = await fetchTeacherSalaryData(
        userId,
        dateParams,
      );

      if (!teachers.length) {
        return [];
      }

      // Apply client-side date filtering if needed
      let filteredLessons = [...lessons]; // Start with all lessons

      // Always apply client-side date filtering if date range is selected
      if (dateRange[0] && dateRange[1]) {
        const startDate = dateRange[0].startOf("day").toISOString();
        const endDate = dateRange[1].endOf("day").toISOString();

        console.log(
          `=== DATE FILTERING: Applying client-side filtering from ${startDate} to ${endDate} ===`,
        );
        console.log(
          `=== DATE FILTERING: Before filtering: ${filteredLessons.length} lessons ===`,
        );

        logCounter = 0; // Reset log counter
        filteredLessons = filteredLessons.filter((lesson) =>
          isDateInRangeWithDebug(lesson.lesson_date, startDate, endDate),
        );

        console.log(
          `=== DATE FILTERING: After filtering: ${filteredLessons.length} lessons ===`,
        );

        // Debug: Show remaining lessons after filtering
        if (filteredLessons.length > 0) {
          console.log("=== REMAINING LESSONS AFTER FILTERING ===");
          filteredLessons.forEach((lesson, index) => {
            const lessonDate = lesson.lesson_date
              ? lesson.lesson_date.split("T")[0]
              : "unknown";
            console.log(
              `${index + 1}. Date: ${lessonDate}, Teacher: ${lesson.teacher_id}, Type: ${lesson.class_type?.name}, Status: ${lesson.class_status}`,
            );
          });
        }
      }

      // For each teacher, calculate their salary by class type AND status
      const processedTeacherData = teachers.map((teacher) => {
        const isNazar =
          teacher.first_name === "Nazar" && teacher.last_name === "Ischuk";

        // Only log for Nazar
        if (isNazar) {
          console.log(
            `=== NAZAR DEBUG: Processing teacher ${teacher.first_name} ${teacher.last_name} ===`,
          );
        }

        // Filter out only this teacher's lessons (including calendar events)
        const teacherLessons = filteredLessons.filter(
          (lesson: any) =>
            lesson.teacher_id === teacher.id ||
            String(lesson.teacher_id) === String(teacher.id),
        );

        // Special debug for August 4-10 week
        const isAugustWeek =
          dateRange[0] &&
          dateRange[1] &&
          dateRange[0].format("YYYY-MM-DD") === "2024-08-04" &&
          dateRange[1].format("YYYY-MM-DD") === "2024-08-10";

        if (isAugustWeek) {
          console.log(
            `=== AUGUST 4-10 DEBUG: Teacher ${teacher.first_name} ${teacher.last_name} (ID: ${teacher.id}) has ${teacherLessons.length} lessons ===`,
          );

          teacherLessons.forEach((lesson) => {
            const lessonDate = lesson.lesson_date
              ? lesson.lesson_date.split("T")[0]
              : "unknown";
            console.log(
              `=== AUGUST 4-10 LESSON: ${lessonDate} - ${lesson.class_type?.name} - ${lesson.class_status} - Source: ${lesson.source} ===`,
            );
          });
        }

        if (isNazar) {
          console.log(
            `=== NAZAR DEBUG: Found ${teacherLessons.length} total lessons for Nazar ===`,
          );
          console.log(`=== NAZAR DEBUG: Lessons breakdown:`, {
            fromLessonsTable: teacherLessons.filter(
              (l) => l.source === "lessons",
            ).length,
            fromCalendar: teacherLessons.filter((l) => l.source === "calendar")
              .length,
          });

          // Special check for date range April 28 to May 4, 2024
          const targetStartDate = "2024-04-28";
          const targetEndDate = "2024-05-04";

          const lessonsInTargetRange = teacherLessons.filter((lesson) => {
            const lessonDate = lesson.lesson_date
              ? lesson.lesson_date.split("T")[0]
              : "";
            return lessonDate >= targetStartDate && lessonDate <= targetEndDate;
          });

          console.log(
            `=== NAZAR DEBUG: Lessons between ${targetStartDate} and ${targetEndDate}: ${lessonsInTargetRange.length} ===`,
          );

          // Print all lessons in the target range
          lessonsInTargetRange.forEach((lesson) => {
            const lessonDate = lesson.lesson_date
              ? new Date(lesson.lesson_date).toISOString().split("T")[0]
              : "unknown";
            console.log(
              `=== NAZAR LESSON DETAIL: ID=${lesson.id}, Date=${lessonDate}, Type=${lesson.class_type?.name}, Status=${lesson.class_status}, Source=${lesson.source} ===`,
            );
          });

          // Check for potential duplicates by comparing dates
          const dateCounter: { [key: string]: number } = {};
          lessonsInTargetRange.forEach((lesson) => {
            const lessonDate = lesson.lesson_date
              ? lesson.lesson_date.split("T")[0]
              : "unknown";
            dateCounter[lessonDate] = (dateCounter[lessonDate] || 0) + 1;
          });

          // Log potential duplicate dates
          Object.entries(dateCounter).forEach(([date, count]) => {
            if (count > 1) {
              console.log(
                `=== NAZAR DEBUG: POTENTIAL DUPLICATE - ${count} lessons on date ${date} ===`,
              );

              // Show details of all lessons on this date
              const lessonsOnThisDate = lessonsInTargetRange.filter(
                (lesson) =>
                  lesson.lesson_date &&
                  lesson.lesson_date.split("T")[0] === date,
              );

              lessonsOnThisDate.forEach((lesson) => {
                console.log(
                  `=== DUPLICATE DETAIL: ID=${lesson.id}, Type=${lesson.class_type?.name}, Status=${lesson.class_status}, Source=${lesson.source} ===`,
                );
              });
            }
          });
        }

        // Create a counter object to track number of lessons by type and status
        // Structure: {classType}-{status}: {count: number, rate: number}
        const lessonCounters: {
          [key: string]: { count: number; rate: number };
        } = {};

        // Special debug for Nazar Ischuk - keep this
        let nazarDebugLessons: {
          date: string;
          type: string;
          status: string;
          id: string;
          source: string;
        }[] = [];

        // Track processed lesson IDs to avoid duplicates
        const processedLessonIds = new Set<string | number>();

        // Process each lesson and build up our counters
        teacherLessons.forEach((lesson: any) => {
          if (!lesson.class_type?.name || !lesson.class_status) {
            return; // Skip incomplete lessons
          }

          // Skip if we've already processed this lesson (avoid duplicates)
          if (lesson.id && processedLessonIds.has(lesson.id)) {
            if (isNazar) {
              console.log(
                `=== NAZAR DEBUG: Skipping duplicate lesson ID: ${lesson.id} ===`,
              );
            }
            return;
          }

          // Mark this lesson as processed
          if (lesson.id) {
            processedLessonIds.add(lesson.id);
          }

          const classType = lesson.class_type.name;
          const classStatus = lesson.class_status;
          const classTypeId = lesson.class_type_id;
          const lessonDate = lesson.lesson_date
            ? new Date(lesson.lesson_date).toISOString().split("T")[0]
            : "unknown";
          const source = lesson.source || "unknown";

          // Special debug for Nazar Ischuk
          if (isNazar) {
            console.log(
              `=== NAZAR DEBUG: Processing lesson: ${lessonDate} - ${classType} - ${classStatus} - ${source} ===`,
            );
            nazarDebugLessons.push({
              date: lessonDate,
              type: classType,
              status: classStatus,
              id: lesson.id || "unknown",
              source: source,
            });
          }

          // Skip statuses we don't care about (e.g., "Cancelled")
          if (
            classStatus !== "Given" &&
            classStatus !== "No show student" &&
            classStatus !== "No show teacher"
          ) {
            if (isNazar) {
              console.log(
                `=== NAZAR DEBUG: Skipping lesson with status "${classStatus}" ===`,
              );
            }
            return;
          }

          // Get the key for this type-status combination
          const key = `${classType}-${classStatus}`;

          // Get the teacher's rate for this class type
          let rate = getTeacherRate(teacher, classTypeId, classType);

          // Apply negative rate for "No show teacher"
          if (classStatus === "No show teacher") {
            rate = -rate;
          }

          // Initialize or update the counter
          if (!lessonCounters[key]) {
            lessonCounters[key] = { count: 1, rate: rate };
          } else {
            lessonCounters[key].count += 1;
          }

          // Only log for Nazar
          if (isNazar) {
            console.log(
              `=== NAZAR DEBUG: Added lesson to ${key}: date=${lessonDate}, count=${lessonCounters[key].count}, rate=${rate}, source=${source} ===`,
            );
          }
        });

        // Special debug summary for Nazar Ischuk
        if (isNazar) {
          console.log(`=== NAZAR DEBUG SUMMARY ===`);
          console.log(
            `Total lessons in date range: ${nazarDebugLessons.length}`,
          );
          console.log(
            `Lessons from database: ${nazarDebugLessons.filter((l) => l.source === "lessons").length}`,
          );
          console.log(
            `Lessons from calendar: ${nazarDebugLessons.filter((l) => l.source === "calendar").length}`,
          );
          console.log(
            `Dates processed: ${nazarDebugLessons.map((l) => l.date).join(", ")}`,
          );
          console.log(
            `Regular lessons with "Given" status: ${nazarDebugLessons.filter((l) => l.type === "Regular-Lesson" && l.status === "Given").length}`,
          );

          if (dateRange[0] && dateRange[1]) {
            const startStr = dateRange[0].format("YYYY-MM-DD");
            const endStr = dateRange[1].format("YYYY-MM-DD");
            console.log(`Current date filter: ${startStr} to ${endStr}`);
          }

          console.log(
            `Lesson counters for Nazar:`,
            JSON.stringify(lessonCounters, null, 2),
          );
        }

        // Now prepare the final stats object with all combinations
        // This will have ALL combinations, even if count is 0
        const finalStats: {
          class_type: string;
          status: string;
          total_classes_taught: number;
          total_salary: string;
        }[] = [];

        // Add an entry for each class type/status combination
        CLASS_TYPE_STATUS_COMBOS.forEach((combo) => {
          const comboKey = `${combo.type}-${combo.status}`;
          const counter = lessonCounters[comboKey] || { count: 0, rate: 0 };

          // If we have a count but no rate, get the rate now
          let rate = counter.rate;
          if (counter.count > 0 && rate === 0) {
            // Find the class type ID
            const classTypeObj = classTypes.find(
              (ct) => ct.name === combo.type,
            );
            if (classTypeObj) {
              rate = getTeacherRate(teacher, classTypeObj.id, combo.type);
              // Apply negative for "No show teacher"
              if (combo.status === "No show teacher") {
                rate = -rate;
              }
            }
          }

          // Calculate the total salary (count * rate)
          const totalSalary = counter.count * rate;

          finalStats.push({
            class_type: combo.type,
            status: combo.status,
            total_classes_taught: counter.count,
            total_salary: totalSalary.toFixed(2),
          });

          // Only log for Nazar
          if (isNazar && counter.count > 0) {
            console.log(
              `=== NAZAR DEBUG: Final stat for ${comboKey}: count=${counter.count}, rate=${rate}, salary=${totalSalary.toFixed(2)} ===`,
            );
          }
        });

        return {
          id: teacher.id,
          name: `${teacher.first_name} ${teacher.last_name}`,
          class_type_stats: finalStats,
        };
      });

      return processedTeacherData;
    } catch (error) {
      console.error("Error processing teacher salary data:", error);
      return [];
    }
  };

  // Helper function to check if a date string is within a given range
  const isDateInRange = (
    dateStr: string | undefined,
    startIso: string,
    endIso: string,
  ): boolean => {
    if (!dateStr) {
      console.log("=== DATE COMPARISON: No date string provided ===");
      return false;
    }

    try {
      // Extract just the date part (YYYY-MM-DD) for more lenient matching
      // This will work regardless of the time components or timezone
      const dateOnly = dateStr.split("T")[0];

      // Similarly extract only the date portions from the range boundaries
      const startDateOnly = startIso.split("T")[0];
      const endDateOnly = endIso.split("T")[0];

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (
        !dateRegex.test(dateOnly) ||
        !dateRegex.test(startDateOnly) ||
        !dateRegex.test(endDateOnly)
      ) {
        console.log(
          `=== DATE COMPARISON: Invalid date format - dateOnly: ${dateOnly}, startDateOnly: ${startDateOnly}, endDateOnly: ${endDateOnly} ===`,
        );
        return false;
      }

      // Simple date-only comparison (YYYY-MM-DD format)
      // This eliminates timezone issues by comparing just the date parts
      const result = dateOnly >= startDateOnly && dateOnly <= endDateOnly;

      // Log every comparison for debugging
      console.log(
        `=== DATE COMPARISON: ${dateOnly} >= ${startDateOnly} && ${dateOnly} <= ${endDateOnly} = ${result} ===`,
      );

      return result;
    } catch (error) {
      console.error("Error parsing date for range comparison:", error);
      return false;
    }
  };

  // Verbose version of the date comparison for debugging - limit logs to avoid flooding
  let logCounter = 0;
  const isDateInRangeWithDebug = (
    dateStr: string | undefined,
    startIso: string,
    endIso: string,
  ): boolean => {
    return isDateInRange(dateStr, startIso, endIso);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let studentClassStats: ClassState[] = [];
        let lessonsData: LessonData[] = [];
        let hasLessonData = false;

        // Fetch lesson data
        try {
          const lessonsRes = await api.get("/lessons");
          lessonsData = lessonsRes.data || [];
          hasLessonData = Array.isArray(lessonsData) && lessonsData.length > 0;
        } catch (error) {
          console.error("Error fetching lessons:", error);
          lessonsData = []; // Continue with empty array
          hasLessonData = false;
        }

        if (auth.user?.role === "student") {
          // Only fetch specific student's data
          const res = await api.get(`/students/${auth.user.id}/class-stats`);
          // Process the data to calculate classes_taken
          const processedData = Array.isArray(res.data) ? res.data : [res.data];
          studentClassStats = processedData.map((item) => ({
            ...item,
            id: auth.user?.id,
            // Calculate classes_taken based on lessons data or use fallback
            classes_taken: hasLessonData
              ? calculateClassesTaken(lessonsData, auth.user?.id || "")
              : getFallbackClassesTaken(item),
          }));
        } else if (
          auth.user?.role === "admin" ||
          auth.user?.role === "manager" ||
          auth.user?.role === "accountant"
        ) {
          // Fetch all students data
          const res = await api.get("/students/class-stats");
          // Process the data to calculate classes_taken
          const processedData = Array.isArray(res.data) ? res.data : [];
          studentClassStats = processedData.map((item) => ({
            ...item,
            // Calculate classes_taken for each student or use fallback
            classes_taken: hasLessonData
              ? calculateClassesTaken(lessonsData, item.id || "")
              : getFallbackClassesTaken(item),
          }));
        }

        setStateTypeData(studentClassStats);

        if (auth.user?.role === "teacher") {
          // Only fetch specific teacher's salary data
          const teacherData = await processTeacherSalaryData(auth.user.id);
          setTeacherSalaryData(teacherData);
        } else if (
          auth.user?.role === "admin" ||
          auth.user?.role === "accountant"
        ) {
          // Fetch all teachers data
          const teacherData = await processTeacherSalaryData();
          setTeacherSalaryData(teacherData);
        }

        if (
          auth.user?.role === "admin" ||
          auth.user?.role === "teacher" ||
          auth.user?.role === "accountant"
        ) {
          await api.get("/class-types");
        }
      } catch (error: any) {
        console.error("Error fetching data:", error);
        handleApiError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, auth.user]);

  // Handler to reset date filters and reload data
  const handleDateReset = () => {
    console.log("Resetting date range");
    setDateRange([null, null]);
    // Force loading state to true to provide visual feedback
    setLoading(true);
  };

  useEffect(() => {
    const fetchData = async () => {
      // Set loading state to true when fetching with date filter
      setLoading(true);
      try {
        // Format date as ISO string for backend compatibility but preserve local date
        const data: any = {};

        if (dateRange && dateRange[0]) {
          // Start date should be at the beginning of the day (00:00:00) in local time
          // Use format() to get YYYY-MM-DD in local timezone, then create a new date to avoid timezone shift
          const startDateStr = dateRange[0].format("YYYY-MM-DD");
          data.start_date = `${startDateStr}T00:00:00.000Z`;
          console.log(
            `Using local date for start: ${startDateStr} -> ${data.start_date}`,
          );
        }

        if (dateRange && dateRange[1]) {
          // End date should be at the end of the day (23:59:59) in local time
          // Use format() to get YYYY-MM-DD in local timezone, then create a new date to avoid timezone shift
          const endDateStr = dateRange[1].format("YYYY-MM-DD");
          data.end_date = `${endDateStr}T23:59:59.999Z`;
          console.log(
            `Using local date for end: ${endDateStr} -> ${data.end_date}`,
          );
        }

        // Log date range for debugging
        console.log("Filtering with date range:", data);

        // Skip filtering if both dates are null
        if (!data.start_date && !data.end_date) {
          console.log("No date range specified, loading without filters");
        }

        // Also refresh class state data with new date range
        let studentClassStats: ClassState[] = [];
        let lessonsData: LessonData[] = [];
        let hasLessonData = false;

        // Fetch lesson data with date range
        try {
          // Only send date params if they exist
          const params = data.start_date && data.end_date ? data : {};
          console.log("Requesting lessons with params:", params);

          const lessonsRes = await api.get("/lessons", {
            params: params,
          });
          console.log("Lessons response:", lessonsRes);

          lessonsData = lessonsRes.data || [];
          hasLessonData = Array.isArray(lessonsData) && lessonsData.length > 0;
          console.log(`Retrieved ${lessonsData.length} lessons`);

          // Apply client-side date filtering only if we didn't provide server-side params
          // This avoids double filtering which could lead to counting inconsistencies
          if (
            data.start_date &&
            data.end_date &&
            !params.start_date &&
            !params.end_date &&
            lessonsData.length > 0
          ) {
            console.log("Applying client-side date filtering to lessons");
            logCounter = 0; // Reset log counter
            const filteredLessons = lessonsData.filter((lesson) =>
              isDateInRangeWithDebug(
                lesson.lesson_date,
                data.start_date,
                data.end_date,
              ),
            );

            console.log(
              `Filtered from ${lessonsData.length} to ${filteredLessons.length} lessons`,
            );
            lessonsData = filteredLessons;
            hasLessonData = filteredLessons.length > 0;
          }
        } catch (error) {
          console.error("Error fetching lessons:", error);
          lessonsData = [];
          hasLessonData = false;
        }

        // Refresh student class stats if needed
        if (auth.user?.role === "student") {
          // Only send date params if they exist
          const params = data.start_date && data.end_date ? data : {};
          const res = await api.get(`/students/${auth.user.id}/class-stats`, {
            params,
          });
          const processedData = Array.isArray(res.data) ? res.data : [res.data];
          studentClassStats = processedData.map((item) => ({
            ...item,
            id: auth.user?.id,
            classes_taken: hasLessonData
              ? calculateClassesTaken(lessonsData, auth.user?.id || "")
              : getFallbackClassesTaken(item),
          }));
          setStateTypeData(studentClassStats);
        } else if (
          auth.user?.role === "admin" ||
          auth.user?.role === "manager" ||
          auth.user?.role === "accountant"
        ) {
          // Only send date params if they exist
          const params = data.start_date && data.end_date ? data : {};
          const res = await api.get("/students/class-stats", { params });
          const processedData = Array.isArray(res.data) ? res.data : [];
          studentClassStats = processedData.map((item) => ({
            ...item,
            classes_taken: hasLessonData
              ? calculateClassesTaken(lessonsData, item.id || "")
              : getFallbackClassesTaken(item),
          }));
          setStateTypeData(studentClassStats);
        }

        // Teacher salary data fetching
        if (auth.user?.role === "teacher") {
          // Only pass date params if they exist
          const dateParams =
            data.start_date && data.end_date ? data : undefined;
          console.log("Fetching teacher salary with date params:", dateParams);

          // Only fetch specific teacher's salary data
          const teacherData = await processTeacherSalaryData(
            auth.user.id,
            dateParams,
          );
          console.log("Updated teacher salary data:", teacherData);
          setTeacherSalaryData(teacherData);
        } else if (
          auth.user?.role === "admin" ||
          auth.user?.role === "accountant"
        ) {
          // Only pass date params if they exist
          const dateParams =
            data.start_date && data.end_date ? data : undefined;
          console.log(
            "Fetching all teachers' salary with date params:",
            dateParams,
          );

          // Fetch all teachers data
          const teacherData = await processTeacherSalaryData(
            undefined,
            dateParams,
          );
          console.log("Updated teacher salary data:", teacherData);
          setTeacherSalaryData(teacherData);
        }
      } catch (error: any) {
        console.error("Error fetching salary data:", error);
        handleApiError(error);
      } finally {
        // Ensure loading state is set to false when finished
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, auth.user]);

  const handleApiError = (error: any) => {
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem("token");
        toast.error("Session expired. Please login again.", { theme: "dark" });
        navigate("/");
      } else {
        toast.error("Please try again.", { theme: "dark" });
      }
    } else {
      toast.error("Network error. Please check your connection.", {
        theme: "dark",
      });
    }
  };

  // ✅ Function to Download CSV File
  const downloadCSV = () => {
    if (teacherSalaryData.length === 0) {
      toast.error("No data available to download.", { theme: "dark" });
      return;
    }

    // Convert teacher salary data to CSV format
    const csvData = teacherSalaryData.map((teacher) => {
      let row: any = {
        "Teacher Name": teacher.name,
      };

      // Add columns for each type-status combo
      CLASS_TYPE_STATUS_COMBOS.forEach((combo) => {
        // Find matching stat from class_type_stats
        const classStat = teacher?.class_type_stats?.find(
          (stat: any) =>
            stat.class_type === combo.type && stat.status === combo.status,
        );

        // Format as "count ($amount)" or "0 ($0.00)"
        const classCount = classStat?.total_classes_taught || 0;
        const salaryAmount = parseFloat(classStat?.total_salary || "0").toFixed(
          2,
        );
        row[combo.display] = `${classCount} (${salaryAmount})`;
      });

      // Add total salary with proper currency formatting
      const totalSalary =
        teacher?.class_type_stats?.reduce(
          (sum: number, stat: any) =>
            sum + parseFloat(stat.total_salary || "0"),
          0,
        ) || 0;

      row["Total Salary"] = `${totalSalary.toFixed(2)}`;

      return row;
    });

    // Convert to CSV string
    const csv = Papa.unparse(csvData);

    // Create a blob and trigger the download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "teacher_salaries.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const classStateColumns: TableColumnsType<ClassState> = [
    {
      title: "No",
      key: "index",
      width: "10%",
      fixed: "left",
      render: (_: any, __: any, index: number) => (
        <span className="text-gray-600 dark:text-gray-400">{index + 1}</span>
      ),
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      fixed: "left",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text: string) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {text}
        </span>
      ),
    },
    {
      title: "Classes Paid",
      dataIndex: "total_classes",
      key: "total_classes",
      sorter: (a, b) => a.total_classes - b.total_classes,
      render: (value: number) => (
        <span className="font-medium text-blue-600 dark:text-blue-400">
          {value}
        </span>
      ),
    },
    {
      title: "Classes Taken",
      dataIndex: "classes_taken",
      key: "classes_taken",
      sorter: (a, b) => (a.classes_taken || 0) - (b.classes_taken || 0),
      render: (value: number) => (
        <span className="font-medium text-green-600 dark:text-green-400">
          {value || 0}
        </span>
      ),
    },
    {
      title: "Classes Left",
      dataIndex: "unpaid_classes",
      key: "unpaid_classes",
      sorter: (a, b) => a.unpaid_classes - b.unpaid_classes,
      filters: [
        { text: "Negative Balance", value: "negative" },
        { text: "No Classes Left", value: "zero" },
        { text: "One Class Left", value: "one" },
        { text: "Multiple Classes", value: "multiple" },
      ],
      onFilter: (value, record) => {
        switch (value) {
          case "negative":
            return record.unpaid_classes < 0;
          case "zero":
            return record.unpaid_classes === 0;
          case "one":
            return record.unpaid_classes === 1;
          case "multiple":
            return record.unpaid_classes > 1;
          default:
            return true;
        }
      },
      render: (_, record) => {
        const classesLeft = record.total_classes - (record.classes_taken || 0);
        return {
          props: {
            style: {
              color:
                classesLeft <= 0
                  ? "#ef4444"
                  : classesLeft === 1
                    ? "#eab308"
                    : "#22c55e",
            },
          },
          children: <span className="font-medium">{classesLeft}</span>,
        };
      },
    },
  ];

  const teacherSalaryColumns: TableColumnsType<TeacherSalary> = [
    {
      title: "No",
      key: "index",
      width: "10%",
      fixed: "left",
      render: (_: any, __: any, index: number) => (
        <span className="text-gray-600 dark:text-gray-400">{index + 1}</span>
      ),
    },
    {
      title: "Name",
      dataIndex: "name",
      fixed: "left",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text: string) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {text}
        </span>
      ),
    },
    // Create columns for each type-status combination
    ...CLASS_TYPE_STATUS_COMBOS.map((combo) => ({
      title: combo.display,
      key: `${combo.type}-${combo.status}`,
      render: (_: any, record: any) => {
        // Find matching stat from class_type_stats
        const classStat = record.class_type_stats?.find(
          (stat: any) =>
            stat.class_type === combo.type && stat.status === combo.status,
        );

        // Extract and format values
        const classCount = classStat?.total_classes_taught || 0;
        const salaryAmount = parseFloat(classStat?.total_salary || "0").toFixed(
          2,
        );

        // Determine text color based on status (make No show teacher red)
        const textColorClass =
          combo.status === "No show teacher"
            ? "text-red-600 dark:text-red-400"
            : "text-gray-700 dark:text-gray-300";

        // If no classes for this combination, show lighter text
        const opacityClass = classCount === 0 ? "opacity-50" : "";

        return (
          <span className={`font-medium ${textColorClass} ${opacityClass}`}>
            {classCount} (${salaryAmount})
          </span>
        );
      },
    })),
    {
      title: "Total",
      key: "total",
      render: (_, record) => {
        // Calculate total from all class_type_stats
        const totalSalary =
          record.class_type_stats?.reduce(
            (sum, stat) => sum + parseFloat(stat.total_salary || "0"),
            0,
          ) || 0;

        return (
          <span className="font-medium text-blue-600 dark:text-blue-400">
            ${totalSalary.toFixed(2)}
          </span>
        );
      },
      sorter: (a, b) => {
        const totalA =
          a.class_type_stats?.reduce(
            (sum, stat) => sum + parseFloat(stat.total_salary || "0"),
            0,
          ) || 0;
        const totalB =
          b.class_type_stats?.reduce(
            (sum, stat) => sum + parseFloat(stat.total_salary || "0"),
            0,
          ) || 0;
        return totalA - totalB;
      },
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex w-full flex-col gap-4 overflow-y-auto p-3 md:gap-6 md:p-6"
    >
      {/* Header Section with Date Range and Export */}
      <div className="mb-2 flex flex-col items-start justify-between gap-3 rounded-xl bg-white p-3 shadow-lg dark:bg-gray-800 sm:flex-row sm:items-center md:mb-4 md:p-4">
        <div className="flex w-full flex-col items-start gap-3 xs:flex-row xs:items-center sm:w-auto">
          <RangePicker
            onChange={(dates) => {
              console.log("Date picker raw values:", dates);
              setDateRange(dates as [Dayjs | null, Dayjs | null]);
            }}
            className="w-full rounded-lg shadow-sm hover:border-blue-400 focus:border-blue-500 xs:w-auto"
            format="YYYY-MM-DD"
            allowClear={true}
            value={dateRange}
            placeholder={["Start Date", "End Date"]}
            disabled={loading}
          />
          <Button
            type="default"
            onClick={handleDateReset}
            className="w-full rounded-lg border-gray-200 font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 xs:w-auto"
            disabled={loading}
          >
            Reset
          </Button>

          {/* Loading indicator */}
          {loading && (
            <div className="ml-2 flex animate-pulse items-center text-blue-500">
              <svg
                className="mr-2 h-5 w-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              <span>Loading...</span>
            </div>
          )}
        </div>

        {/* Debug information panel - only visible when debugMode is true */}
        {debugMode && (
          <div className="mt-3 w-full rounded-lg border border-blue-300 bg-gray-100 p-2 text-xs dark:bg-gray-900">
            <h3 className="mb-1 font-bold">Debug Info:</h3>
            <p>
              Selected Start Date:{" "}
              {dateRange[0]?.format("YYYY-MM-DD HH:mm:ss") || "none"}
            </p>
            <p>
              Selected End Date:{" "}
              {dateRange[1]?.format("YYYY-MM-DD HH:mm:ss") || "none"}
            </p>
            <p>
              ISO Start Date:{" "}
              {dateRange[0]?.startOf("day").toISOString() || "none"}
            </p>
            <p>
              ISO End Date: {dateRange[1]?.endOf("day").toISOString() || "none"}
            </p>
            <div className="mt-2 rounded bg-blue-100 p-1 dark:bg-blue-900">
              <p className="font-bold">Filtered Data Counts:</p>
              <p>- Teacher Data: {teacherSalaryData.length} teachers</p>
              <p>
                - Total Classes:{" "}
                {teacherSalaryData.reduce((sum, teacher) => {
                  const totalClasses =
                    teacher.class_type_stats?.reduce(
                      (total, stat) => total + (stat.total_classes_taught || 0),
                      0,
                    ) || 0;
                  return sum + totalClasses;
                }, 0)}{" "}
                lessons
              </p>
              <p>- Student Data: {classStateData.length} students</p>
            </div>
          </div>
        )}

        {(auth.user?.role === "admin" || auth.user?.role === "accountant") && (
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative w-full sm:w-auto"
          >
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={downloadCSV}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 font-medium shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700"
            >
              Export Data
            </Button>
            <div className="absolute -bottom-1 left-0 right-0 h-1 animate-pulse rounded-full bg-blue-400/30" />
          </motion.div>
        )}
      </div>

      {/* Class State Table */}
      {(auth.user?.role === "student" ||
        auth.user?.role === "admin" ||
        auth.user?.role === "manager" ||
        auth.user?.role === "accountant") && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full overflow-hidden"
        >
          <Card
            title={
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-white">
                  Class State
                </span>
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              </div>
            }
            className="overflow-hidden rounded-xl border-0 shadow-lg transition-shadow hover:shadow-xl"
            styles={{
              header: cardStyles.header,
              body: {
                ...cardStyles.body,
                padding: "0px", // Remove padding for better mobile experience
                overflow: "auto",
              },
            }}
          >
            <div className="w-full overflow-x-auto">
              <Table
                columns={classStateColumns}
                dataSource={classStateData.map((item, index) => ({
                  ...item,
                  key: index,
                }))}
                loading={loading}
                pagination={false}
                className="custom-table"
                scroll={{ x: "100%", y: "calc(55vh - 120px)" }}
                size="large"
                sticky
                style={{ width: "100%", minWidth: "500px" }}
              />
            </div>
          </Card>
        </motion.div>
      )}

      {/* Teacher Salary Table */}
      {(auth.user?.role === "teacher" ||
        auth.user?.role === "admin" ||
        auth.user?.role === "accountant") && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full overflow-hidden"
        >
          <Card
            title={
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-white">
                  Teacher Salary
                </span>
                <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
              </div>
            }
            className="overflow-hidden rounded-xl border-0 shadow-lg transition-shadow hover:shadow-xl"
            styles={{
              header: cardStyles.header,
              body: {
                ...cardStyles.body,
                padding: "0px", // Remove padding for better mobile experience
                overflow: "auto",
              },
            }}
          >
            <div className="w-full overflow-x-auto">
              <Table
                columns={teacherSalaryColumns}
                dataSource={teacherSalaryData.map((item, index) => ({
                  ...item,
                  key: index,
                }))}
                loading={loading}
                pagination={false}
                className="custom-table"
                scroll={{ x: "max-content", y: "calc(55vh - 120px)" }}
                size="small"
                bordered
                sticky
                style={{ width: "100%", minWidth: "800px" }}
                summary={(pageData) => {
                  // Calculate totals for each column
                  if (pageData.length === 0) return null;

                  // Initialize totals tracking object
                  const totals: {
                    [key: string]: { classes: number; salary: number };
                  } = {};

                  // Initialize totals for each class type/status combo
                  CLASS_TYPE_STATUS_COMBOS.forEach((combo) => {
                    const key = `${combo.type}-${combo.status}`;
                    totals[key] = { classes: 0, salary: 0 };
                  });

                  // Add a total column
                  totals["total"] = { classes: 0, salary: 0 };

                  // Calculate totals with extra validation to avoid double-counting
                  pageData.forEach((teacher) => {
                    if (!teacher.class_type_stats) return;

                    // Track processed keys to avoid duplicates
                    const processedKeys = new Set<string>();

                    teacher.class_type_stats.forEach((stat) => {
                      if (!stat.class_type || !stat.status) return;

                      const key = `${stat.class_type}-${stat.status}`;
                      // Skip if we already processed this combination for this teacher
                      if (processedKeys.has(key)) return;
                      processedKeys.add(key);

                      if (totals[key]) {
                        const classCount = stat.total_classes_taught || 0;
                        const salary = parseFloat(stat.total_salary || "0");

                        totals[key].classes += classCount;
                        totals[key].salary += salary;

                        // Also add to total
                        totals["total"].salary += salary;
                        totals["total"].classes += classCount;
                      }
                    });
                  });

                  return (
                    <Table.Summary fixed>
                      <Table.Summary.Row>
                        <Table.Summary.Cell
                          index={0}
                          colSpan={2}
                          className="bg-gray-100 font-bold dark:bg-gray-800"
                        >
                          Total
                        </Table.Summary.Cell>

                        {/* Add summary cells for each class type/status combo */}
                        {CLASS_TYPE_STATUS_COMBOS.map((combo, index) => {
                          const key = `${combo.type}-${combo.status}`;
                          const total = totals[key];
                          const textColorClass =
                            combo.status === "No show teacher"
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-700 dark:text-gray-300";

                          return (
                            <Table.Summary.Cell
                              key={index + 2}
                              index={index + 2}
                              className="bg-gray-100 dark:bg-gray-800"
                            >
                              <span className={`font-medium ${textColorClass}`}>
                                {total.classes} (${total.salary.toFixed(2)})
                              </span>
                            </Table.Summary.Cell>
                          );
                        })}

                        {/* Add total salary cell */}
                        <Table.Summary.Cell
                          index={CLASS_TYPE_STATUS_COMBOS.length + 2}
                          className="bg-gray-100 font-bold dark:bg-gray-800"
                        >
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            ${totals["total"].salary.toFixed(2)}
                          </span>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  );
                }}
              />
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
