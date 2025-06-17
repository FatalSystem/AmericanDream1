import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../config";
import "./ClassesPage.css";
import { Table, Button, Spin } from "antd";
import type { TableColumnsType } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

interface AddClassForm {
  date: string;
  studentId: string;
  teacherId: string;
  status: string;
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
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<AddClassForm>({
    date: "",
    studentId: "",
    teacherId: "",
    status: "Given",
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
        const teacherName = teachers.find(
          (t) => t.id === event.resourceId,
        )?.name;
        console.log(
          "Found teacher name:",
          teacherName,
          "for resourceId:",
          event.resourceId,
        );

        const mappedEvent = {
          id: event.id?.toString() || "",
          studentId: event.student_name || "",
          teacherId: event.resourceId || "",
          studentName: event.student_name_text || "Unknown Student",
          teacherName: teacherName || "Unknown Teacher",
          date: event.startDate?.split("T")[0] || "",
          status: event.class_status || "scheduled",
          time: event.startDate?.split("T")[1]?.slice(0, 5) || "",
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
  }, [teachers, students]);

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

  const handleOpenModal = () => {
    setShowModal(true);
    setFormError(null);
    setForm({
      date: "",
      studentId: "",
      teacherId: "",
      status: "Given",
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
      const [date, time] = form.date.split("T");
      const response = await api.post("/lessons", {
        student_id: form.studentId,
        teacher_id: form.teacherId,
        start_date: `${date}T${time}`,
        class_status: form.status,
        class_type: "regular",
      });

      console.log("Added class:", response.data);
      setShowModal(false);
      fetchClasses();
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
      width: "25%",
      render: (text: string) => <span>{dayjs(text).format("DD.MM.YYYY")}</span>,
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
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
      width: "25%",
      render: (text: string) => text,
      sorter: (a, b) => a.teacherName.localeCompare(b.teacherName),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: "25%",
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
    <div className="classes-page">
      <div className="classes-header">
        <h1>Classes</h1>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-4">
            <Button onClick={handleOpenModal}>Create Class</Button>
          </div>
        </div>
      </div>

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
            className="classes-table"
          />
        </>
      )}

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
                  { value: "Given", label: "Given" },
                  { value: "No show student", label: "No show student" },
                  { value: "No show teacher", label: "No show teacher" },
                  { value: "Cancelled", label: "Cancelled" },
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
    </div>
  );
}
