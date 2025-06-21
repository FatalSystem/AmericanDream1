import React, { useState, useEffect } from "react";
import { Modal, Form, Select, DatePicker, Button, message } from "antd";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { calendarApi } from "../../api/calendar";
import api from "../../config";
import { useTimezone } from "../../contexts/TimezoneContext";
import { DEFAULT_DB_TIMEZONE } from "../../utils/timezone";
import "./AddEditClassModal.css";

dayjs.extend(utc);
dayjs.extend(timezone);

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
  const { timezone: userTimezone } = useTimezone();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ClassFormData>({
    date: "",
    time: "",
    studentId: "",
    teacherId: "",
    status: "scheduled",
    type: "regular",
  });

  const isEditMode = !!editData;

  useEffect(() => {
    if (visible && editData) {
      console.log("Setting up edit mode with data:", editData);

      // Правильно обробляємо дату та час для редагування
      let dateTime;
      try {
        // Спробуємо створити дату з існуючих даних
        if (editData.date && editData.time) {
          dateTime = dayjs.tz(
            `${editData.date} ${editData.time}`,
            userTimezone
          );
        } else {
          dateTime = dayjs().tz(userTimezone);
        }
      } catch (error) {
        console.error("Error parsing date/time:", error);
        dateTime = dayjs().tz(userTimezone);
      }

      const newFormData = {
        date: dateTime.format("YYYY-MM-DD"),
        time: editData.time || dateTime.format("HH:mm"),
        studentId: editData.studentId || "",
        teacherId: editData.teacherId || "",
        status: editData.status || "scheduled",
        type: editData.type || "regular",
      };

      setFormData(newFormData);

      form.setFieldsValue({
        date: dateTime,
        time: newFormData.time,
        studentId: newFormData.studentId,
        teacherId: newFormData.teacherId,
        status: newFormData.status,
        type: newFormData.type,
      });

      console.log("Form values set for edit:", {
        date: dateTime.format("YYYY-MM-DD HH:mm:ss"),
        time: newFormData.time,
        studentId: newFormData.studentId,
        teacherId: newFormData.teacherId,
        status: newFormData.status,
        type: newFormData.type,
      });
    } else if (visible && !editData) {
      // Скидаємо форму для створення нового класу
      const now = dayjs().tz(userTimezone);
      const newFormData = {
        date: now.format("YYYY-MM-DD"),
        time: now.format("HH:mm"),
        studentId: "",
        teacherId: "",
        status: "scheduled",
        type: "regular",
      };

      setFormData(newFormData);
      form.resetFields();
      form.setFieldsValue({
        date: now,
        time: newFormData.time,
        status: newFormData.status,
        type: newFormData.type,
      });
    }
  }, [visible, editData, form, userTimezone]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      console.log("Form values:", values);

      // Перевіряємо чи можна встановити статус "Given" для студента
      if (values.status === "Given" && values.studentId) {
        try {
          console.log(
            "🔍 Checking student's remaining classes before setting 'Given' status..."
          );
          const studentResponse = await calendarApi.getStudentRemainingClasses(
            values.studentId
          );
          const remainingClasses = studentResponse.remainingClasses || 0;

          console.log("🔍 Student remaining classes:", {
            studentId: values.studentId,
            remainingClasses,
            canSetGiven: remainingClasses > 0,
          });

          // Якщо студент не має оплачених уроків, не дозволяємо встановлювати статус "Given"
          if (remainingClasses <= 0) {
            console.log(
              "❌ Cannot set status to 'Given' - student has no paid classes"
            );
            message.error(
              "Cannot mark lesson as 'Given' - student has no paid classes"
            );
            return; // Вихід - не дозволяємо зміну статусу
          }
        } catch (error) {
          console.error("Error checking student's remaining classes:", error);
          message.error("Failed to verify student's class balance");
          return; // Вихід якщо не можемо перевірити баланс студента
        }
      }

      // Правильно обробляємо дату та час
      const dateTime = dayjs(values.date);
      const timeString = values.time || "00:00";

      // Формуємо повну дату та час в часовому поясі користувача
      const startDateTime = dayjs.tz(
        `${dateTime.format("YYYY-MM-DD")} ${timeString}`,
        userTimezone
      );

      // Визначаємо тривалість класу залежно від типу
      let duration = 50; // за замовчуванням 50 хвилин
      if (values.type === "trial") {
        duration = 30;
      }

      const endDateTime = startDateTime.add(duration, "minute");

      console.log("Event timing:", {
        startDateTime: startDateTime.format("YYYY-MM-DD HH:mm:ss"),
        endDateTime: endDateTime.format("YYYY-MM-DD HH:mm:ss"),
        duration: duration,
        timezone: userTimezone,
      });

      if (isEditMode && editData) {
        // Оновлення існуючого класу
        console.log("Updating lesson with ID:", editData.id);

        // Підготовка даних для нового API
        const updateData = {
          date: dateTime.format("YYYY-MM-DD"),
          startTime: timeString,
          endTime: endDateTime.format("HH:mm"),
          classType: values.type,
          studentId: parseInt(values.studentId),
          teacherId: parseInt(values.teacherId),
          status: values.status,
        };

        console.log("Update event data for new API:", updateData);

        // Використовуємо новий API для оновлення
        const response = await calendarApi.updateEventComplete(
          parseInt(editData.id),
          updateData
        );

        console.log("Update response:", response);
        message.success("Class updated successfully!");

        // Повертаємо оновлені дані
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

        onSuccess(updatedClassData);
      } else {
        // Створення нового класу
        console.log("Creating new lesson");

        // Конвертуємо в локальний час для API (без UTC конвертації)
        const startLocal = startDateTime.format("YYYY-MM-DDTHH:mm:ss");
        const endLocal = endDateTime.format("YYYY-MM-DDTHH:mm:ss");

        const eventData = {
          class_type: values.type,
          student_id: parseInt(values.studentId),
          teacher_id: parseInt(values.teacherId),
          class_status: values.status,
          payment_status: "reserved", // за замовчуванням
          startDate: startLocal,
          endDate: endLocal,
          duration: duration,
        };

        console.log("Create event data:", eventData);

        const response = await calendarApi.createCalendar(eventData);

        console.log("Create response:", response);
        message.success("Class created successfully!");

        // Повертаємо дані нового класу
        const newClassData = {
          id: response.id || Date.now().toString(),
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

        onSuccess(newClassData);
      }

      // Сповіщаємо про оновлення календаря
      localStorage.setItem("calendarEventsUpdated", Date.now().toString());
      window.dispatchEvent(new Event("calendarUpdate"));

      // Додатково сповіщаємо про оновлення уроків
      localStorage.setItem("lessonsUpdated", Date.now().toString());
      window.dispatchEvent(new Event("lessonsUpdate"));

      console.log("📢 Notifications sent for calendar and lessons updates");
    } catch (error: any) {
      console.error("Error saving class:", error);

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
          status: "scheduled",
          type: "regular",
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
            <Select.Option value="trial">Trial (30 min)</Select.Option>
            <Select.Option value="regular">Regular (50 min)</Select.Option>
            <Select.Option value="intensive">Intensive (50 min)</Select.Option>
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
            <Select.Option value="Given">Given</Select.Option>
            <Select.Option value="Cancelled">Cancelled</Select.Option>
            <Select.Option value="No show student">
              No show student
            </Select.Option>
            <Select.Option value="No show teacher">
              No show teacher
            </Select.Option>
            <Select.Option value="Unavailable">Unavailable</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddEditClassModal;
