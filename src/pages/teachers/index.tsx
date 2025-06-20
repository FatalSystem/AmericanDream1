import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../config";
import "./TeachersPage.css";
import { Table, Button, Spin, Card } from "antd";
import type { TableColumnsType } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import "../../pages/home/dashboard.css";
import { motion } from "framer-motion";

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

interface TeacherForm {
  first_name: string;
  last_name: string;
  email: string;
  trialRate: string;
  regularRate: string;
  trainingRate: string;
  password?: string;
}

interface TeacherRate {
  class_type_id: number;
  class_type_name: string;
  rate: string;
}

export interface BackendTeacher {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  rates?: TeacherRate[];
}

export default function TeachersPage() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<BackendTeacher[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<TeacherForm>({
    first_name: "",
    last_name: "",
    email: "",
    trialRate: "",
    regularRate: "",
    trainingRate: "",
    password: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchTeachers = useCallback(async () => {
    try {
      const response = await api.get("/teachers");
      console.log("Teachers data from API:", response);
      setTeachers(response.data || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      setTeachers([]);
    }
  }, [navigate]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleOpenModal = (teacher?: BackendTeacher) => {
    setShowModal(true);
    setFormError(null);
    if (teacher) {
      setEditId(teacher.id);
      setForm({
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        email: teacher.email,
        trialRate:
          teacher.rates?.find((r: TeacherRate) => r.class_type_id === 1)
            ?.rate || "",
        regularRate:
          teacher.rates?.find((r: TeacherRate) => r.class_type_id === 2)
            ?.rate || "",
        trainingRate:
          teacher.rates?.find((r: TeacherRate) => r.class_type_id === 3)
            ?.rate || "",
        password: "",
      });
    } else {
      setEditId(null);
      setForm({
        first_name: "",
        last_name: "",
        email: "",
        trialRate: "",
        regularRate: "",
        trainingRate: "",
        password: "",
      });
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditId(null);
    setFormError(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddOrEditTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.first_name ||
      !form.last_name ||
      !form.email ||
      !form.trialRate ||
      !form.regularRate ||
      !form.trainingRate ||
      (!editId && !form.password)
    ) {
      setFormError("Please fill in all fields");
      return;
    }
    try {
      let teacherId = editId;
      if (!editId) {
        // Create
        const response = await api.post("/teachers", {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          password: form.password,
        });
        teacherId = response.data.id;
      } else {
        // Update
        await api.put(`/teachers/${editId}`, {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
        });
      }
      // Set rates
      const rates = [
        { class_type_id: 1, rate: form.trialRate },
        { class_type_id: 2, rate: form.regularRate },
        { class_type_id: 3, rate: form.trainingRate },
      ];

      await api.post(`/teachers/${teacherId}/rates`, { rates });

      setShowModal(false);
      setEditId(null);
      fetchTeachers();
    } catch (error) {
      console.error("Error saving teacher:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      setFormError("Failed to save teacher. Please try again.");
    }
  };

  const handleDeleteTeacher = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/teachers/${deleteId}`);
      setDeleteId(null);
      fetchTeachers();
    } catch (error) {
      console.error("Error deleting teacher:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
    }
  };

  const columns: TableColumnsType<BackendTeacher> = [
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
      title: "First Name",
      dataIndex: "first_name",
      key: "first_name",
      width: "15%",
      sorter: (a, b) => a.first_name.localeCompare(b.first_name),
      render: (text: string) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {text}
        </span>
      ),
    },
    {
      title: "Last Name",
      dataIndex: "last_name",
      key: "last_name",
      width: "15%",
      sorter: (a, b) => a.last_name.localeCompare(b.last_name),
      render: (text: string) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {text}
        </span>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: "25%",
      sorter: (a, b) => a.email.localeCompare(b.email),
      render: (text: string) => (
        <span className="font-medium text-blue-600 dark:text-blue-400">
          {text}
        </span>
      ),
    },
    {
      title: "Trial Rate",
      key: "trial_rate",
      width: "12%",
      render: (_: any, record: BackendTeacher) => (
        <span className="font-medium text-green-600 dark:text-green-400">
          ${record.rates?.find((r) => r.class_type_id === 1)?.rate || "-"}
        </span>
      ),
    },
    {
      title: "Regular Rate",
      key: "regular_rate",
      width: "12%",
      render: (_: any, record: BackendTeacher) => (
        <span className="font-medium text-green-600 dark:text-green-400">
          ${record.rates?.find((r) => r.class_type_id === 2)?.rate || "-"}
        </span>
      ),
    },
    {
      title: "Training Rate",
      key: "training_rate",
      width: "12%",
      render: (_: any, record: BackendTeacher) => (
        <span className="font-medium text-green-600 dark:text-green-400">
          ${record.rates?.find((r) => r.class_type_id === 3)?.rate || "-"}
        </span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: "15%",
      fixed: "right",
      render: (_: any, record: BackendTeacher) => (
        <div className="flex gap-2">
          <Button
            type="text"
            size="small"
            onClick={() => handleOpenModal(record)}
            className="text-blue-600 hover:text-blue-800"
            title="Edit"
          >
            ✏️
          </Button>
          <Button
            type="text"
            size="small"
            onClick={() => setDeleteId(record.id)}
            className="text-red-600 hover:text-red-800"
            title="Delete"
          >
            🗑️
          </Button>
        </div>
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
      {/* Teachers Table */}
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
                  Teachers List
                </span>
                <div className="size-2 animate-pulse rounded-full bg-blue-400" />
              </div>
              <Button
                type="primary"
                onClick={() => handleOpenModal()}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 font-medium shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700"
              >
                Add Teacher
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
            <Table
              columns={columns}
              dataSource={teachers}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              className="custom-table"
              scroll={{ x: "100%", y: "calc(55vh - 120px)" }}
              size="large"
              sticky
              style={{ width: "100%", minWidth: "800px" }}
            />
          </div>
        </Card>
      </motion.div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editId ? "Edit Teacher" : "Add Teacher"}</h2>
            <form onSubmit={handleAddOrEditTeacher}>
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleFormChange}
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleFormChange}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleFormChange}
                />
              </div>
              {!editId && (
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleFormChange}
                  />
                </div>
              )}
              <div className="form-group">
                <label>Trial Rate ($)</label>
                <input
                  type="number"
                  name="trialRate"
                  value={form.trialRate}
                  onChange={handleFormChange}
                />
              </div>
              <div className="form-group">
                <label>Regular Rate ($)</label>
                <input
                  type="number"
                  name="regularRate"
                  value={form.regularRate}
                  onChange={handleFormChange}
                />
              </div>
              <div className="form-group">
                <label>Training Rate ($)</label>
                <input
                  type="number"
                  name="trainingRate"
                  value={form.trainingRate}
                  onChange={handleFormChange}
                />
              </div>
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

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Confirm Delete</h2>
            <p>Are you sure you want to delete this teacher?</p>
            <div className="modal-actions">
              <button className="delete-btn" onClick={handleDeleteTeacher}>
                Delete
              </button>
              <button className="cancel-btn" onClick={() => setDeleteId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
