import React, { useEffect, useState, useCallback } from "react";
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

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Fetching classes...");

      // Спочатку перевіряємо localStorage
      const localClasses = localStorage.getItem("classes");
      if (localClasses) {
        const parsedClasses = JSON.parse(localClasses);
        console.log("Found classes in localStorage:", parsedClasses);
        setClasses(parsedClasses);
        setError(null);
        setLoading(false);
        return;
      }

      // Якщо в localStorage немає даних, завантажуємо з сервера
      const response = await api.get("/calendar/events");
      console.log("Raw API response data:", response.data);

      // Get events from the correct path: response.data.events.rows
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

      const mapped = events
        .map((event: any) => {
          console.log("Processing event:", event);
          console.log("Event fields:", Object.keys(event));

          // Use teacher_id instead of resourceId for consistency with calendar
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

          // Parse date from server (treat as local time)
          const startDate = event.startDate ? dayjs(event.startDate) : null;
          const endDate = event.endDate ? dayjs(event.endDate) : null;

          console.log(`Processing event ${event.id}:`, {
            originalStartDate: event.startDate,
            parsedStartDate: startDate?.format("YYYY-MM-DD HH:mm:ss"),
            timezone: timezone,
            fullDateTimeCreated: startDate ? startDate.toDate() : null,
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
            fullDateTime: startDate ? startDate.toDate() : new Date(), // For sorting - ensure proper date object
          };
          console.log("Mapped event:", mappedEvent);
          return mappedEvent;
        })
        .filter((event: any) => {
          // Exclude events with status "Unavailable" and "Scheduled"
          const status = event.status?.toLowerCase();
          const classType = event.type?.toLowerCase();

          console.log(
            `Filtering event ${event.id}: status="${status}" (original: "${event.status}"), type="${classType}"`
          );

          const shouldInclude =
            status !== "unavailable" &&
            status !== "scheduled" &&
            classType !== "unavailable";

          if (!shouldInclude) {
            console.log(
              `❌ Excluding event ${event.id} due to status "${status}" or type "${classType}"`
            );
          } else {
            console.log(
              `✅ Including event ${event.id} with status "${status}"`
            );
          }

          return shouldInclude;
        })
        .sort((a: any, b: any) => {
          // Create proper date objects for comparison
          const aDate = new Date(a.fullDateTime);
          const bDate = new Date(b.fullDateTime);

          // If fullDateTime is not working properly, try to create date from date and time strings
          let aTime = aDate.getTime();
          let bTime = bDate.getTime();

          // Fallback: create date from date and time strings if fullDateTime is invalid
          if (isNaN(aTime) || aTime === 0) {
            const aDateTimeStr = `${a.date} ${a.time}`;
            aTime = new Date(aDateTimeStr).getTime();
            console.log(`Fallback for A: ${aDateTimeStr} -> ${aTime}`);
          }

          if (isNaN(bTime) || bTime === 0) {
            const bDateTimeStr = `${b.date} ${b.time}`;
            bTime = new Date(bDateTimeStr).getTime();
            console.log(`Fallback for B: ${bDateTimeStr} -> ${bTime}`);
          }

          console.log(
            `Sorting: ${a.date} ${a.time} (${aTime}) vs ${b.date} ${b.time} (${bTime})`
          );

          // Sort in descending order (most recent first)
          return bTime - aTime;
        });

      console.log(`Events after filtering: ${mapped.length}`);
      console.log("Final mapped events:", mapped);

      // Verify sorting is correct
      const isSortedCorrectly = mapped.every((event, index) => {
        if (index === 0) return true;
        const currentTime = new Date(event.fullDateTime).getTime();
        const previousTime = new Date(mapped[index - 1].fullDateTime).getTime();
        return currentTime <= previousTime; // Should be descending order
      });

      console.log(
        "Sorting verification:",
        isSortedCorrectly ? "✅ Correct" : "❌ Incorrect"
      );

      setClasses(mapped);
      setError(null);

      // Зберігаємо дані в localStorage
      localStorage.setItem("classes", JSON.stringify(mapped));
      console.log("Saved classes to localStorage");
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
    }
  }, [teachers, students, timezone]);

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
      fetchClasses();
    }
  }, [teachers, students, fetchClasses]);

  // Add effect to check for calendar updates
  useEffect(() => {
    const checkForUpdates = () => {
      const lastUpdate = localStorage.getItem("calendarEventsUpdated");
      if (lastUpdate) {
        const lastUpdateTime = parseInt(lastUpdate);
        const currentTime = Date.now();

        // If the update was recent (within last 5 seconds), refresh data
        if (currentTime - lastUpdateTime < 5000) {
          console.log("Calendar events updated, refreshing classes data");
          fetchClasses();
          // Clear the update flag to avoid repeated refreshes
          localStorage.removeItem("calendarEventsUpdated");
        }
      }
    };

    // Check for updates every 2 seconds
    const interval = setInterval(checkForUpdates, 2000);

    return () => clearInterval(interval);
  }, [fetchClasses]);

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

        // Clear localStorage to force refresh from server
        localStorage.removeItem("classes");

        // Refresh the classes list
        setTimeout(() => {
          fetchClasses();
        }, 1000);

        // Notify calendar component that events have been updated
        localStorage.setItem("calendarEventsUpdated", Date.now().toString());
      }
    } catch (err) {
      console.error("Error deleting class:", err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      console.error("Failed to delete class");
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
          dayjs(cls.date).format("DD.MM.YYYY"),
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
      `classes_${dayjs().format("YYYY-MM-DD")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const columns: TableColumnsType<Class> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: "15%",
      render: (text: string) => <span>{dayjs(text).format("DD.MM.YYYY")}</span>,
      sorter: (a, b) => {
        const aTime = new Date(a.fullDateTime).getTime();
        const bTime = new Date(b.fullDateTime).getTime();
        return bTime - aTime; // Descending order (newest first)
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
        return bTime - aTime; // Descending order (newest first)
      },
    },
    {
      title: "Student",
      dataIndex: "studentName",
      key: "studentName",
      width: "20%",
      render: (text: string) => text,
      sorter: (a, b) => a.studentName.localeCompare(b.studentName),
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
      }) => (
        <div className="custom-filter-dropdown">
          <div className="filter-list">
            {students
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((student) => (
                <Checkbox
                  key={student.id}
                  checked={(selectedKeys as string[]).includes(student.name)}
                  onChange={(e) => {
                    const newSelectedKeys = e.target.checked
                      ? [...selectedKeys, student.name]
                      : (selectedKeys as string[]).filter(
                          (key) => key !== student.name
                        );
                    setSelectedKeys(newSelectedKeys);
                    // Не закриваємо dropdown і не застосовуємо фільтр одразу
                  }}
                >
                  {student.name}
                </Checkbox>
              ))}
          </div>
          <div className="filter-footer">
            <Button
              type="link"
              onClick={() => {
                confirm();
              }}
              className={`reset-filter-btn ${
                (selectedKeys as string[]).length > 0 ? "ant-btn-link" : ""
              }`}
              style={{
                color:
                  (selectedKeys as string[]).length > 0 ? "#1890ff" : "#999",
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      ),
      onFilter: (value, record) => record.studentName === value,
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
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
      }) => (
        <div className="custom-filter-dropdown">
          <div className="filter-list">
            {teachers
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((teacher) => (
                <Checkbox
                  key={teacher.id}
                  checked={(selectedKeys as string[]).includes(teacher.name)}
                  onChange={(e) => {
                    const newSelectedKeys = e.target.checked
                      ? [...selectedKeys, teacher.name]
                      : (selectedKeys as string[]).filter(
                          (key) => key !== teacher.name
                        );
                    setSelectedKeys(newSelectedKeys);
                    // Не закриваємо dropdown і не застосовуємо фільтр одразу
                  }}
                >
                  {teacher.name}
                </Checkbox>
              ))}
          </div>
          <div className="filter-footer">
            <Button
              type="link"
              onClick={() => {
                confirm();
              }}
              className={`reset-filter-btn ${
                (selectedKeys as string[]).length > 0 ? "ant-btn-link" : ""
              }`}
              style={{
                color:
                  (selectedKeys as string[]).length > 0 ? "#1890ff" : "#999",
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      ),
      onFilter: (value, record) => record.teacherName === value,
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
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
      }) => (
        <div className="custom-filter-dropdown">
          <div className="filter-list">
            {[
              { text: "Group", value: "group" },
              { text: "Instant", value: "instant" },
              { text: "Regular", value: "regular" },
              { text: "Trial", value: "trial" },
            ]
              .sort((a, b) => a.text.localeCompare(b.text))
              .map((classType) => (
                <Checkbox
                  key={classType.value}
                  checked={(selectedKeys as string[]).includes(classType.value)}
                  onChange={(e) => {
                    const newSelectedKeys = e.target.checked
                      ? [...selectedKeys, classType.value]
                      : (selectedKeys as string[]).filter(
                          (key) => key !== classType.value
                        );
                    setSelectedKeys(newSelectedKeys);
                    // Не закриваємо dropdown і не застосовуємо фільтр одразу
                  }}
                >
                  {classType.text}
                </Checkbox>
              ))}
          </div>
          <div className="filter-footer">
            <Button
              type="link"
              onClick={() => {
                confirm();
              }}
              className={`reset-filter-btn ${
                (selectedKeys as string[]).length > 0 ? "ant-btn-link" : ""
              }`}
              style={{
                color:
                  (selectedKeys as string[]).length > 0 ? "#1890ff" : "#999",
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      ),
      onFilter: (value, record) => record.type === value,
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
        <span
          style={{
            color: status?.toLowerCase() === "given" ? "#22d3ee" : "#e5e7eb",
            fontWeight: 600,
          }}
        >
          {status ? status.charAt(0).toUpperCase() + status.slice(1) : ""}
        </span>
      ),
      sorter: (a, b) => (a.status || "").localeCompare(b.status || ""),
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
      }) => (
        <div className="custom-filter-dropdown">
          <div className="filter-list">
            {[
              { text: "Cancelled", value: "cancelled" },
              { text: "Given", value: "given" },
              { text: "Student No Show", value: "student_no_show" },
              { text: "Teacher No Show", value: "teacher_no_show" },
            ]
              .sort((a, b) => a.text.localeCompare(b.text))
              .map((status) => (
                <Checkbox
                  key={status.value}
                  checked={(selectedKeys as string[]).includes(status.value)}
                  onChange={(e) => {
                    const newSelectedKeys = e.target.checked
                      ? [...selectedKeys, status.value]
                      : (selectedKeys as string[]).filter(
                          (key) => key !== status.value
                        );
                    setSelectedKeys(newSelectedKeys);
                    // Не закриваємо dropdown і не застосовуємо фільтр одразу
                  }}
                >
                  {status.text}
                </Checkbox>
              ))}
          </div>
          <div className="filter-footer">
            <Button
              type="link"
              onClick={() => {
                confirm();
              }}
              className={`reset-filter-btn ${
                (selectedKeys as string[]).length > 0 ? "ant-btn-link" : ""
              }`}
              style={{
                color:
                  (selectedKeys as string[]).length > 0 ? "#1890ff" : "#999",
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      ),
      onFilter: (value, record) =>
        record.status.toLowerCase() === String(value).toLowerCase(),
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
                <div className="size-2 animate-pulse rounded-full bg-green-400" />
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
          onSuccess={() => {
            handleCloseModal();
            // Примусово оновлюємо сторінку після створення через lessons
            localStorage.removeItem("classes"); // Clear localStorage to force server fetch
            setTimeout(() => {
              fetchClasses();
            }, 1000);
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
          onSuccess={(updatedData) => {
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
            // Примусово оновлюємо дані з сервера
            localStorage.removeItem("classes");
            setTimeout(() => {
              fetchClasses();
            }, 1000);
          }}
          editData={(() => {
            // Знаходимо студента за ім'ям, якщо studentId порожній
            let studentId = editingClass.studentId;
            if (!studentId && editingClass.studentName) {
              const foundStudent = students.find(
                (s) => s.name === editingClass.studentName
              );
              if (foundStudent) {
                studentId = foundStudent.id;
                console.log(
                  "Found student by name:",
                  editingClass.studentName,
                  "ID:",
                  foundStudent.id
                );
              } else {
                console.log(
                  "Student not found by name:",
                  editingClass.studentName
                );
                console.log(
                  "Available students:",
                  students.map((s) => ({ name: s.name, id: s.id }))
                );
              }
            }

            // Знаходимо вчителя за ім'ям, якщо teacherId порожній
            let teacherId = editingClass.teacherId;
            if (!teacherId && editingClass.teacherName) {
              const foundTeacher = teachers.find(
                (t) => t.name === editingClass.teacherName
              );
              if (foundTeacher) {
                teacherId = foundTeacher.id;
                console.log(
                  "Found teacher by name:",
                  editingClass.teacherName,
                  "ID:",
                  foundTeacher.id
                );
              } else {
                console.log(
                  "Teacher not found by name:",
                  editingClass.teacherName
                );
                console.log(
                  "Available teachers:",
                  teachers.map((t) => ({ name: t.name, id: t.id }))
                );
              }
            }

            const editData = {
              id: editingClass.id,
              studentId: studentId,
              teacherId: teacherId,
              date: editingClass.date,
              time: editingClass.time,
              status: editingClass.status,
              type: editingClass.type,
            };
            console.log("Final edit data:", editData);
            return editData;
          })()}
          students={students}
          teachers={teachers}
        />
      )}
    </motion.div>
  );
}
