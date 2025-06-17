import { useState, useEffect } from "react";
import { Button, Checkbox, Label, Modal, TextInput } from "flowbite-react";
import api from "../../config";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { Table, TableColumnsType, Button as AntButton } from "antd";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { Space, Card } from "antd";
import { usePermissions } from "../../hooks/usePermission";
import LoadingSpinner from "../../components/LoadingSpinner";
import { motion } from "framer-motion";

// Geçerli class type ID'leri - sadece bunları göster
const VALID_CLASS_TYPE_IDS = [1, 2, 3]; // Trial-Lesson, Regular-Lesson, Training

export default function Teachers() {
  const navigate = useNavigate();
  const { permissions, loading_1 } = usePermissions("/users/teachers");
  const [teacherData, setTeacherData] = useState<any[]>([]);
  const [eachFirstName, setFirstName] = useState("");
  const [eachLastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [eachRates, setEachRates] = useState<any[]>([]);
  const [classType, setClassType] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!loading_1) {
      if (!permissions.read) {
        navigate("/");
        toast.error("You don't have permission to view this page", {
          theme: "dark",
        });
      } else {
        const fetchTeachers = async () => {
          try {
            setLoading(true);
            const res = await api.get("/teachers");
            setTeacherData(res.data || []);

            const res1 = await api.get("/class-types");
            setClassType(res1.data || []);
            setLoading(false);
          } catch (error: any) {
            handleApiError(error);
          }
        };

        fetchTeachers();
      }
    }
  }, [permissions, navigate, loading_1]);

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

  const createData = async () => {
    if (
      !eachFirstName ||
      !eachLastName ||
      !email ||
      !password ||
      !eachRates.length
    ) {
      toast.error("All fields are required.", { theme: "dark" });
      return;
    }

    try {
      const res = await api.post("/teachers", {
        first_name: eachFirstName,
        last_name: eachLastName,
        email: email,
        password: password,
        rates: eachRates,
      });

      setTeacherData([...res.data?.teachers]);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setEachRates([]);
      toast.success("Teacher created successfully!", { theme: "dark" });
      setOpenModal(false);
    } catch (error: any) {
      handleApiError(error);
    }
  };

  const deleteEachData = async (id: string) => {
    try {
      const res = await api.delete(`/teachers/${id}`);
      setTeacherData([...res.data?.teachers]);
      toast.success("Teacher deleted successfully!", { theme: "dark" });
    } catch (error: any) {
      handleApiError(error);
    }
  };

  const openEditTeacher = (teacher: any) => {
    setSelectedTeacher(teacher);
    setFirstName(teacher.first_name);
    setLastName(teacher.last_name);
    setEmail(teacher.email);
    setPassword("");
    setEachRates(teacher.TeacherRates || []);
    setOpenEditModal(true);
  };

  const updateTeacher = async () => {
    if (!selectedTeacher) return;

    try {
      const updateData: any = {
        first_name: eachFirstName,
        last_name: eachLastName,
        email: email,
      };

      if (password) {
        updateData.password = password;
      }

      await api.put(`/teachers/${selectedTeacher.id}`, updateData);

      await api.post(`/teachers/${selectedTeacher.id}/rates`, {
        rates: eachRates,
      });

      const res = await api.get("/teachers");
      setTeacherData([...res.data]);

      setOpenEditModal(false);
      setSelectedTeacher(null);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setEachRates([]);
      toast.success("Teacher updated successfully!", { theme: "dark" });
    } catch (error: any) {
      handleApiError(error);
    }
  };

  const handleRateChange = (classTypeId: number, value: string) => {
    setEachRates((prevRates) => {
      const updatedRates = [...prevRates];
      const index = updatedRates.findIndex(
        (rate) => rate.class_type_id === classTypeId,
      );

      if (index !== -1) {
        updatedRates[index].rate = value;
      } else {
        updatedRates.push({ class_type_id: classTypeId, rate: value });
      }
      return updatedRates;
    });
  };

  const columns: TableColumnsType<any> = (
    [
      {
        title: "First Name",
        dataIndex: "first_name",
        key: "first_name",
        fixed: "left",
        sorter: (a: any, b: any) => a.first_name.localeCompare(b.first_name),
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
        fixed: "left",
        sorter: (a: any, b: any) => a.last_name.localeCompare(b.last_name),
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
        sorter: (a: any, b: any) => a.email.localeCompare(b.email),
        render: (text: string) => (
          <span className="font-medium text-gray-900 dark:text-white">
            {text}
          </span>
        ),
      },
      {
        title: "Trial Rate",
        key: "trial_rate",
        render: (_: any, record: any) => {
          const rate = record.TeacherRates?.find((r: any) =>
            r.class_type?.name?.toLowerCase().includes("trial"),
          );
          return (
            <span className="font-medium text-gray-900 dark:text-white">
              {rate ? rate.rate : "-"}
            </span>
          );
        },
      },
      {
        title: "Regular Rate",
        key: "regular_rate",
        render: (_: any, record: any) => {
          const rate = record.TeacherRates?.find((r: any) =>
            r.class_type?.name?.toLowerCase().includes("regular"),
          );
          return (
            <span className="font-medium text-gray-900 dark:text-white">
              {rate ? rate.rate : "-"}
            </span>
          );
        },
      },
      {
        title: "Training Rate",
        key: "training_rate",
        render: (_: any, record: any) => {
          const rate = record.TeacherRates?.find((r: any) =>
            r.class_type?.name?.toLowerCase().includes("training"),
          );
          return (
            <span className="font-medium text-gray-900 dark:text-white">
              {rate ? rate.rate : "-"}
            </span>
          );
        },
      },
    ] as TableColumnsType<any>
  ).concat(
    permissions.update || permissions.delete
      ? [
          {
            title: "Action",
            key: "action",
            render: (_, record) => (
              <Space size="middle">
                {permissions.update && (
                  <AntButton
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => openEditTeacher(record)}
                    style={{ color: "white" }}
                  />
                )}
                {permissions.delete && (
                  <AntButton
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => deleteEachData(record.id)}
                    style={{ color: "#ef4444" }}
                  />
                )}
              </Space>
            ),
          },
        ]
      : [],
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
      className="flex h-[84vh] w-full flex-col gap-4 overflow-y-auto p-3 md:p-6"
    >
      <Card
        title={
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-white">Teachers</span>
            <div className="size-2 animate-pulse rounded-full bg-green-400" />
          </div>
        }
        className="overflow-hidden rounded-xl border-0 shadow-lg transition-shadow hover:shadow-xl"
        headStyle={cardStyles.header}
        bodyStyle={cardStyles.body}
        extra={
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row">
            {permissions.create && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-900 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={() => {
                  setOpenModal(true);
                  setFirstName("");
                  setLastName("");
                  setEmail("");
                  setPassword("");
                  setEachRates([]);
                }}
              >
                + Add Teacher
              </motion.button>
            )}
          </div>
        }
      >
        <div className="custom-table overflow-hidden rounded-lg shadow-md">
          <Table
            style={{ width: "100%" }}
            columns={columns}
            dataSource={teacherData.map((item, index) => ({
              ...item,
              key: index,
            }))}
            loading={{
              spinning: loading,
              size: "large",
            }}
            pagination={false}
            scroll={{ x: "max-content", y: "calc(83vh - 200px)" }}
            size="large"
            className="custom-table"
          />
        </div>
      </Card>

      {/* Add Teacher Modal */}
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
              Add Teacher
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="first_name" value="First Name" />
                <TextInput
                  id="first_name"
                  placeholder="Jack"
                  required
                  value={eachFirstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg"
                />
              </div>
              <div>
                <Label htmlFor="last_name" value="Last Name" />
                <TextInput
                  id="last_name"
                  placeholder="Smith"
                  required
                  value={eachLastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="email" value="Email" />
                <TextInput
                  id="email"
                  type="email"
                  placeholder="teacher@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg"
                />
              </div>
              <div>
                <Label htmlFor="password" value="Password" />
                <TextInput
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label value="Class Types and Rates" />
              {classType
                .filter((item) => VALID_CLASS_TYPE_IDS.includes(item.id))
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col items-start gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-700 xs:flex-row xs:items-center xs:gap-4"
                  >
                    <div className="flex min-w-[150px] items-center gap-2">
                      <Checkbox
                        id={`class_type_${item.id}`}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEachRates((prev) => [
                              ...prev,
                              { class_type_id: item.id, rate: "" },
                            ]);
                          } else {
                            setEachRates((prev) =>
                              prev.filter(
                                (rate) => rate.class_type_id !== item.id,
                              ),
                            );
                          }
                        }}
                      />
                      <Label htmlFor={`class_type_${item.id}`} className="mb-0">
                        {item.name}
                      </Label>
                    </div>
                    <TextInput
                      id={`rate_per_type_${item.id}`}
                      type="number"
                      placeholder="Rate"
                      value={
                        eachRates.find((rate) => rate.class_type_id === item.id)
                          ?.rate || ""
                      }
                      onChange={(e) =>
                        handleRateChange(item.id, e.target.value)
                      }
                      disabled={
                        !eachRates.some(
                          (rate) => rate.class_type_id === item.id,
                        )
                      }
                      className="w-full xs:w-32"
                    />
                  </div>
                ))}
            </div>

            <div className="flex flex-col gap-2 pt-4 xs:flex-row">
              <Button
                className="w-full xs:w-auto"
                gradientDuoTone="purpleToBlue"
                onClick={createData}
              >
                Add Teacher
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

      {/* Edit Teacher Modal */}
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
                Edit Teacher
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit_first_name" value="First Name" />
                  <TextInput
                    id="edit_first_name"
                    required
                    value={eachFirstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_last_name" value="Last Name" />
                  <TextInput
                    id="edit_last_name"
                    required
                    value={eachLastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit_email" value="Email" />
                  <TextInput
                    id="edit_email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="edit_password"
                    value="New Password (optional)"
                  />
                  <TextInput
                    id="edit_password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="w-full rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label value="Class Types and Rates" />
                {classType
                  .filter((item) => VALID_CLASS_TYPE_IDS.includes(item.id))
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col items-start gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-700 xs:flex-row xs:items-center xs:gap-4"
                    >
                      <div className="flex min-w-[150px] items-center gap-2">
                        <Checkbox
                          id={`edit_class_type_${item.id}`}
                          checked={eachRates.some(
                            (rate) => rate.class_type_id === item.id,
                          )}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEachRates((prev) => [
                                ...prev,
                                {
                                  class_type_id: item.id,
                                  rate: "",
                                  id: selectedTeacher?.id,
                                },
                              ]);
                            } else {
                              setEachRates((prev) =>
                                prev.filter(
                                  (rate) => rate.class_type_id !== item.id,
                                ),
                              );
                            }
                          }}
                        />
                        <Label
                          htmlFor={`edit_class_type_${item.id}`}
                          className="mb-0"
                        >
                          {item.name}
                        </Label>
                      </div>
                      <TextInput
                        id={`edit_rate_per_type_${item.id}`}
                        type="number"
                        placeholder="Rate"
                        value={
                          eachRates.find(
                            (rate) => rate.class_type_id === item.id,
                          )?.rate || ""
                        }
                        onChange={(e) =>
                          handleRateChange(item.id, e.target.value)
                        }
                        disabled={
                          !eachRates.some(
                            (rate) => rate.class_type_id === item.id,
                          )
                        }
                        className="w-full xs:w-32"
                      />
                    </div>
                  ))}
              </div>

              <div className="flex flex-col gap-2 pt-4 xs:flex-row">
                <Button
                  className="w-full xs:w-auto"
                  gradientDuoTone="purpleToBlue"
                  onClick={updateTeacher}
                >
                  Update Teacher
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
