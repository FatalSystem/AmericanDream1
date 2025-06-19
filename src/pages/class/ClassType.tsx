import { useState, useEffect } from "react";
import { Button, Label, Modal, TextInput } from "flowbite-react";
import {
  Card,
  Table,
  TableColumnsType,
  Button as AntButton,
  Space,
} from "antd";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import api from "../../config";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "../../hooks/usePermission";
import LoadingSpinner from "../../components/LoadingSpinner";
import { motion } from "framer-motion";

interface ClassType {
  id: number;
  name: string;
  createdAt: string;
  action: any;
}

// Gerçek class type ID'leri - sadece bunları göster
const VALID_CLASS_TYPE_IDS = [1, 2, 3]; // Trial-Lesson, Regular-Lesson, Training

// Add function to check if user has access to Training type
const hasTrainingAccess = () => {
  const userRole = localStorage.getItem("role");
  return userRole === "accountant" || userRole === "super_admin";
};

export default function ClassType() {
  const navigate = useNavigate();
  const { permissions, loading_1 } = usePermissions("/class/type");
  const [classTypeData, setClassTypeData] = useState<ClassType[]>([]);
  const [name, setName] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selectedClassType, setSelectedClassType] = useState<ClassType | null>(
    null
  );

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loading_1) {
      if (!permissions.read) {
        navigate("/");
        toast.error("You don't have permission to view this page", {
          theme: "dark",
        });
      } else {
        fetchClassTypes();
      }
    }
  }, [permissions, navigate, loading_1]);

  const fetchClassTypes = async () => {
    try {
      setLoading(true);
      const res = await api.get("/class-types");
      // Filter class types based on user role and valid IDs
      const validClassTypes = res.data.filter((classType: ClassType) => {
        if (classType.name === "Training") {
          return (
            hasTrainingAccess() && VALID_CLASS_TYPE_IDS.includes(classType.id)
          );
        }
        return VALID_CLASS_TYPE_IDS.includes(classType.id);
      });
      setClassTypeData(validClassTypes || []);
      setLoading(false);
    } catch (error: any) {
      handleApiError(error);
      setLoading(false);
    }
  };

  const handleApiError = (error: any) => {
    console.error("API Error:", error);
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      toast.error("Session expired. Please login again.", { theme: "dark" });
      navigate("/");
    } else {
      toast.error("An error occurred. Please try again.", { theme: "dark" });
    }
  };

  const createClassType = async () => {
    if (!name) {
      toast.error("Name is required.", { theme: "dark" });
      return;
    }

    // Check if trying to create Training type without permission
    if (name === "Training" && !hasTrainingAccess()) {
      toast.error("You don't have permission to create Training class type.", {
        theme: "dark",
      });
      return;
    }

    try {
      const res = await api.post("/class-types", { name });

      setClassTypeData((prevData) => [...prevData, res?.data?.classType]);
      setName("");
      setOpenModal(false);
      toast.success("Class type added successfully!", { theme: "dark" });
    } catch (error: any) {
      handleApiError(error);
    }
  };

  const deleteClassType = async (id: number) => {
    try {
      const classType = classTypeData.find((ct) => ct.id === id);
      if (classType?.name === "Training" && !hasTrainingAccess()) {
        toast.error(
          "You don't have permission to delete Training class type.",
          { theme: "dark" }
        );
        return;
      }

      await api.delete(`/class-types/${id}`);
      setClassTypeData((prevData) =>
        prevData.filter((classType) => classType.id !== id)
      );
      toast.success("Class type deleted successfully!", { theme: "dark" });
    } catch (error: any) {
      handleApiError(error);
    }
  };

  const openEditClassType = (classType: ClassType) => {
    if (classType.name === "Training" && !hasTrainingAccess()) {
      toast.error("You don't have permission to edit Training class type.", {
        theme: "dark",
      });
      return;
    }
    setSelectedClassType(classType);
    setName(classType.name);
    setOpenEditModal(true);
  };

  const updateClassType = async () => {
    if (!selectedClassType || !name) return;

    // Check if trying to update to Training type without permission
    if (name === "Training" && !hasTrainingAccess()) {
      toast.error(
        "You don't have permission to update to Training class type.",
        { theme: "dark" }
      );
      return;
    }

    try {
      const res = await api.put(`/class-types/${selectedClassType.id}`, {
        name,
      });

      setClassTypeData((prevData) =>
        prevData.map((classType) =>
          classType.id === selectedClassType.id ? res.data.classType : classType
        )
      );

      setOpenEditModal(false);
      setSelectedClassType(null);
      setName("");
      toast.success("Class type updated successfully!", { theme: "dark" });
    } catch (error: any) {
      handleApiError(error);
    }
  };

  const columns: TableColumnsType<ClassType> = (
    [
      {
        title: "No",
        dataIndex: "index",
        key: "index",
        width: "8%",
        fixed: "left",
        render: (_: any, __: any, index: number) => (
          <span className="font-medium text-gray-900 dark:text-white">
            {index + 1}
          </span>
        ),
      },
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        fixed: "left",
        sorter: (a: any, b: any) => a.name.localeCompare(b.name),
        render: (text: string) => {
          return (
            <span className="font-medium text-gray-900 dark:text-white">
              {text}
            </span>
          );
        },
      },
    ] as TableColumnsType<ClassType>
  ).concat(
    permissions.update || permissions.delete
      ? ([
          {
            title: "Action",
            key: "action",
            render: (_: any, record: ClassType) => (
              <Space size="middle">
                {permissions.update && (
                  <AntButton
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => openEditClassType(record)}
                    style={{ color: "white" }}
                  />
                )}
                {permissions.delete && (
                  <AntButton
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => deleteClassType(record.id)}
                    style={{ color: "#ef4444" }}
                  />
                )}
              </Space>
            ),
          },
        ] as TableColumnsType<ClassType>)
      : []
  );

  if (loading_1) {
    return <LoadingSpinner />;
  }

  const cardStyles = {
    header: {
      background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
      borderRadius: "12px 12px 0 0",
      padding: "12px 16px", // Reduced padding for mobile
      border: "none",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      "@media (min-width: 640px)": {
        padding: "16px 24px",
      },
    },
    body: {
      padding: "10px", // Reduced padding for mobile
      borderRadius: "0 0 12px 12px",
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      height: "110vh", // Changed from fixed height
      maxHeight: "100vh",
      "@media (min-width: 640px)": {
        padding: "20px",
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p- flex h-[84vh] w-full flex-col gap-4 overflow-y-auto md:p-6"
    >
      <Card
        title={
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-white">Class Type</span>
            <div className="size-2 animate-pulse rounded-full bg-green-400" />
          </div>
        }
        className="overflow-hidden rounded-xl border-0 shadow-lg transition-shadow hover:shadow-xl"
        headStyle={cardStyles.header}
        bodyStyle={cardStyles.body}
        extra={
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row">
            {permissions.create && (
              <Button
                gradientDuoTone="purpleToBlue"
                onClick={() => setOpenModal(true)}
              >
                Add Class Type
              </Button>
            )}
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={classTypeData}
          rowKey="id"
          className="dark:bg-gray-800"
          pagination={{
            position: ["bottomCenter"],
            showSizeChanger: true,
            showQuickJumper: true,
          }}
        />
      </Card>

      {permissions.create && (
        <Modal
          show={openModal}
          size="md"
          onClose={() => setOpenModal(false)}
          popup
          className="responsive-modal"
        >
          <Modal.Header className="border-b border-gray-200 dark:border-gray-700" />
          <Modal.Body>
            <div className="space-y-4">
              <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                Add Class Type
              </h3>
              <div>
                <Label htmlFor="name" value="Name" />
                <TextInput
                  id="name"
                  placeholder="Enter class type name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg"
                />
              </div>
              <div className="flex flex-col gap-2 pt-4 xs:flex-row">
                <Button
                  className="w-full xs:w-auto"
                  gradientDuoTone="purpleToBlue"
                  onClick={createClassType}
                >
                  Add
                </Button>
                <Button
                  className="w-full xs:w-auto"
                  color="gray"
                  onClick={() => setOpenModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>
      )}

      {permissions.update && (
        <Modal
          show={openEditModal}
          size="md"
          onClose={() => setOpenEditModal(false)}
          popup
          className="responsive-modal"
        >
          <Modal.Header className="border-b border-gray-200 dark:border-gray-700" />
          <Modal.Body>
            <div className="space-y-4">
              <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                Edit Class Type
              </h3>
              <div>
                <Label htmlFor="edit-name" value="Name" />
                <TextInput
                  id="edit-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg"
                />
              </div>
              <div className="flex flex-col gap-2 pt-4 xs:flex-row">
                <Button
                  className="w-full xs:w-auto"
                  gradientDuoTone="purpleToBlue"
                  onClick={updateClassType}
                >
                  Update
                </Button>
                <Button
                  className="w-full xs:w-auto"
                  color="gray"
                  onClick={() => setOpenEditModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal>
      )}
    </motion.div>
  );
}
