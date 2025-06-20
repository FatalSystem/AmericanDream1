import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../config";
import "./ClassesPage.css";
import { Table, Button, Spin, Card } from "antd";
import type { TableColumnsType } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { useTimezone } from "../../contexts/TimezoneContext";
import { DEFAULT_DB_TIMEZONE } from "../../utils/timezone";
import "../../pages/home/dashboard.css";
import { motion } from "framer-motion";

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

interface AddClassForm {
  date: string;
  studentId: string;
  teacherId: string;
  status: string;
  classType: string;
}

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

function CustomDropdown({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <div className="custom-dropdown">
      {label && <label className="dropdown-label">{label}</label>}
      <div
        className="custom-dropdown-btn"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      >
        <span>{selected ? selected.label : placeholder || "Select"}</span>
        <svg
          width="18"
          height="18"
          style={{ marginLeft: 8, opacity: 0.7 }}
          viewBox="0 0 24 24"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="#2563eb"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {open && (
        <div className="custom-dropdown-list">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={
                "custom-dropdown-item" +
                (opt.value === value ? " selected" : "")
              }
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClassesPage() {
  const navigate = useNavigate();
  const { timezone } = useTimezone();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<AddClassForm>({
    date: "",
    studentId: "",
    teacherId: "",
    status: "scheduled",
    classType: "regular",
  });
  const [formError, setFormError] = useState<string | null>(null);
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

      console.log("Current teachers state:", teachers);
      console.log("Current students state:", students);

      const mapped = events.map((event: any) => {
        console.log("Processing event:", event);

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

        // Convert UTC date to user timezone for display
        const startDate = event.startDate
          ? dayjs.utc(event.startDate).tz(timezone)
          : null;
        const endDate = event.endDate
          ? dayjs.utc(event.endDate).tz(timezone)
          : null;

        const mappedEvent = {
          id: event.id?.toString() || "",
          studentId: event.student_id || event.studentId || "",
          teacherId: teacherId?.toString() || "",
          studentName: event.student_name_text || "Unknown Student",
          teacherName: teacherName || "Unknown Teacher",
          date: startDate?.format("YYYY-MM-DD") || "",
          status: event.class_status || "scheduled",
          time: startDate?.format("HH:mm") || "",
          type: event.class_type || "regular",
        };
        console.log("Mapped event:", mappedEvent);
        return mappedEvent;
      });

      console.log("Final mapped events:", mapped);
      setClasses(mapped);
      setError(null);
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
    setFormError(null);
    setForm({
      date: "",
      studentId: "",
      teacherId: "",
      status: "scheduled",
      classType: "regular",
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormError(null);
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.studentId || !form.teacherId) {
      setFormError("Please fill in all fields");
      return;
    }

    try {
      // Parse the datetime in user timezone
      const startInUserTz = dayjs.tz(form.date, timezone);
      const endInUserTz = startInUserTz.add(
        form.classType === "trial" ? 30 : 50,
        "minute"
      );

      // Convert to UTC for storage
      const startInUtc = startInUserTz.utc();
      const endInUtc = endInUserTz.utc();

      console.log("Creating class with times:", {
        startInUserTz: startInUserTz.format("YYYY-MM-DD HH:mm:ss"),
        endInUserTz: endInUserTz.format("YYYY-MM-DD HH:mm:ss"),
        startInUtc: startInUtc.format("YYYY-MM-DD HH:mm:ss"),
        endInUtc: endInUtc.format("YYYY-MM-DD HH:mm:ss"),
      });

      // Use the same API endpoint as calendar
      const response = await api.post("/calendar/events", {
        events: {
          added: [
            {
              class_type: form.classType,
              student_id: parseInt(form.studentId),
              teacher_id: parseInt(form.teacherId),
              class_status: form.status,
              payment_status: "reserved",
              startDate: startInUtc.format(),
              endDate: endInUtc.format(),
              duration: endInUserTz.diff(startInUserTz, "minute"),
            },
          ],
        },
      });

      console.log("Added class:", response.data);
      setShowModal(false);
      fetchClasses();

      // Notify calendar component that events have been updated
      localStorage.setItem("calendarEventsUpdated", Date.now().toString());
    } catch (err) {
      console.error("Error adding class:", err);
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      setFormError("Failed to add class. Please try again.");
    }
  };

  const handleDeleteClass = async (classId: string) => {
    try {
      const response = await api.delete(`/calendar/events/${classId}`);

      if (response.data) {
        console.log("Deleted class:", response.data);
        fetchClasses();

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
      width: "20%",
      render: (text: string) => <span>{dayjs(text).format("DD.MM.YYYY")}</span>,
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
    },
    {
      title: "Time",
      dataIndex: "time",
      key: "time",
      width: "15%",
      render: (text: string) => <span>{text}</span>,
      sorter: (a, b) => a.time.localeCompare(b.time),
    },
    {
      title: "Student",
      dataIndex: "studentName",
      key: "studentName",
      width: "25%",
      render: (text: string) => text,
      sorter: (a, b) => a.studentName.localeCompare(b.studentName),
    },
    {
      title: "Teacher",
      dataIndex: "teacherName",
      key: "teacherName",
      width: "20%",
      render: (text: string) => text,
      sorter: (a, b) => a.teacherName.localeCompare(b.teacherName),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: "20%",
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
              <Button
                type="primary"
                onClick={handleOpenModal}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 font-medium shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700"
              >
                Create Class
              </Button>
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
            )}
          </div>
        </Card>
      </motion.div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Add New Class</h2>
            <form onSubmit={handleAddClass}>
              <div className="form-group">
                <label>Date and Time</label>
                <input
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <CustomDropdown
                label="Class Type"
                options={[
                  { value: "trial", label: "Trial" },
                  { value: "regular", label: "Regular" },
                  { value: "instant", label: "Instant" },
                  { value: "group", label: "Group" },
                ]}
                value={form.classType}
                onChange={(v) => setForm({ ...form, classType: v })}
                placeholder="Select Class Type"
              />
              <CustomDropdown
                label="Student"
                options={students.map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
                value={form.studentId}
                onChange={(v) => setForm({ ...form, studentId: v })}
                placeholder="Select Student"
              />
              <CustomDropdown
                label="Teacher"
                options={teachers.map((t) => ({
                  value: t.id,
                  label: t.name,
                }))}
                value={form.teacherId}
                onChange={(v) => setForm({ ...form, teacherId: v })}
                placeholder="Select Teacher"
              />
              <CustomDropdown
                label="Status"
                options={[
                  { value: "scheduled", label: "Scheduled" },
                  { value: "given", label: "Given" },
                  { value: "student_no_show", label: "Student No Show" },
                  { value: "teacher_no_show", label: "Teacher No Show" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
              />
              {formError && <div className="error-message">{formError}</div>}
              <div className="modal-actions">
                <button type="submit" className="save-btn">
                  Save
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
