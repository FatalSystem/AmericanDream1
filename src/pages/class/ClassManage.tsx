import React, { useState, useEffect } from "react";
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
import moment from "moment";

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

const CLASS_STATUS_OPTIONS = [
  { value: "", label: "Select Class Status" },
  { value: "Given", label: "Given" },
  { value: "No show student", label: "No show student" },
  { value: "No show teacher", label: "No show teacher (Manager Only)" },
  { value: "Cancelled", label: "Cancelled" },
];

// Gerçek class type ID'leri - sadece bunları göster
const VALID_CLASS_TYPE_IDS = [1, 2, 3]; // Trial-Lesson, Regular-Lesson, Training

// Add function to check if user has access to Training type
const hasTrainingAccess = () => {
  const userRole = localStorage.getItem("role");
  return userRole === "accountant" || userRole === "super_admin";
};

const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case "completed":
    case "given":
      return "text-green-600";
    case "cancelled":
      return "text-red-600";
    case "no_show_student":
    case "no show student":
      return "text-yellow-600";
    case "no_show_teacher":
    case "no show teacher":
      return "text-red-600";
    case "scheduled":
      return "text-blue-600";
    default:
      return "text-gray-600";
  }
};

const ClassManage: React.FC = () => {
  const navigate = useNavigate();
  const { permissions, loading_1 } = usePermissions("/class/manage");
  const auth = useAuth();
  const { timezone } = useTimezone();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
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
    auth.user?.role?.role_name === "manager" ||
    auth.user?.role?.role_name === "admin";

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
      console.log("Starting to fetch classes data...");

      const [lessonsRes, studentsRes, teachersRes, classTypesRes] =
        await Promise.all([
          api.get("/lessons"),
          api.get("/students"),
          api.get("/teachers"),
          api.get("/class-types"),
        ]);

      // Debug the API response for lessons
      console.log("Raw lessons response:", lessonsRes);
      console.log("Lessons response data:", lessonsRes.data);

      // Try different possible data structures
      let lessonsData = [];
      if (Array.isArray(lessonsRes.data)) {
        lessonsData = lessonsRes.data;
      } else if (lessonsRes.data && Array.isArray(lessonsRes.data.lessons)) {
        lessonsData = lessonsRes.data.lessons;
      } else if (lessonsRes.data && Array.isArray(lessonsRes.data.data)) {
        lessonsData = lessonsRes.data.data;
      } else if (lessonsRes.data && Array.isArray(lessonsRes.data.rows)) {
        lessonsData = lessonsRes.data.rows;
      } else {
        console.warn("Unexpected lessons data structure:", lessonsRes.data);
        lessonsData = [];
      }

      console.log(
        "Processed lessons data:",
        JSON.stringify(lessonsData, null, 2)
      );
      console.log("Lessons count:", lessonsData.length);

      // Show detailed debug of first lesson
      if (lessonsData.length > 0) {
        const firstLesson = lessonsData[0];
        console.log("First lesson details:", {
          id: firstLesson.id,
          date: firstLesson.lesson_date,
          start_time: firstLesson.start_time,
          end_time: firstLesson.end_time,
          start_time_type: typeof firstLesson.start_time,
          student: firstLesson.Student
            ? `${firstLesson.Student.first_name} ${firstLesson.Student.last_name}`
            : "No student data",
          teacher: firstLesson.Teacher
            ? `${firstLesson.Teacher.first_name} ${firstLesson.Teacher.last_name}`
            : "No teacher data",
        });
      } else {
        console.log("No lessons data returned from API");
      }

      // Check other API responses
      const studentsData = Array.isArray(studentsRes.data)
        ? studentsRes.data
        : studentsRes.data?.students ||
          studentsRes.data?.data ||
          studentsRes.data?.rows ||
          [];
      const teachersData = Array.isArray(teachersRes.data)
        ? teachersRes.data
        : teachersRes.data?.teachers ||
          teachersRes.data?.data ||
          teachersRes.data?.rows ||
          [];
      const classTypesData = Array.isArray(classTypesRes.data)
        ? classTypesRes.data
        : classTypesRes.data?.classTypes ||
          classTypesRes.data?.data ||
          classTypesRes.data?.rows ||
          [];

      console.log("Students count:", studentsData.length);
      console.log("Teachers count:", teachersData.length);
      console.log("Class types count:", classTypesData.length);

      setLessons(lessonsData);
      setStudents(studentsData);
      setTeachers(teachersData);
      setClassTypes(classTypesData);

      setLoading(false);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      handleApiError(error);
      setLoading(false);
    }
  };

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

    // Check if trying to create Training class without permission
    const selectedType = classTypes.find(
      (ct) => ct.id === parseInt(selectedClassType)
    );
    if (selectedType?.name === "Training" && !hasTrainingAccess()) {
      toast.error("You don't have permission to create Training classes.", {
        theme: "dark",
      });
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

      setLessons([...res.data.lessons]);

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
    } catch (error: any) {
      console.error("Error creating lesson:", error);
      handleApiError(error);
    }
  };

  const deleteLesson = async (id: number) => {
    try {
      // Find the lesson to check if it's a Training type
      const lessonToDelete = lessons.find((lesson) => lesson.id === id);
      if (
        lessonToDelete?.class_type.name === "Training" &&
        !hasTrainingAccess()
      ) {
        toast.error("You don't have permission to delete Training classes.", {
          theme: "dark",
        });
        return;
      }

      await api.delete(`/lessons/${id}`);
      setLessons((prevLessons) =>
        prevLessons.filter((lesson) => lesson.id !== id)
      );
      toast.success("Lesson deleted successfully!", { theme: "dark" });
    } catch (error: any) {
      handleApiError(error);
    }
  };

  const openEditLesson = (lesson: Lesson) => {
    // Check if trying to edit Training class without permission
    if (lesson.class_type.name === "Training" && !hasTrainingAccess()) {
      toast.error("You don't have permission to edit Training classes.", {
        theme: "dark",
      });
      return;
    }

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
          timezone
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
          timezone
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

    // Check if trying to update to Training class without permission
    const selectedType = classTypes.find(
      (ct) => ct.id === parseInt(selectedClassType)
    );
    if (selectedType?.name === "Training" && !hasTrainingAccess()) {
      toast.error("You don't have permission to update to Training classes.", {
        theme: "dark",
      });
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

      console.log("Updating lesson with data:", lessonWithTime);
      const res = await api.put(
        `/lessons/${selectedLesson.id}`,
        lessonWithTime
      );

      setLessons([...res.data.lessons]);

      setOpenEditModal(false);
      setSelectedLesson(null);
      toast.success("Lesson updated successfully!", { theme: "dark" });
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

  const downloadCSV = () => {
    if (lessons.length === 0) {
      toast.error("No class data available to download.", { theme: "dark" });
      return;
    }

    // Convert lessons data to CSV format
    const csvData = lessons.map((lesson) => {
      // Process calendar link dates with timezone
      const startDate = lesson.CalendarLink?.startDate
        ? dayjs(lesson.CalendarLink.startDate)
            .tz(timezone)
            .format("DD.MM.YYYY HH:mm")
        : "-";
      const endDate = lesson.CalendarLink?.endDate
        ? dayjs(lesson.CalendarLink.endDate)
            .tz(timezone)
            .format("DD.MM.YYYY HH:mm")
        : "-";

      // Process start time and adjust date if needed
      let adjustedDate = lesson.lesson_date;
      let formattedStartTime = "-";
      let formattedEndTime = "-";

      if (lesson.start_time) {
        const userStartTime = convertTimeToUserTimezone(
          lesson.start_time,
          timezone
        );
        if (userStartTime) {
          formattedStartTime = formatTime(userStartTime, "HH:mm");

          // Adjust date if needed
          const dayShift = getDayShift(
            lesson.start_time,
            DEFAULT_DB_TIMEZONE,
            timezone
          );
          if (dayShift !== 0 && lesson.lesson_date) {
            adjustedDate = dayjs(lesson.lesson_date)
              .add(dayShift, "day")
              .format("YYYY-MM-DD");
          }
        }
      }

      // Process end time
      if (lesson.end_time) {
        const userEndTime = convertTimeToUserTimezone(
          lesson.end_time,
          timezone
        );
        if (userEndTime) {
          formattedEndTime = formatTime(userEndTime, "HH:mm");
        }
      }

      // Format the date in DD.MM.YYYY format
      const formattedDate = adjustedDate
        ? dayjs(adjustedDate).format("DD.MM.YYYY")
        : "-";

      return {
        "Class Date": formattedDate,
        "Start Time": formattedStartTime,
        "End Time": formattedEndTime,
        "Start Date/Time": startDate,
        "End Date/Time": endDate,
        "Student Name": `${lesson.Student.first_name} ${lesson.Student.last_name}`,
        "Teacher Name": `${lesson.Teacher.first_name} ${lesson.Teacher.last_name}`,
        "Class Type": lesson.class_type.name,
        "Class Status": lesson.class_status || "-",
        Timezone: timezone.replace(/_/g, " "),
      };
    });

    // Convert to CSV string
    const csv = Papa.unparse(csvData);

    // Create a blob and trigger the download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "class_data.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bu fonksiyon API'ye gönderilecek veriyi hazırlar
  const prepareTimeData = (
    lessonData: any,
    startTimeValue: string,
    endTimeValue: string
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
        DEFAULT_DB_TIMEZONE
      );
      if (dayShift !== 0) {
        // Adjust the date by the number of days shifted
        classDateStr = dayjs(lessonData.class_date)
          .add(dayShift, "day")
          .format("DD-MM-YYYY");
      }
    }

    return {
      ...lessonData,
      class_date: classDateStr,
      start_time: startTimeDb,
      end_time: endTimeDb,
    };
  };

  const columns: TableColumnsType<any> = [
    {
      title: "Date",
      dataIndex: "lesson_date",
      key: "lesson_date",
      width: "25%",
      sorter: (a, b) =>
        moment(a.lesson_date).unix() - moment(b.lesson_date).unix(),
      render: (text, record) => (
        <span>
          {moment(record.lesson_date).format("DD.MM.YYYY")}{" "}
          {moment(record.start_time, "HH:mm:ss").format("HH:mm")}
        </span>
      ),
    },
    {
      title: "Student",
      dataIndex: "student_name",
      key: "student_name",
      width: "25%",
      sorter: (a, b) => a.student_name.localeCompare(b.student_name),
    },
    {
      title: "Teacher",
      dataIndex: "teacher_name",
      key: "teacher_name",
      width: "25%",
      sorter: (a, b) => a.teacher_name.localeCompare(b.teacher_name),
    },
    {
      title: "Status",
      dataIndex: "class_status",
      key: "class_status",
      width: "25%",
      sorter: (a, b) => a.class_status.localeCompare(b.class_status),
      render: (text) => (
        <span className={getStatusColor(text)}>
          {text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, " ")}
        </span>
      ),
    },
  ];

  const tableData = lessons
    .filter((lesson) => {
      if (auth.user?.role?.role_name === "student") {
        return lesson.Student?.id === Number(auth.user.id);
      }
      if (auth.user?.role?.role_name === "teacher") {
        return lesson.Teacher?.id === Number(auth.user.id);
      }
      return true;
    })
    .map((lesson, index) => ({
      key: index,
      id: lesson.id,
      lesson_date: lesson.lesson_date,
      student_name: lesson.Student
        ? `${lesson.Student.first_name} ${lesson.Student.last_name}`
        : "Unknown Student",
      teacher_name: lesson.Teacher
        ? `${lesson.Teacher.first_name} ${lesson.Teacher.last_name}`
        : "Unknown Teacher",
      class_status: lesson.class_status || "",
    }));

  console.log("Filtered and mapped table data:", {
    originalLessonsCount: lessons.length,
    filteredTableDataCount: tableData.length,
    userRole: auth.user?.role,
    userId: auth.user?.id,
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
            <div className="size-2 animate-pulse rounded-full bg-green-400" />
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
        <div className="custom-table overflow-hidden rounded-lg shadow-md">
          {tableData.length === 0 && !loading ? (
            <div className="flex items-center justify-center p-8 text-gray-500">
              <div className="text-center">
                <p className="text-lg font-medium">No classes found</p>
                <p className="text-sm">
                  There are no classes available to display.
                </p>
                {auth.user?.role && (
                  <p className="mt-2 text-xs">
                    Current user role: {auth.user.role?.role_name}
                    {auth.user.id && ` (ID: ${auth.user.id})`}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Table
              style={{ width: "100%" }}
              columns={columns}
              dataSource={tableData}
              loading={loading}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
            />
          )}
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
                <div>
                  <Label htmlFor="end_time" value="End Time" />
                  <TextInput
                    id="end_time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
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
                        `${b.first_name} ${b.last_name}`
                      )
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
                        `${b.first_name} ${b.last_name}`
                      )
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
                    .filter((classType) => {
                      if (classType.name === "Training") {
                        return (
                          hasTrainingAccess() &&
                          VALID_CLASS_TYPE_IDS.includes(classType.id)
                        );
                      }
                      return VALID_CLASS_TYPE_IDS.includes(classType.id);
                    })
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
                <div>
                  <Label htmlFor="edit_end_time" value="End Time" />
                  <TextInput
                    id="edit_end_time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
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
                        `${b.first_name} ${b.last_name}`
                      )
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
                        `${b.first_name} ${b.last_name}`
                      )
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
                      VALID_CLASS_TYPE_IDS.includes(classType.id)
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
    </motion.div>
  );
};

export default ClassManage;
