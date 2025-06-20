import React, { useState, useEffect } from "react";
import { Modal, Form, Select, DatePicker, Button, message } from "antd";
import dayjs from "dayjs";
import { calendarApi } from "../../api/calendar";
import "./AddEditClassModal.css";

interface AddEditClassModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (updatedData?: any) => void;
  editData?: {
    id: string;
    studentId: string;
    teacherId: string;
    date: string;
    time: string;
    status: string;
    type: string;
  } | null;
  teachers: Array<{ id: string; name: string }>;
  students: Array<{ id: string; name: string }>;
}

interface ClassFormData {
  date: string;
  time: string;
  studentId: string;
  teacherId: string;
  status: string;
  type: string;
}

const AddEditClassModal: React.FC<AddEditClassModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  editData,
  teachers,
  students,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ClassFormData>({
    date: "",
    time: "",
    studentId: "",
    teacherId: "",
    status: "Scheduled",
    type: "Regular",
  });

  const isEditMode = !!editData;

  useEffect(() => {
    if (visible && editData) {
      // Розділяємо дату та час для редагування (використовуємо локальний час)
      const dateTime = dayjs(
        `${editData.date} ${editData.time}`,
        "YYYY-MM-DD HH:mm"
      );
      setFormData({
        date: editData.date, // Використовуємо оригінальну дату
        time: editData.time, // Використовуємо оригінальний час
        studentId: editData.studentId,
        teacherId: editData.teacherId,
        status: editData.status,
        type: editData.type,
      });
      form.setFieldsValue({
        date: dateTime,
        time: editData.time,
        studentId: editData.studentId,
        teacherId: editData.teacherId,
        status: editData.status,
        type: editData.type,
      });
      console.log("Setting form values for edit:", {
        originalDate: editData.date,
        originalTime: editData.time,
        parsedDateTime: dateTime.format("YYYY-MM-DD HH:mm:ss"),
        studentId: editData.studentId,
        teacherId: editData.teacherId,
        status: editData.status,
        type: editData.type,
      });
      console.log(
        "Available students:",
        students.map((s) => ({ name: s.name, id: s.id }))
      );
      console.log(
        "Available teachers:",
        teachers.map((t) => ({ name: t.name, id: t.id }))
      );

      // Перевіряємо, чи існують студент та вчитель з цими ID
      const studentExists = students.find((s) => s.id === editData.studentId);
      const teacherExists = teachers.find((t) => t.id === editData.teacherId);
      console.log("Student exists:", studentExists);
      console.log("Teacher exists:", teacherExists);
    } else if (visible && !editData) {
      // Скидаємо форму для створення нового класу
      setFormData({
        date: "",
        time: "",
        studentId: "",
        teacherId: "",
        status: "Scheduled",
        type: "Regular",
      });
      form.resetFields();
    }
  }, [visible, editData, form, students, teachers]);

  // Додатковий useEffect для оновлення formData коли змінюються students або teachers
  useEffect(() => {
    if (visible && editData && students.length > 0 && teachers.length > 0) {
      // Перевіряємо, чи існують студент та вчитель з цими ID
      const studentExists = students.find((s) => s.id === editData.studentId);
      const teacherExists = teachers.find((t) => t.id === editData.teacherId);

      if (studentExists && teacherExists) {
        const dateTime = dayjs(
          `${editData.date} ${editData.time}`,
          "YYYY-MM-DD HH:mm"
        );
        setFormData({
          date: editData.date, // Використовуємо оригінальну дату
          time: editData.time, // Використовуємо оригінальний час
          studentId: editData.studentId,
          teacherId: editData.teacherId,
          status: editData.status,
          type: editData.type,
        });
        form.setFieldsValue({
          date: dateTime,
          time: editData.time,
          studentId: editData.studentId,
          teacherId: editData.teacherId,
          status: editData.status,
          type: editData.type,
        });
        console.log("Updated form values after students/teachers loaded");
      }
    }
  }, [students, teachers, visible, editData, form]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      console.log("Form values:", values); // Для дебагу

      const dateTime = dayjs(values.date);
      const timeString = values.time || "00:00";

      // Формуємо дату та час для календаря (використовуємо локальний час)
      const startDateTime = dayjs(
        `${dateTime.format("YYYY-MM-DD")} ${timeString}`,
        "YYYY-MM-DD HH:mm"
      );
      const endDateTime = startDateTime.add(1, "hour"); // Клас триває 1 годину

      console.log("Original date:", dateTime.format("YYYY-MM-DD"));
      console.log("Original time:", timeString);
      console.log(
        "Start datetime:",
        startDateTime.format("YYYY-MM-DD HH:mm:ss")
      );
      console.log("End datetime:", endDateTime.format("YYYY-MM-DD HH:mm:ss"));

      if (isEditMode && editData) {
        // Оновлення існуючого класу через календар API
        console.log("Updating lesson with ID:", editData.id);

        const eventData = {
          id: editData.id,
          title: `Class: ${
            students.find((s) => s.id === values.studentId)?.name
          } - ${teachers.find((t) => t.id === values.teacherId)?.name}`,
          start_date: startDateTime.format("YYYY-MM-DD HH:mm:ss"),
          end_date: endDateTime.format("YYYY-MM-DD HH:mm:ss"),
          teacher_id: parseInt(values.teacherId),
          student_id: parseInt(values.studentId),
          teacher_name:
            teachers.find((t) => t.id === values.teacherId)?.name || "",
          student_name:
            students.find((s) => s.id === values.studentId)?.name || "",
          class_status: values.status,
          class_type: values.type,
          payment_status: "pending",
        };

        const updateResponse = await calendarApi.updateCalendarEvent(eventData);
        console.log("Update response:", updateResponse);
        message.success("Class updated successfully!");

        // Зберігаємо оновлені дані в localStorage
        const updatedClassData = {
          id: editData.id,
          studentId: values.studentId,
          teacherId: values.teacherId,
          studentName:
            students.find((s) => s.id === values.studentId)?.name ||
            "Unknown Student",
          teacherName:
            teachers.find((t) => t.id === values.teacherId)?.name ||
            "Unknown Teacher",
          date: dateTime.format("YYYY-MM-DD"),
          status: values.status,
          time: timeString,
          type: values.type,
          fullDateTime: startDateTime.toDate(),
        };

        // Отримуємо поточні дані з localStorage
        const existingClasses = JSON.parse(
          localStorage.getItem("classes") || "[]"
        );
        const updatedClasses = existingClasses.map((cls: any) =>
          cls.id === editData.id ? updatedClassData : cls
        );
        localStorage.setItem("classes", JSON.stringify(updatedClasses));

        onSuccess(updatedClassData);
      } else {
        // Створення нового класу через календар API
        console.log("Creating new lesson via calendar API");

        const eventData = {
          title: `Class: ${
            students.find((s) => s.id === values.studentId)?.name
          } - ${teachers.find((t) => t.id === values.teacherId)?.name}`,
          start_date: startDateTime.format("YYYY-MM-DD HH:mm:ss"),
          end_date: endDateTime.format("YYYY-MM-DD HH:mm:ss"),
          teacher_id: parseInt(values.teacherId),
          student_id: parseInt(values.studentId),
          teacher_name:
            teachers.find((t) => t.id === values.teacherId)?.name || "",
          student_name:
            students.find((s) => s.id === values.studentId)?.name || "",
          class_status: values.status,
          class_type: values.type,
          payment_status: "pending",
        };

        const createResponse = await calendarApi.createCalendar(eventData);
        console.log("Create response:", createResponse);
        console.log("Create response type:", typeof createResponse);
        console.log("Create response keys:", Object.keys(createResponse || {}));
        message.success("Class created successfully!");

        // Створюємо об'єкт для додавання до локального стану
        const newClassData = {
          id:
            createResponse.id ||
            createResponse.eventId ||
            Date.now().toString(),
          studentId: values.studentId,
          teacherId: values.teacherId,
          studentName:
            students.find((s) => s.id === values.studentId)?.name ||
            "Unknown Student",
          teacherName:
            teachers.find((t) => t.id === values.teacherId)?.name ||
            "Unknown Teacher",
          date: dateTime.format("YYYY-MM-DD"),
          status: values.status,
          time: timeString,
          type: values.type,
          fullDateTime: startDateTime.toDate(),
        };

        console.log("New class data to be saved:", newClassData);

        // Зберігаємо новий клас в localStorage
        const existingClasses = JSON.parse(
          localStorage.getItem("classes") || "[]"
        );
        existingClasses.push(newClassData);
        localStorage.setItem("classes", JSON.stringify(existingClasses));

        onSuccess(newClassData);
      }

      // Notify that lessons have been updated
      localStorage.setItem("lessonsUpdated", Date.now().toString());

      // Clear localStorage classes to force refresh from server
      localStorage.removeItem("classes");
    } catch (error: any) {
      console.error("Error saving class:", error);

      // Якщо це помилка валідації форми, не показуємо повідомлення про помилку
      if (error.errorFields && error.errorFields.length > 0) {
        console.log("Validation errors:", error.errorFields);
        return;
      }

      if (error.response?.status === 401) {
        message.error("Unauthorized. Please login again.");
        localStorage.removeItem("token");
        window.location.href = "/login";
      } else {
        console.error("Server error response:", error.response?.data);
        message.error(
          error.response?.data?.msg ||
            error.response?.data?.message ||
            "Error saving class"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={isEditMode ? "Edit Class" : "Create New Class"}
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          htmlType="submit"
          form="classForm"
        >
          {isEditMode ? "Update" : "Create"}
        </Button>,
      ]}
      width={600}
      destroyOnClose
    >
      <Form
        id="classForm"
        form={form}
        layout="vertical"
        initialValues={{
          status: "Scheduled",
          type: "Regular",
        }}
        onFinish={handleSubmit}
      >
        <Form.Item
          name="date"
          label="Date"
          rules={[{ required: true, message: "Please select a date" }]}
        >
          <DatePicker
            style={{ width: "100%" }}
            format="DD.MM.YYYY"
            placeholder="Select date"
            showToday={true}
            allowClear={false}
            disabledDate={(current) => {
              // Дозволяємо вибирати дати тільки з сьогоднішнього дня
              return current && current < dayjs().startOf("day");
            }}
          />
        </Form.Item>

        <Form.Item
          name="time"
          label="Time"
          rules={[{ required: true, message: "Please select time" }]}
        >
          <Select
            placeholder="Select time"
            showSearch
            filterOption={(input, option) =>
              (option?.children as unknown as string)
                ?.toLowerCase()
                .includes(input.toLowerCase())
            }
          >
            {Array.from({ length: 24 }, (_, hour) =>
              Array.from({ length: 4 }, (_, minute) => {
                const time = `${hour.toString().padStart(2, "0")}:${(
                  minute * 15
                )
                  .toString()
                  .padStart(2, "0")}`;
                return (
                  <Select.Option key={time} value={time}>
                    {time}
                  </Select.Option>
                );
              })
            ).flat()}
          </Select>
        </Form.Item>

        <Form.Item
          name="type"
          label="Class Type"
          rules={[{ required: true, message: "Please select class type" }]}
        >
          <Select
            placeholder="Select class type"
            showSearch
            filterOption={(input, option) =>
              (option?.children as unknown as string)
                ?.toLowerCase()
                .includes(input.toLowerCase())
            }
          >
            <Select.Option value="Trial">Trial</Select.Option>
            <Select.Option value="Regular">Regular</Select.Option>
            <Select.Option value="Instant">Instant</Select.Option>
            <Select.Option value="Group">Group</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="studentId"
          label="Student"
          rules={[{ required: true, message: "Please select a student" }]}
        >
          <Select
            placeholder="Select student"
            showSearch
            filterOption={(input, option) =>
              (option?.children as unknown as string)
                ?.toLowerCase()
                .includes(input.toLowerCase())
            }
            optionFilterProp="children"
            value={formData.studentId}
          >
            {students.map((student) => (
              <Select.Option key={student.id} value={student.id}>
                {student.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="teacherId"
          label="Teacher"
          rules={[{ required: true, message: "Please select a teacher" }]}
        >
          <Select
            placeholder="Select teacher"
            showSearch
            filterOption={(input, option) =>
              (option?.children as unknown as string)
                ?.toLowerCase()
                .includes(input.toLowerCase())
            }
            optionFilterProp="children"
            value={formData.teacherId}
          >
            {teachers.map((teacher) => (
              <Select.Option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="status"
          label="Status"
          rules={[{ required: true, message: "Please select status" }]}
        >
          <Select
            placeholder="Select status"
            showSearch
            filterOption={(input, option) =>
              (option?.children as unknown as string)
                ?.toLowerCase()
                .includes(input.toLowerCase())
            }
          >
            <Select.Option value="scheduled">Scheduled</Select.Option>
            <Select.Option value="given">Given</Select.Option>
            <Select.Option value="cancelled">Cancelled</Select.Option>
            <Select.Option value="Student No Show">
              Student No Show
            </Select.Option>
            <Select.Option value="Teacher No Show">
              Teacher No Show
            </Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddEditClassModal;
