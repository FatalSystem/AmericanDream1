import React, { useState } from "react";
import {
  Modal,
  Form,
  Input,
  DatePicker,
  TimePicker,
  Select,
  message,
} from "antd";
import dayjs from "dayjs";
import "./CreateEventModal.css";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (eventData: any) => void;
  initialDate?: Date;
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialDate,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Configure message position to be in the center
  message.config({
    top: "50%",
    duration: 3,
    maxCount: 1,
  });

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // Форматуємо дату та час
      const startDate = dayjs(values.date).format("YYYY-MM-DD");
      const startTime = dayjs(values.startTime).format("HH:mm");
      const endTime = dayjs(values.endTime).format("HH:mm");

      const eventData = {
        title: values.title,
        description: values.description,
        start: `${startDate}T${startTime}`,
        end: `${startDate}T${endTime}`,
        type: values.type,
      };

      await onSubmit(eventData);
      form.resetFields();
      onClose();
    } catch (error) {
      console.error("Validation failed:", error);
      // Show error message in the center of the screen
      message.error({
        content:
          "Cannot add a lesson for this student less than 12 hours ahead without paid classes.",
        className: "custom-error-message",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Create New Event"
      open={isOpen}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="Create"
      cancelText="Cancel"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          date: initialDate ? dayjs(initialDate) : dayjs(),
        }}
      >
        <Form.Item
          name="title"
          label="Event Title"
          rules={[{ required: true, message: "Please enter event title" }]}
        >
          <Input placeholder="Enter event title" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea placeholder="Enter event description" />
        </Form.Item>

        <Form.Item
          name="date"
          label="Date"
          rules={[{ required: true, message: "Please select date" }]}
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          name="startTime"
          label="Start Time"
          rules={[{ required: true, message: "Please select start time" }]}
        >
          <TimePicker format="HH:mm" style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          name="endTime"
          label="End Time"
          rules={[{ required: true, message: "Please select end time" }]}
        >
          <TimePicker format="HH:mm" style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          name="type"
          label="Event Type"
          rules={[{ required: true, message: "Please select event type" }]}
        >
          <Select>
            <Select.Option value="class">Class</Select.Option>
            <Select.Option value="meeting">Meeting</Select.Option>
            <Select.Option value="other">Other</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateEventModal;
