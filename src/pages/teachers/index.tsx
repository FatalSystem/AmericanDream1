import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../config";
import "./TeachersPage.css";

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

  return (
    <div className="teachers-page">
      <div className="teachers-header">
        <h1>Teachers</h1>
        <button className="add-teacher-btn" onClick={() => handleOpenModal()}>
          Add Teacher
        </button>
      </div>

      <div className="teachers-list">
        <table className="teachers-table">
          <thead>
            <tr>
              <th>No</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Email</th>
              <th>Trial Rate</th>
              <th>Regular Rate</th>
              <th>Training Rate</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher, idx) => (
              <tr key={teacher.id}>
                <td>{idx + 1}</td>
                <td>{teacher.first_name}</td>
                <td>{teacher.last_name}</td>
                <td>{teacher.email}</td>
                <td>
                  {teacher.rates?.find((r) => r.class_type_id === 1)?.rate || "-"}
                </td>
                <td>
                  {teacher.rates?.find((r) => r.class_type_id === 2)?.rate || "-"}
                </td>
                <td>
                  {teacher.rates?.find((r) => r.class_type_id === 3)?.rate || "-"}
                </td>
                <td>
                  <button
                    className="edit-btn"
                    onClick={() => handleOpenModal(teacher)}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => setDeleteId(teacher.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}
