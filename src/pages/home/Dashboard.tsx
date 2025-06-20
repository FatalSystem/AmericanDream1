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
    []
  );
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([
    null,
    null,
  ]);
  // Add a debug mode flag - you can turn this to true for troubleshooting
  const [debugMode] = useState(false);
  const auth = useAuth();

  // Додаємо логування для діагностики
  console.log("=== Dashboard Component ===");
  console.log("Auth user:", auth.user);
  console.log("User role:", auth.user?.role_name);
  console.log("Class state data length:", classStateData.length);
  console.log("Teacher salary data length:", teacherSalaryData.length);
  console.log("Loading state:", loading);

  // Function to calculate classes taken based on lesson data
  const calculateClassesTaken = (
    lessonData: LessonData[],
    studentId: string
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
        `Calculating classes taken for student ID ${studentId} with ${lessonData.length} lessons`
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
        `Found ${classCount} valid classes taken for student ID ${studentId}`
      );

      return classCount;
    } catch (error) {
      console.error("Error calculating classes taken:", error);
      return 0;
    }
  };

  const getFallbackClassesTaken = (item: ClassState) => {
    // Fallback calculation based on paid vs unpaid classes
    const paidClasses = item.paid_classes || 0;
    const totalClasses = item.total_classes || 0;
    return Math.min(paidClasses, totalClasses);
  };

  const fetchTeacherSalaryData = async (userId?: string, dateParams?: any) => {
    try {
      console.log("Fetching teacher salary data with params:", {
        userId,
        dateParams,
      });
      const response = await api.get("/teachers/salary", {
        params: { userId, ...dateParams },
      });
      console.log("Teacher salary API response:", response);
      return response.data || [];
    } catch (error) {
      console.error("Error fetching teacher salary data:", error);
      return [];
    }
  };

  const getTeacherRate = (
    teacher: any,
    classTypeId: number,
    classTypeName: string
  ) => {
    try {
      // Try to get rate from teacher's rates array
      if (teacher.rates && Array.isArray(teacher.rates)) {
        const rate = teacher.rates.find(
          (r: any) => r.class_type_id === classTypeId
        );
        if (rate) {
          return parseFloat(rate.rate) || 0;
        }
      }

      // Fallback to hardcoded rates based on class type
      const fallbackRates: { [key: string]: number } = {
        "Trial-Lesson": 15,
        "Regular-Lesson": 25,
        Training: 20,
        "Group-Lesson": 30,
        "Makeup-Lesson": 25,
        "Intensive-Lesson": 40,
        Workshop: 35,
        "Speaking-Club": 25,
      };

      return fallbackRates[classTypeName] || 25;
    } catch (error) {
      console.error("Error getting teacher rate:", error);
      return 25; // Default fallback
    }
  };

  const processTeacherSalaryData = async (
    userId?: string,
    dateParams?: any
  ) => {
    try {
      console.log("Processing teacher salary data with params:", {
        userId,
        dateParams,
      });

      // Fetch teachers data
      const teachersResponse = await api.get("/teachers");
      console.log("Teachers API response:", teachersResponse);
      const teachers = teachersResponse.data || [];

      // Fetch lessons data with date filtering
      const lessonsParams =
        dateParams?.start_date && dateParams?.end_date ? dateParams : {};
      console.log("Fetching lessons with params:", lessonsParams);
      const lessonsResponse = await api.get("/lessons", {
        params: lessonsParams,
      });
      console.log("Lessons for salary calculation:", lessonsResponse);
      const lessons = lessonsResponse.data || [];

      // Fetch class types
      const classTypesResponse = await api.get("/class-types");
      console.log("Class types response:", classTypesResponse);
      const classTypes = classTypesResponse.data || [];

      // Process each teacher
      const processedTeachers = teachers.map((teacher: any) => {
        // Filter lessons for this teacher
        const teacherLessons = lessons.filter((lesson: any) => {
          const lessonTeacherId = lesson.teacher_id || lesson.Teacher?.id;
          return String(lessonTeacherId) === String(teacher.id);
        });

        console.log(
          `Teacher ${teacher.first_name} ${teacher.last_name} has ${teacherLessons.length} lessons`
        );

        // Group lessons by class type and status
        const classTypeStats: { [key: string]: any } = {};

        teacherLessons.forEach((lesson: any) => {
          const classType = lesson.class_type?.name || "Unknown";
          const status = lesson.class_status || "Unknown";
          const key = `${classType}-${status}`;

          if (!classTypeStats[key]) {
            classTypeStats[key] = {
              class_type: classType,
              status: status,
              total_classes_taught: 0,
              total_salary: 0,
            };
          }

          classTypeStats[key].total_classes_taught += 1;

          // Calculate salary for this lesson
          const rate = getTeacherRate(teacher, lesson.class_type_id, classType);
          let lessonSalary = rate;

          // Apply status-based adjustments
          if (status === "No show teacher") {
            lessonSalary = -rate; // Negative salary for teacher no-show
          } else if (status === "No show student") {
            lessonSalary = rate * 0.5; // Half salary for student no-show
          }

          classTypeStats[key].total_salary += lessonSalary;
        });

        return {
          id: teacher.id,
          name: `${teacher.first_name} ${teacher.last_name}`,
          class_type_stats: Object.values(classTypeStats),
        };
      });

      console.log("Processed teacher salary data:", processedTeachers);
      return processedTeachers;
    } catch (error) {
      console.error("Error processing teacher salary data:", error);
      return [];
    }
  };

  // Helper function to check if a date is within the specified range
  const isDateInRange = (
    dateStr: string | undefined,
    startIso: string,
    endIso: string
  ): boolean => {
    if (!dateStr) return false;

    try {
      const date = new Date(dateStr);
      const start = new Date(startIso);
      const end = new Date(endIso);

      return date >= start && date <= end;
    } catch (error) {
      console.error("Error parsing date:", error);
      return false;
    }
  };

  // Enhanced version with debug logging
  let logCounter = 0;
  const isDateInRangeWithDebug = (
    dateStr: string | undefined,
    startIso: string,
    endIso: string
  ): boolean => {
    if (!dateStr) {
      if (debugMode && logCounter < 10) {
        console.log(`Date check failed: no date string`);
        logCounter++;
      }
      return false;
    }

    try {
      const date = new Date(dateStr);
      const start = new Date(startIso);
      const end = new Date(endIso);

      const isInRange = date >= start && date <= end;

      if (debugMode && logCounter < 10) {
        console.log(
          `Date check: ${dateStr} (${date.toISOString()}) between ${startIso} and ${endIso} = ${isInRange}`
        );
        logCounter++;
      }

      return isInRange;
    } catch (error) {
      if (debugMode && logCounter < 10) {
        console.error("Error parsing date:", error);
        logCounter++;
      }
      return false;
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      console.log("=== Starting fetchData ===");
      setLoading(true);
      try {
        let studentClassStats: ClassState[] = [];
        let lessonsData: LessonData[] = [];
        let hasLessonData = false;

        console.log("Fetching lessons data...");
        // Fetch lesson data
        try {
          const lessonsRes = await api.get("/lessons");
          console.log("Lessons API response:", lessonsRes);
          lessonsData = lessonsRes.data || [];
          hasLessonData = Array.isArray(lessonsData) && lessonsData.length > 0;
          console.log("Lessons data processed:", {
            lessonsData,
            hasLessonData,
          });
        } catch (error) {
          console.error("Error fetching lessons:", error);
          lessonsData = []; // Continue with empty array
          hasLessonData = false;
        }

        console.log("User role for data fetching:", auth.user?.role_name);
        if (auth.user?.role_name === "student") {
          console.log("Fetching student-specific data...");
          // Only fetch specific student's data
          const res = await api.get(
            `/students/${auth.user.id.toString()}/class-stats`
          );
          console.log("Student class stats response:", res);
          // Process the data to calculate classes_taken
          const processedData = Array.isArray(res.data) ? res.data : [res.data];
          studentClassStats = processedData.map((item) => ({
            ...item,
            id: auth.user?.id.toString(),
            // Calculate classes_taken based on lessons data or use fallback
            classes_taken: hasLessonData
              ? calculateClassesTaken(
                  lessonsData,
                  auth.user?.id.toString() || ""
                )
              : getFallbackClassesTaken(item),
          }));
        } else if (
          auth.user?.role_name === "admin" ||
          auth.user?.role_name === "manager" ||
          auth.user?.role_name === "accountant"
        ) {
          console.log("Fetching all students data...");
          // Fetch all students data
          const res = await api.get("/students/class-stats");
          console.log("All students class stats response:", res);
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

        console.log("Setting class state data:", studentClassStats);
        setStateTypeData(studentClassStats);

        if (auth.user?.role_name === "teacher") {
          console.log("Fetching teacher-specific salary data...");
          // Only fetch specific teacher's salary data
          const teacherData = await processTeacherSalaryData(
            auth.user.id.toString()
          );
          console.log("Teacher salary data:", teacherData);
          setTeacherSalaryData(teacherData);
        } else if (
          auth.user?.role_name === "admin" ||
          auth.user?.role_name === "accountant"
        ) {
          console.log("Fetching all teachers salary data...");
          // Fetch all teachers data
          const teacherData = await processTeacherSalaryData();
          console.log("All teachers salary data:", teacherData);
          setTeacherSalaryData(teacherData);
        }

        if (
          auth.user?.role_name === "admin" ||
          auth.user?.role_name === "teacher" ||
          auth.user?.role_name === "accountant"
        ) {
          console.log("Fetching class types...");
          await api.get("/class-types");
        }
      } catch (error: any) {
        console.error("Error fetching data:", error);
        handleApiError(error);
      } finally {
        console.log("=== fetchData completed ===");
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
            `Using local date for start: ${startDateStr} -> ${data.start_date}`
          );
        }

        if (dateRange && dateRange[1]) {
          // End date should be at the end of the day (23:59:59) in local time
          // Use format() to get YYYY-MM-DD in local timezone, then create a new date to avoid timezone shift
          const endDateStr = dateRange[1].format("YYYY-MM-DD");
          data.end_date = `${endDateStr}T23:59:59.999Z`;
          console.log(
            `Using local date for end: ${endDateStr} -> ${data.end_date}`
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
                data.end_date
              )
            );

            console.log(
              `Filtered from ${lessonsData.length} to ${filteredLessons.length} lessons`
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
        if (auth.user?.role_name === "student") {
          // Only send date params if they exist
          const params = data.start_date && data.end_date ? data : {};
          const res = await api.get(
            `/students/${auth.user.id.toString()}/class-stats`,
            { params }
          );
          const processedData = Array.isArray(res.data) ? res.data : [res.data];
          studentClassStats = processedData.map((item) => ({
            ...item,
            id: auth.user?.id.toString(),
            classes_taken: hasLessonData
              ? calculateClassesTaken(
                  lessonsData,
                  auth.user?.id.toString() || ""
                )
              : getFallbackClassesTaken(item),
          }));
          setStateTypeData(studentClassStats);
        } else if (
          auth.user?.role_name === "admin" ||
          auth.user?.role_name === "manager" ||
          auth.user?.role_name === "accountant"
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
        if (auth.user?.role_name === "teacher") {
          // Only pass date params if they exist
          const dateParams =
            data.start_date && data.end_date ? data : undefined;
          const teacherData = await processTeacherSalaryData(
            auth.user.id.toString(),
            dateParams
          );
          setTeacherSalaryData(teacherData);
        } else if (
          auth.user?.role_name === "admin" ||
          auth.user?.role_name === "accountant"
        ) {
          // Only pass date params if they exist
          const dateParams =
            data.start_date && data.end_date ? data : undefined;
          const teacherData = await processTeacherSalaryData(
            undefined,
            dateParams
          );
          setTeacherSalaryData(teacherData);
        }
      } catch (error: any) {
        console.error("Error fetching data with date filter:", error);
        handleApiError(error);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if we have a date range
    if (dateRange[0] || dateRange[1]) {
      fetchData();
    }
  }, [dateRange]);

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
      const row: any = {
        "Teacher Name": teacher.name,
      };

      // Add columns for each type-status combo
      CLASS_TYPE_STATUS_COMBOS.forEach((combo) => {
        // Find matching stat from class_type_stats
        const classStat = teacher?.class_type_stats?.find(
          (stat: any) =>
            stat.class_type === combo.type && stat.status === combo.status
        );

        // Format as "count ($amount)" or "0 ($0.00)"
        const classCount = classStat?.total_classes_taught || 0;
        const salaryAmount = parseFloat(classStat?.total_salary || "0").toFixed(
          2
        );
        row[combo.display] = `${classCount} ($${salaryAmount})`;
      });

      // Add total salary with proper currency formatting
      const totalSalary =
        teacher?.class_type_stats?.reduce(
          (sum: number, stat: any) =>
            sum + parseFloat(stat.total_salary || "0"),
          0
        ) || 0;

      row["Total Salary"] = `$${totalSalary.toFixed(2)}`;

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
            stat.class_type === combo.type && stat.status === combo.status
        );

        // Extract and format values
        const classCount = classStat?.total_classes_taught || 0;
        const salaryAmount = parseFloat(classStat?.total_salary || "0").toFixed(
          2
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
            0
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
            0
          ) || 0;
        const totalB =
          b.class_type_stats?.reduce(
            (sum, stat) => sum + parseFloat(stat.total_salary || "0"),
            0
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
                className="mr-2 size-5"
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
                      0
                    ) || 0;
                  return sum + totalClasses;
                }, 0)}{" "}
                lessons
              </p>
              <p>- Student Data: {classStateData.length} students</p>
            </div>
          </div>
        )}

        {(auth.user?.role_name === "admin" ||
          auth.user?.role_name === "accountant") && (
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
            <div className="absolute inset-x-0 -bottom-1 h-1 animate-pulse rounded-full bg-blue-400/30" />
          </motion.div>
        )}
      </div>

      {/* Class State Table */}
      {(auth.user?.role_name === "student" ||
        auth.user?.role_name === "admin" ||
        auth.user?.role_name === "manager" ||
        auth.user?.role_name === "accountant") && (
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
                <div className="size-2 animate-pulse rounded-full bg-green-400" />
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
      {(auth.user?.role_name === "teacher" ||
        auth.user?.role_name === "admin" ||
        auth.user?.role_name === "accountant") && (
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
                <div className="size-2 animate-pulse rounded-full bg-blue-400" />
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
