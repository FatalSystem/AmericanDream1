import React, { useEffect } from "react";
import { Modal } from "antd";
import EventCreateForm from "./EventCreateForm";
import { TeacherWithColor } from "../../store/CalendarContext";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (eventData: any) => void;
  selectedDate?: Date | null;
  teachers: TeacherWithColor[];
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  selectedDate,
  teachers,
}) => {
  useEffect(() => {
    console.log("Modal state:", { isOpen, selectedDate });
  }, [isOpen, selectedDate]);

  return (
    <Modal
      title="Create New Event"
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
      maskClosable={false}
      className="create-event-modal"
      style={{ top: 20 }}
    >
      <EventCreateForm
        teachers={teachers}
        onClose={onClose}
        onSuccess={onSubmit}
        start={selectedDate || undefined}
        end={
          selectedDate
            ? new Date(selectedDate.getTime() + 50 * 60000)
            : undefined
        }
      />
    </Modal>
  );
};

export default CreateEventModal;
