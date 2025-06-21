import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../config";
import "./ClassesPage.css";
import { Table, Button, Spin, Card, Checkbox, Space, Modal } from "antd";
import type { TableColumnsType } from "antd";
import {
  LoadingOutlined,
  FilterOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { useTimezone } from "../../contexts/TimezoneContext";
import { DEFAULT_DB_TIMEZONE } from "../../utils/timezone";
import "../../pages/home/dashboard.css";
import { motion } from "framer-motion";
import AddEditClassModal from "./AddEditClassModal";
import { calendarApi } from "../../api/calendar";
import { toast } from "react-toastify";

dayjs.extend(utc);
dayjs.extend(timezone);

// Card styles exactly like dashboard
const cardStyles = {
  header: {
    background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
    borderRadius: "12px 12px 0 0",
    padding: "12px 16px",
    border: "none",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    "@media (minWidth: 640px)": {
      padding: "16px 24px",
    },
  },
  body: {
    padding: "10px",
    borderRadius: "0 0 12px 12px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    height: "auto",
    maxHeight: "80vh",
    "@media (minWidth: 640px)": {
      padding: "20px",
    },
  },
};

interface Teacher {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
}

interface Class {
  id: string;
  studentId: string;
  teacherId: string;
  studentName: string;
  teacherName: string;
  date: string;
  status: string;
  time: string;
  type: string;
  fullDateTime: Date;
}

interface CalendarEvent {
  id?: string;
  name?: string;
  student_name?: string;
  startDate?: string;
  date?: string;
  class_status?: string;
  status?: string;
  time?: string;
  class_type?: string;
  type?: string;
  teacher_id?: string;
  student_id?: string;
  teacher_name?: string;
  teacherId?: string;
  studentId?: string;
  teacherName?: string;
  studentName?: string;
  resourceId?: string;
  student_name_text?: string;
}

export default function ClassesPage() {
  const navigate = useNavigate();
  const { timezone } = useTimezone();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Refs для контролю синхронізації
  const lastUpdateRef = useRef<number>(0);
  const isUpdatingRef = useRef<boolean>(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTeachers = async () => {
    try {
      console.log("Fetching teachers...");
      const response = await api.get("/teachers");
      const data = response.data;
      console.log("Teachers API response:", data);

      const mappedTeachers = data.map((t: any) => ({
        id: t.id.toString(),
        name: `${t.first_name} ${t.last_name}`,
      }));
      console.log("Mapped teachers:", mappedTeachers);
      setTeachers(mappedTeachers);
    } catch (err) {
      console.error("Error loading teachers:", err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      setTeachers([]);
    }
  };

  const fetchStudents = async () => {
    try {
      console.log("Fetching students...");
      const response = await api.get("/students");
      const data = response.data;
      console.log("Students API response:", data);

      const mappedStudents = data.map((s: any) => ({
        id: s.id.toString(),
        name: `${s.first_name} ${s.last_name}`,
      }));
      console.log("Mapped students:", mappedStudents);
      setStudents(mappedStudents);
    } catch (err) {
      console.error("Error loading students:", err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      setStudents([]);
    }
  };

  const fetchClasses = useCallback(
    async (forceRefresh = false) => {
      // Запобігаємо одночасним оновленням
      if (isUpdatingRef.current && !forceRefresh) {
        console.log("⏳ Update already in progress, skipping");
        return;
      }

      const currentTime = Date.now();
      const timeSinceLastUpdate = currentTime - lastUpdateRef.current;

      // Не оновлюємо частіше ніж раз на 2 секунди (крім примусового оновлення)
      if (timeSinceLastUpdate < 2000 && !forceRefresh) {
        console.log("⏳ Too soon since last update, skipping");
        return;
      }

      console.log("🚀 fetchClasses called at:", new Date().toISOString());
      try {
        isUpdatingRef.current = true;
        setLoading(true);
        console.log("Fetching classes...");

        const response = await api.get("/calendar/events");
        console.log("Raw API response data:", response.data);

        const events = response.data.events?.rows || [];
        console.log("Events array:", events);

        if (!Array.isArray(events)) {
          console.error("Events is not an array:", events);
          setError("Invalid data format received");
          return;
        }

        if (events.length === 0) {
          console.log("No events received");
          setClasses([]);
          return;
        }

        console.log(`Total events received from server: ${events.length}`);
        console.log("Current teachers state:", teachers);
        console.log("Current students state:", students);
        console.log("🔄 Processing events for classes page...");

        const mapped = events
          .map((event: any) => {
            console.log("Processing event:", event);
            console.log("Event fields:", Object.keys(event));

            const teacherId =
              event.teacher_id || event.teacherId || event.resourceId;
            const teacherName = teachers.find(
              (t) => t.id === teacherId?.toString()
            )?.name;
            console.log(
              "Found teacher name:",
              teacherName,
              "for teacherId:",
              teacherId
            );

            // Convert date to user timezone for display (without double conversion)
            const startDate = event.startDate
              ? dayjs.utc(event.startDate)
              : null;
            const endDate = event.endDate ? dayjs.utc(event.endDate) : null;

            console.log(`Processing event ${event.id}:`, {
              originalStartDate: event.startDate,
              originalEndDate: event.endDate,
              parsedStartDate: startDate?.format("YYYY-MM-DD HH:mm:ss"),
              parsedEndDate: endDate?.format("YYYY-MM-DD HH:mm:ss"),
              timezone: timezone,
              userTimezone: timezone,
              fullDateTimeCreated: startDate ? startDate.toDate() : null,
              rawEventData: event,
            });

            const mappedEvent = {
              id: event.id?.toString() || "",
              studentId: event.student_id || event.studentId || "",
              teacherId: teacherId?.toString() || "",
              studentName:
                event.student_name_text ||
                event.student_name ||
                event.studentName ||
                "Unknown Student",
              teacherName:
                teacherName ||
                event.teacher_name ||
                event.teacherName ||
                "Unknown Teacher",
              date: startDate?.format("YYYY-MM-DD") || "",
              status: event.class_status || event.status || "scheduled",
              time: startDate?.format("HH:mm") || "",
              type: event.class_type || event.type || "regular",
              fullDateTime: startDate ? startDate.toDate() : new Date(),
            };

            console.log("📅 Mapped event from calendar:", {
              id: mappedEvent.id,
              studentName: mappedEvent.studentName,
              teacherName: mappedEvent.teacherName,
              date: mappedEvent.date,
              time: mappedEvent.time,
              status: mappedEvent.status,
              type: mappedEvent.type,
            });

            return mappedEvent;
          })
          .filter((event: any) => {
            const status = event.status?.toLowerCase();
            const classType = event.type?.toLowerCase();

            console.log(
              `Filtering event ${event.id}: status="${status}" (original: "${event.status}"), type="${classType}"`
            );

            const shouldInclude =
              status !== "unavailable" &&
              status !== "scheduled" &&
              classType !== "unavailable" &&
              classType !== "unavailable-lesson";

            if (!shouldInclude) {
              console.log(
                `❌ Excluding event ${event.id} due to status "${status}" or type "${classType}"`
              );
            } else {
              console.log(
                `✅ Including event ${event.id} with status "${status}" and type "${classType}"`
              );
            }

            return shouldInclude;
          })
          .sort((a: any, b: any) => {
            const aDate = dayjs.utc(a.fullDateTime);
            const bDate = dayjs.utc(b.fullDateTime);

            let aTime = aDate.valueOf();
            let bTime = bDate.valueOf();

            if (isNaN(aTime) || aTime === 0) {
              const aDateTimeStr = `${a.date} ${a.time}`;
              aTime = dayjs.utc(aDateTimeStr).valueOf();
              console.log(`Fallback for A: ${aDateTimeStr} -> ${aTime}`);
            }

            if (isNaN(bTime) || bTime === 0) {
              const bDateTimeStr = `${b.date} ${b.time}`;
              bTime = dayjs.utc(bDateTimeStr).valueOf();
              console.log(`Fallback for B: ${bDateTimeStr} -> ${bTime}`);
            }

            console.log(
              `Sorting: ${a.date} ${a.time} (${aTime}) vs ${b.date} ${b.time} (${bTime})`
            );

            return bTime - aTime;
          });

        console.log(`Events after filtering: ${mapped.length}`);
        console.log("Final mapped events:", mapped);

        const uniqueStatuses = [
          ...new Set(mapped.map((event) => event.status)),
        ];
        console.log("🔍 All unique statuses in data:", uniqueStatuses);

        const uniqueTypes = [...new Set(mapped.map((event) => event.type))];
        console.log("🔍 All unique class types in data:", uniqueTypes);

        const trialRecords = mapped.filter((event) =>
          event.type.includes("Trial")
        );
        console.log("🔍 All Trial records:", trialRecords);

        console.log(
          "🔍 All records with types:",
          mapped.map((event) => ({
            id: event.id,
            type: event.type,
            studentName: event.studentName,
          }))
        );

        console.log("✅ Classes page synchronization completed");

        const isSortedCorrectly = mapped.every((event, index) => {
          if (index === 0) return true;
          const currentTime = dayjs.utc(event.fullDateTime).valueOf();
          const previousTime = dayjs
            .utc(mapped[index - 1].fullDateTime)
            .valueOf();
          return currentTime <= previousTime;
        });

        console.log(
          "Sorting verification:",
          isSortedCorrectly ? "✅ Correct" : "❌ Incorrect"
        );

        setClasses(mapped);
        setError(null);
        lastUpdateRef.current = currentTime;

        console.log("✅ Classes data updated successfully");

        if (forceRefresh) {
          toast.success("Data synchronized successfully!", {
            theme: "dark",
          });
        }
      } catch (err) {
        console.error("Error fetching classes:", err);
        if (err.response) {
          console.error("Error response:", err.response);
          console.error("Error status:", err.response.status);
          console.error("Error data:", err.response.data);
        }
        setError("Failed to fetch classes");
      } finally {
        setLoading(false);
        isUpdatingRef.current = false;
      }
    },
    [teachers, students, timezone]
  );

  // Функція для сповіщення календаря про зміни
  const notifyCalendarUpdate = useCallback(() => {
    console.log("📢 Notifying calendar about class page updates");
    localStorage.setItem("calendarEventsUpdated", Date.now().toString());
    window.dispatchEvent(new Event("calendarUpdate"));
  }, []);

  // Покращена функція для обробки оновлень
  const handleDataUpdate = useCallback(
    async (force = false) => {
      if (updateTimeoutRef.current && !force) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(
        async () => {
          console.log("🔄 Handling data update...");
          setIsSyncing(true);
          try {
            await fetchClasses(true);
            console.log("✅ Data update completed successfully");
          } catch (error) {
            console.error("❌ Data update failed:", error);
            toast.error("Failed to sync data. Please try again.", {
              theme: "dark",
            });
          } finally {
            setIsSyncing(false);
          }
        },
        force ? 0 : 500
      );
    },
    [fetchClasses]
  );

  // First load teachers and students
  useEffect(() => {
    console.log("Initial effect running - loading teachers and students");
    const loadData = async () => {
      await fetchTeachers();
      await fetchStudents();
    };
    loadData();
  }, []);

  // Then load classes when teachers are available
  useEffect(() => {
    console.log("Teachers effect running", {
      teachersLength: teachers.length,
      studentsLength: students.length,
    });
    if (teachers.length > 0 && students.length > 0) {
      console.log("Both teachers and students loaded, fetching classes");
      fetchClasses(true);
    }
  }, [teachers, students, fetchClasses]);

  // Покращена синхронізація з календарем
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "calendarEventsUpdated" && e.newValue) {
        console.log("🔄 Calendar update detected via storage");
        handleDataUpdate();
      }
    };

    const handleCustomEvent = () => {
      console.log("🔄 Calendar update detected via custom event");
      handleDataUpdate();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("🔄 Page became visible, checking for updates");
        handleDataUpdate();
      }
    };

    // Перевіряємо оновлення кожні 5 секунд
    const interval = setInterval(() => {
      const lastUpdate = localStorage.getItem("calendarEventsUpdated");
      if (lastUpdate) {
        const lastUpdateTime = parseInt(lastUpdate);
        const currentTime = Date.now();
        const timeDiff = currentTime - lastUpdateTime;

        if (timeDiff < 60000) {
          // 60 секунд
          console.log("🔄 Recent calendar update detected");
          handleDataUpdate();
          localStorage.removeItem("calendarEventsUpdated");
        }
      }
    }, 5000); // 5 секунд

    // Автоматичне оновлення кожні 30 секунд
    const autoRefreshInterval = setInterval(() => {
      console.log("🔄 Auto-refresh triggered");
      handleDataUpdate();
    }, 30000); // 30 секунд

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("calendarUpdate", handleCustomEvent);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("calendarUpdate", handleCustomEvent);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
      clearInterval(autoRefreshInterval);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [handleDataUpdate]);

  const handleOpenModal = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingClass(null);
  };

  const handleDeleteClass = async (classId: string) => {
    try {
      console.log("Attempting to delete class with ID:", classId);

      const response = await calendarApi.deleteCalendarEvent(classId);

      if (response) {
        console.log("Deleted class:", response);

        // Оновлюємо дані після видалення
        await fetchClasses(true);

        // Сповіщаємо календар про оновлення
        notifyCalendarUpdate();

        toast.success("Class deleted successfully");
      }
    } catch (err) {
      console.error("Error deleting class:", err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      toast.error("Failed to delete class");
    }
  };

  const handleEditClass = (classId: string) => {
    const classToEdit = classes.find((cls) => cls.id === classId);
    console.log("Editing class:", classToEdit);
    console.log("Class ID:", classId);
    if (classToEdit) {
      setEditingClass(classToEdit);
      setShowEditModal(true);
    }
  };

  const handleDownloadCSV = () => {
    // Create CSV content
    const headers = [
      "Date",
      "Time",
      "Student",
      "Teacher",
      "Class Type",
      "Status",
    ];
    const csvContent = [
      headers.join(","),
      ...classes.map((cls) =>
        [
          dayjs.utc(cls.date).format("DD.MM.YYYY"),
          cls.time,
          cls.studentName,
          cls.teacherName,
          cls.type,
          cls.status,
        ].join(",")
      ),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `classes_${dayjs.utc().format("YYYY-MM-DD")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    const date = dayjs.utc(dateString).toDate();
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Кастомна функція сортування статусів
  const sortStatuses = (a: string, b: string) => {
    const getStatusOrder = (status: string) => {
      const normalizedStatus = status.toLowerCase().replace(/\s+/g, "");

      if (normalizedStatus.includes("given")) return 1;
      if (normalizedStatus.includes("cancelled")) return 2;
      if (
        normalizedStatus.includes("noshowstudent") ||
        normalizedStatus.includes("student")
      )
        return 3;
      if (
        normalizedStatus.includes("noshowteacher") ||
        normalizedStatus.includes("teacher")
      )
        return 4;
      if (normalizedStatus.includes("scheduled")) return 5;

      return 999;
    };

    return getStatusOrder(a) - getStatusOrder(b);
  };

  const columns: TableColumnsType<Class> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: "15%",
      render: (text: string) => (
        <span>{dayjs.utc(text).format("DD.MM.YYYY")}</span>
      ),
      sorter: (a, b) => {
        const aTime = new Date(a.fullDateTime).getTime();
        const bTime = new Date(b.fullDateTime).getTime();
        return bTime - aTime;
      },
    },
    {
      title: "Time",
      dataIndex: "time",
      key: "time",
      width: "10%",
      render: (text: string) => <span>{text}</span>,
      sorter: (a, b) => {
        const aTime = new Date(a.fullDateTime).getTime();
        const bTime = new Date(b.fullDateTime).getTime();
        return bTime - aTime;
      },
    },
    {
      title: "Student",
      dataIndex: "studentName",
      key: "studentName",
      width: "20%",
      render: (text: string) => text,
      sorter: (a, b) => a.studentName.localeCompare(b.studentName),
      filters: students.map((student) => ({
        text: student.name,
        value: student.name,
      })),
      filterMultiple: true,
      onFilter: (value, record) => {
        console.log("🔍 Student filter:", {
          value,
          recordStudentName: record.studentName,
        });
        return Array.isArray(value)
          ? value.includes(record.studentName)
          : record.studentName === value;
      },
      filterIcon: (filtered) => (
        <FilterOutlined style={{ color: filtered ? "#1890ff" : undefined }} />
      ),
    },
    {
      title: "Teacher",
      dataIndex: "teacherName",
      key: "teacherName",
      width: "15%",
      render: (text: string) => text,
      sorter: (a, b) => a.teacherName.localeCompare(b.teacherName),
      filters: teachers.map((teacher) => ({
        text: teacher.name,
        value: teacher.name,
      })),
      filterMultiple: true,
      onFilter: (value, record) => {
        return Array.isArray(value)
          ? value.includes(record.teacherName)
          : record.teacherName === value;
      },
      filterIcon: (filtered) => (
        <FilterOutlined style={{ color: filtered ? "#1890ff" : undefined }} />
      ),
    },
    {
      title: "Class Type",
      dataIndex: "type",
      key: "type",
      width: "15%",
      render: (type: string) => (
        <span style={{ textTransform: "capitalize", fontWeight: 500 }}>
          {type}
        </span>
      ),
      sorter: (a, b) => a.type.localeCompare(b.type),
      filters: [
        { text: "Group", value: "Group" },
        { text: "Instant", value: "Instant" },
        { text: "Regular", value: "Regular" },
        { text: "Trial", value: "Trial" },
      ],
      filterMultiple: true,
      onFilter: (value, record) => {
        console.log("🔍 Class Type filter:", {
          value,
          recordType: record.type,
          recordId: record.id,
          studentName: record.studentName,
        });

        if (value === "Trial") {
          const matches =
            record.type === "Trial" || record.type === "Trial-Lesson";
          console.log(
            "Trial check:",
            matches,
            "for value:",
            value,
            "and record type:",
            record.type,
            "record ID:",
            record.id
          );
          return matches;
        }

        if (value === "Regular") {
          const matches =
            record.type === "Regular" || record.type === "Regular-Lesson";
          console.log(
            "Regular check:",
            matches,
            "for value:",
            value,
            "and record type:",
            record.type
          );
          return matches;
        }

        const matches = record.type === value;
        console.log(
          "Direct match:",
          matches,
          "for value:",
          value,
          "and record type:",
          record.type
        );
        return matches;
      },
      filterIcon: (filtered) => (
        <FilterOutlined style={{ color: filtered ? "#1890ff" : undefined }} />
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: "15%",
      render: (status: string) => (
        <span style={{ fontWeight: 600 }}>{status || ""}</span>
      ),
      sorter: (a, b) => sortStatuses(a.status, b.status),
      filters: [
        { text: "Given", value: "given" },
        { text: "Cancelled", value: "cancelled" },
        { text: "Student No Show", value: "student" },
        { text: "Teacher No Show", value: "teacher" },
        { text: "Scheduled", value: "scheduled" },
      ],
      filterMultiple: true,
      onFilter: (value, record) => {
        const normalizedValue = String(value).toLowerCase().replace(/\s+/g, "");
        const normalizedStatus = record.status
          .toLowerCase()
          .replace(/\s+/g, "");

        if (normalizedValue === "student") {
          return normalizedStatus.includes("student");
        }
        if (normalizedValue === "teacher") {
          return normalizedStatus.includes("teacher");
        }

        return normalizedStatus.includes(normalizedValue);
      },
      filterIcon: (filtered) => (
        <FilterOutlined style={{ color: filtered ? "#1890ff" : undefined }} />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: "10%",
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditClass(record.id)}
            style={{ color: "white" }}
          />
          <Button
            type="text"
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteClass(record.id)}
            style={{ color: "#ef4444" }}
          />
        </Space>
      ),
    },
  ];

  const antIcon = <LoadingOutlined style={{ fontSize: 40 }} spin />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex w-full flex-col gap-4 overflow-y-auto p-3 md:gap-6 md:p-6"
    >
      {/* Classes Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full overflow-hidden"
      >
        <Card
          title={
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-white">
                  Classes List
                </span>
                <div
                  className={`size-2 rounded-full transition-colors ${
                    isSyncing ? "animate-pulse bg-yellow-400" : "bg-green-400"
                  }`}
                />
                {isSyncing && (
                  <span className="text-sm text-yellow-400 animate-pulse">
                    Syncing...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="default"
                  onClick={handleDownloadCSV}
                  className="rounded-lg border-gray-600 bg-gray-700 text-white font-medium shadow-lg transition-all hover:bg-gray-600"
                >
                  Download CSV
                </Button>
                <Button
                  type="primary"
                  onClick={handleOpenModal}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 font-medium shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700"
                >
                  Create Class
                </Button>
              </div>
            </div>
          }
          className="overflow-hidden rounded-xl border-0 shadow-lg transition-shadow hover:shadow-xl"
          styles={{
            header: cardStyles.header,
            body: {
              ...cardStyles.body,
              padding: "0px",
              overflow: "auto",
            },
          }}
        >
          <div className="w-full overflow-x-auto">
            {loading ? (
              <div className="flex h-[400px] items-center justify-center">
                <Spin indicator={antIcon} tip="Loading classes..." />
              </div>
            ) : error ? (
              <div className="error">{error}</div>
            ) : (
              <>
                <Table
                  columns={columns}
                  dataSource={classes}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  className="custom-table"
                  scroll={{ x: "100%", y: "calc(55vh - 120px)" }}
                  size="large"
                  sticky
                  style={{ width: "100%", minWidth: "500px" }}
                />
              </>
            )}
          </div>
        </Card>
      </motion.div>

      {showModal && (
        <AddEditClassModal
          visible={showModal}
          onCancel={handleCloseModal}
          onSuccess={async () => {
            handleCloseModal();
            // Оновлюємо дані після створення
            await fetchClasses(true);
            // Сповіщаємо календар про оновлення
            notifyCalendarUpdate();
          }}
          editData={null}
          students={students}
          teachers={teachers}
        />
      )}

      {showEditModal && editingClass && (
        <AddEditClassModal
          visible={showEditModal}
          onCancel={() => {
            setShowEditModal(false);
            setEditingClass(null);
          }}
          onSuccess={async (updatedData) => {
            setShowEditModal(false);
            setEditingClass(null);

            // Оновлюємо локальний стан після редагування
            if (updatedData) {
              setClasses((prevClasses) =>
                prevClasses.map((cls) =>
                  cls.id === editingClass.id ? { ...cls, ...updatedData } : cls
                )
              );
            }

            // Оновлюємо дані з сервера
            await fetchClasses(true);

            // Сповіщаємо календар про оновлення
            notifyCalendarUpdate();
          }}
          editData={(() => {
            // Створюємо простий об'єкт з необхідними даними для редагування
            const editData = {
              id: editingClass.id,
              studentId: editingClass.studentId,
              teacherId: editingClass.teacherId,
              date: editingClass.date,
              time: editingClass.time,
              status: editingClass.status,
              type: editingClass.type,
            };
            console.log("Edit data for modal:", editData);
            return editData;
          })()}
          students={students}
          teachers={teachers}
        />
      )}
    </motion.div>
  );
}
