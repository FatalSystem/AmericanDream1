import React, { useState, useEffect } from "react";
import { Button, Modal, Label, TextInput, Select } from "flowbite-react";
import {
  Table,
  TableColumnsType,
  Button as AntButton,
  Space,
  DatePicker,
  TimePicker,
  Card,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  DownloadOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import api from "../../config";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { usePermissions } from "../../hooks/usePermission";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import { useTimezone } from "../../contexts/TimezoneContext";
import { motion } from "framer-motion";
import { 
  convertTimeToUserTimezone, 
  convertTimeToDbTimezone,
  formatTime,
  getDayShift,
  DEFAULT_DB_TIMEZONE
} from "../../utils/timezone";

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Geçerli class type ID'leri - sadece bunları göster
const VALID_CLASS_TYPE_IDS = [1, 2, 3]; // Trial-Lesson, Regular-Lesson, Training

interface Payment {
  id: number;
  amount: number;
  num_lessons: number;
  payment_method: string;
  Student: { id: number; first_name: string; last_name: string };
  class_type: { id: number; name: string };
  payment_date: string;
  payment_time: string;
}

interface Student {
  id: number;
  first_name: string;
  last_name: string;
}

interface ClassType {
  id: number;
  name: string;
}

const PaymentComponent: React.FC = () => {
  const navigate = useNavigate();
  const { permissions, loading_1 } = usePermissions("/payments");
  const auth = useAuth();
  const { timezone } = useTimezone();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [showStripeModal, setShowStripeModal] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedClassType, setSelectedClassType] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<string>("");
  const [amount, setAmount] = useState("");
  const [numLessons, setNumLessons] = useState("");

  const [openModal, setOpenModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const [loading, setLoading] = useState(false);

  const [paymentDate, setPaymentDate] = useState<Dayjs | null>(null);
  const [paymentTime, setPaymentTime] = useState<Dayjs | null>(null);

  const payMethods = ["Credit card", "PayPal", "Zelle", "CashApp", "Stripe"];

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
      height: "auto", // Changed from fixed height
      maxHeight: "100vh",
      "@media (min-width: 640px)": {
        padding: "20px",
      },
    },
  };

  // Add state for Stripe script loading status
  const [stripeScriptLoaded, setStripeScriptLoaded] = useState(false);
  const [stripeScriptError, setStripeScriptError] = useState(false);

  useEffect(() => {
    // Check for URL parameters after Stripe redirect
    const queryParams = new URLSearchParams(window.location.search);
    const success = queryParams.get('success');
    const canceled = queryParams.get('canceled');
    const sessionId = queryParams.get('session_id'); // Stripe session ID
    
    // Get product information from query parameters (alternative to session ID)
    const product = queryParams.get('product');
    const quantity = queryParams.get('quantity');
    const amount = queryParams.get('amount');
    
    // Log all URL parameters for debugging
    console.log("🔍 URL Parameters:", {
      success,
      canceled,
      sessionId,
      product,
      quantity,
      amount,
      fullUrl: window.location.href,
      allParams: Object.fromEntries(queryParams.entries())
    });
    
    if (success === 'true') {
      // Check if we have session ID
      if (sessionId) {
        // Use Stripe API to get session details
        console.log("🔄 Checking Stripe payment with session ID:", sessionId);
        getStripeSessionDetails(sessionId);
      }
      // Otherwise if we have product, quantity and amount
      else if (product && quantity && amount) {
        // Record payment using direct parameters
        console.log("🔄 Recording payment from URL parameters:", {product, quantity, amount});
        recordPaymentFromParams(product, quantity, amount);
      }
      // If we have neither session ID nor parameters
      else {
        console.warn("⚠️ Payment success but missing session_id and product parameters");
        toast.warning("Payment successful but we couldn't get all details. Please contact support.", { 
          theme: "dark" 
        });
      }
      
      // Remove the query parameters from URL after processing
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log("🧹 Cleaned URL parameters");
      
    } else if (canceled === 'true') {
      console.log("❌ Payment was canceled by user");
      toast.info("Payment was canceled.", { theme: "dark" });
      
      // Remove the query parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  
  // Function to get Stripe session details and record the payment
  const getStripeSessionDetails = async (sessionId: string) => {
    try {
      if (!auth.user?.id) {
        console.error("Cannot record payment: User ID not available");
        return;
      }
      
      console.log("🔍 Getting Stripe session details from backend API");
      
      // Call our backend to check the Stripe session and get details
      const stripeSessionResponse = await api.get(`/stripe/check-session/${sessionId}`);
      
      console.log("✅ Stripe session details:", stripeSessionResponse.data);
      
      // Extract payment details from the session
      const { 
        amount_total = 0,
        product_name,
        quantity = 1
      } = stripeSessionResponse.data;
      
      // Determine product type and class type
      let classTypeId = 1; // Trial-Lesson by default
      if (product_name && product_name.toLowerCase().includes('regular')) {
        classTypeId = 2; // Regular-Lesson
      }
      
      // Format amount from cents to dollars
      const amountInDollars = amount_total / 100;
      
      // Call the API to record the payment
      console.log("⭐ Sending payment to API:", {
        endpointUrl: "/payments",
        method: "POST",
        requestData: {
          student_id: auth.user.id,
          class_type_id: classTypeId,
          class_type_name: classTypeId === 1 ? "Trial-Lesson" : "Regular-Lesson",
          amount: amountInDollars,
          num_lessons: quantity,
          payment_method: "Stripe",
          payment_session_id: sessionId,
          paymentDate: dayjs().format("YYYY-MM-DD"),
          payment_time: dayjs().format("HH:mm:ss")
        }
      });
      
      // Call the API to record the payment
      const res = await api.post("/payments", {
        student_id: auth.user.id,
        class_type_id: classTypeId,
        amount: amountInDollars,
        num_lessons: quantity,
        payment_method: "Stripe",
        payment_session_id: sessionId,
        paymentDate: dayjs().format("YYYY-MM-DD"),
        payment_time: dayjs().format("HH:mm:ss")
      });
      
      // Log successful API response
      console.log(`✅ Payment API Response:`, res.data);
      console.log(`✅ Stripe payment recorded: ${quantity} lessons for $${amountInDollars}`);
      
      // Show success notification with more details
      toast.success(`Payment successful! ${quantity} ${classTypeId === 1 ? "trial" : "regular"} lesson(s) added.`, { 
        theme: "dark",
        autoClose: 5000 // Stay visible longer
      });
      
      // Update the payments list with the new payment
      if (res.data.payments) {
        setPayments(res.data.payments);
        console.log(`✅ Updated payments table with ${res.data.payments.length} records`);
      }
      
      // Refresh payment data
      if (!loading_1 && permissions.read) {
        console.log("🔄 Refreshing payment data...");
        fetchData();
      }
      
    } catch (error: any) {
      // Log detailed error
      console.error("❌ Error recording Stripe payment:", error);
      console.error("❌ Error details:", {
        message: error.message,
        response: error.response?.data || "No response data",
        status: error.response?.status || "No status code"
      });
      
      // Show a more helpful error to the user
      toast.error("Payment was successful, but we couldn't update your lessons. Please contact support.", {
        theme: "dark",
        autoClose: false // Requires manual closing
      });
    }
  };

  // Function to record payment from URL parameters
  const recordPaymentFromParams = async (
    productType: string, 
    quantityStr: string, 
    amountStr: string
  ) => {
    try {
      if (!auth.user?.id) {
        console.error("Cannot record payment: User ID not available");
        return;
      }
      
      // Parse values
      const quantity = parseInt(quantityStr);
      const amount = parseInt(amountStr);
      
      // Class type ID based on product type
      let classTypeId = 1; // Trial-Lesson by default
      
      if (productType === 'regular') {
        classTypeId = 2; // Regular-Lesson
      }
      
      // Validate values
      if (isNaN(quantity) || isNaN(amount) || quantity <= 0 || amount <= 0) {
        throw new Error(`Invalid amount or quantity: amount=${amount}, quantity=${quantity}`);
      }
      
      // Call the API to record the payment
      console.log("⭐ Sending payment to API:", {
        endpointUrl: "/payments",
        method: "POST",
        requestData: {
          student_id: auth.user.id,
          class_type_id: classTypeId,
          class_type_name: classTypeId === 1 ? "Trial-Lesson" : "Regular-Lesson",
          amount: amount,
          num_lessons: quantity,
          payment_method: "Stripe",
          paymentDate: dayjs().format("YYYY-MM-DD"),
          payment_time: dayjs().format("HH:mm:ss")
        }
      });
      
      // Call the API to record the payment
      const res = await api.post("/payments", {
        student_id: auth.user.id,
        class_type_id: classTypeId,
        amount: amount,
        num_lessons: quantity,
        payment_method: "Stripe",
        paymentDate: dayjs().format("YYYY-MM-DD"),
        payment_time: dayjs().format("HH:mm:ss")
      });
      
      // Log successful API response
      console.log(`✅ Payment API Response:`, res.data);
      console.log(`✅ Stripe payment recorded: ${quantity} lessons for $${amount}`);
      
      // Show success notification with more details
      toast.success(`Payment successful! ${quantity} ${classTypeId === 1 ? "trial" : "regular"} lesson(s) added.`, { 
        theme: "dark",
        autoClose: 5000 // Stay visible longer
      });
      
      // Update the payments list with the new payment
      if (res.data.payments) {
        setPayments(res.data.payments);
        console.log(`✅ Updated payments table with ${res.data.payments.length} records`);
      }
      
      // Refresh payment data
      if (!loading_1 && permissions.read) {
        console.log("🔄 Refreshing payment data...");
        fetchData();
      }
      
    } catch (error: any) {
      // Log detailed error
      console.error("❌ Error recording Stripe payment:", error);
      console.error("❌ Error details:", {
        message: error.message,
        response: error.response?.data || "No response data",
        status: error.response?.status || "No status code"
      });
      
      // Show a more helpful error to the user
      toast.error("Payment was successful, but we couldn't update your lessons. Please contact support.", {
        theme: "dark",
        autoClose: false // Requires manual closing
      });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, studentsRes, classTypesRes] = await Promise.all(
        [
          auth.user?.role === "student"
            ? api.get(`/payments/student/${auth.user.id}`)
            : api.get("/payments"),
          api.get("/students"),
          api.get("/class-types"),
        ],
      );

      // Format payment data with timezone conversions
      const formattedPayments = (paymentsRes.data.payments || []).map((payment: Payment) => {
        // Process the payment date and time for display in the user's timezone
        const processedPayment = { ...payment };
        
        // Store original values for timezone conversion
        processedPayment.payment_date = payment.payment_date;
        processedPayment.payment_time = payment.payment_time;
        
        return processedPayment;
      });

      setPayments(formattedPayments);
      
      // Sort students alphabetically by first name and then last name
      const sortedStudents = [...(studentsRes.data || [])].sort((a, b) => {
        // First sort by first_name
        const firstNameComparison = a.first_name.localeCompare(b.first_name);
        // If first names are the same, sort by last_name
        return firstNameComparison !== 0 
          ? firstNameComparison 
          : a.last_name.localeCompare(b.last_name);
      });
      setStudents([...sortedStudents]);
      setClassTypes(classTypesRes.data || []);
      setLoading(false);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      handleApiError(error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading_1) {
      if (!permissions.read) {
        navigate("/");
        toast.error("You don't have permission to view this page", {
          theme: "dark",
        });
      } else {
        fetchData();
      }
    }
  }, [permissions, navigate, loading_1, timezone]);

  const createPayment = async () => {
    if (
      !selectedStudent ||
      !selectedClassType ||
      !amount ||
      !numLessons ||
      !selectedPaymentMethod ||
      !paymentDate
    ) {
      toast.error("All fields are required.", { theme: "dark" });
      return;
    }

    try {
      // Convert paymentTime to database timezone (PST) for storage
      const dbTimeString = paymentTime ? 
        convertTimeToDbTimezone(paymentTime.format('HH:mm:ss'), timezone) : 
        null;

      // Check if we need to adjust the date due to timezone differences
      let paymentDateStr = paymentDate.format("YYYY-MM-DD");
      if (paymentTime) {
        const dayShift = getDayShift(paymentTime.format('HH:mm:ss'), timezone, DEFAULT_DB_TIMEZONE);
        if (dayShift !== 0) {
          // Adjust the date by the number of days shifted
          paymentDateStr = paymentDate.add(dayShift, 'day').format("YYYY-MM-DD");
        }
      }

      const res = await api.post("/payments", {
        student_id: selectedStudent,
        class_type_id: selectedClassType,
        amount,
        num_lessons: numLessons,
        payment_method: selectedPaymentMethod,
        paymentDate: paymentDateStr,
        payment_time: dbTimeString
      });

      setPayments([...res.data.payments]);

      // Reset form
      setSelectedStudent("");
      setSelectedClassType("");
      setSelectedPaymentMethod("");
      setAmount("");
      setNumLessons("");
      setPaymentDate(null);
      setPaymentTime(null);
      setOpenModal(false);

      toast.success("Payment added successfully!", { theme: "dark" });
    } catch (error: any) {
      console.error("Error creating payment:", error);
      handleApiError(error);
    }
  };

  const deletePayment = async (id: number) => {
    try {
      await api.delete(`/payments/${id}`);
      setPayments((prevPayments) =>
        prevPayments.filter((payment) => payment.id !== id),
      );
      toast.success("Payment deleted successfully!", { theme: "dark" });
    } catch (error: any) {
      console.error("Error deleting payment:", error);
      handleApiError(error);
    }
  };

  const openEditPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setSelectedStudent(payment.Student.id.toString());
    setSelectedClassType(payment.class_type.id.toString());
    setSelectedPaymentMethod(payment.payment_method);
    setAmount(payment.amount.toString());
    setNumLessons(payment.num_lessons.toString());
    setPaymentDate(payment.payment_date ? dayjs(payment.payment_date) : null);
    
    // Convert payment time from database timezone to user timezone
    if (payment.payment_time) {
      const userTimeString = convertTimeToUserTimezone(payment.payment_time, timezone);
      setPaymentTime(userTimeString ? dayjs(`2000-01-01 ${userTimeString}`) : null);
    } else {
      setPaymentTime(null);
    }
    
    setOpenEditModal(true);
  };

  const updatePayment = async () => {
    if (!selectedPayment) return;

    try {
      // Convert paymentTime to database timezone (PST) for storage
      const dbTimeString = paymentTime ? 
        convertTimeToDbTimezone(paymentTime.format('HH:mm:ss'), timezone) : 
        null;

      // Check if we need to adjust the date due to timezone differences
      let paymentDateStr = paymentDate ? paymentDate.format("YYYY-MM-DD") : null;
      if (paymentTime && paymentDate) {
        const dayShift = getDayShift(paymentTime.format('HH:mm:ss'), timezone, DEFAULT_DB_TIMEZONE);
        if (dayShift !== 0) {
          // Adjust the date by the number of days shifted
          paymentDateStr = paymentDate.add(dayShift, 'day').format("YYYY-MM-DD");
        }
      }

      const res = await api.put(`/payments/${selectedPayment.id}`, {
        student_id: selectedStudent,
        class_type_id: selectedClassType,
        amount,
        num_lessons: numLessons,
        payment_method: selectedPaymentMethod,
        paymentDate: paymentDateStr,
        payment_time: dbTimeString
      });

      setPayments(res.data.payments || []);

      setOpenEditModal(false);
      setSelectedPayment(null);
      setPaymentDate(null);
      setPaymentTime(null);
      toast.success("Payment updated successfully!", { theme: "dark" });
    } catch (error: any) {
      console.error("Error updating payment:", error);
      handleApiError(error);
    }
  };

  const handleApiError = (error: any) => {
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem("token");
        toast.error("Session expired. Please login again.", { theme: "dark" });
        navigate("/");
      } else {
        toast.error("Failed to perform the action. Please try again.", {
          theme: "dark",
        });
      }
    } else {
      toast.error("Network error. Please check your connection.", {
        theme: "dark",
      });
    }
  };

  const downloadCSV = () => {
    if (payments.length === 0) {
      toast.error("No data available to download.", { theme: "dark" });
      return;
    }

    // Convert payment data to CSV format
    const csvData = payments.map((payment) => {
      // Get time in user timezone for display
      const userTimeString = payment.payment_time ? 
        convertTimeToUserTimezone(payment.payment_time, timezone) : null;
      
      // Adjust payment date if needed due to timezone differences
      let adjustedDate = payment.payment_date;
      if (payment.payment_time) {
        const dayShift = getDayShift(payment.payment_time, DEFAULT_DB_TIMEZONE, timezone);
        if (dayShift !== 0) {
          // Adjust the date by the number of days shifted
          adjustedDate = dayjs(payment.payment_date).add(dayShift, 'day').format("YYYY-MM-DD");
        }
      }
      
      return {
        "Student Name": `${payment.Student.first_name} ${payment.Student.last_name}`,
        "Class Type": payment.class_type.name,
        "Amount": payment.amount,
        "Number of Lessons": payment.num_lessons,
        "Payment Method": payment.payment_method,
        "Payment Date": adjustedDate || "-",
        "Payment Time": userTimeString ? formatTime(userTimeString, "HH:mm") : "-",
        "Timezone": timezone.replace(/_/g, ' ')
      };
    });

    // Convert to CSV string
    const csv = Papa.unparse(csvData);

    // Create a blob and trigger the download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "payments.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to handle Buy More Lessons button click
  const handleBuyMoreLessons = () => {
    setShowStripeModal(true);
  };

  // Update the useEffect for Stripe script loading with error handling
  useEffect(() => {
    if (showStripeModal) {
      // Load Stripe script if it hasn't been loaded yet
      if (!document.querySelector('script[src="https://js.stripe.com/v3/pricing-table.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/pricing-table.js';
        script.async = true;
        
        // Add event listeners for script loading success and failure
        script.onload = () => {
          setStripeScriptLoaded(true);
          setStripeScriptError(false);
        };
        
        script.onerror = () => {
          setStripeScriptError(true);
          setStripeScriptLoaded(false);
          toast.error("Failed to load payment system. Please try again later.", { theme: "dark" });
        };
        
        document.body.appendChild(script);
      } else {
        // Script already loaded
        setStripeScriptLoaded(true);
      }
    }
  }, [showStripeModal]);

  const columns: TableColumnsType<any> = (
    [
      {
        title: "No",
        dataIndex: "index",
        key: "index",
        width: "5%",
        fixed: "left",
        render: (_: any, __: any, index: number) => index + 1,
        onCell: () => ({ className: "text-gray-600 dark:text-gray-400" }),
      },
      {
        title: "Student",
        key: "student",
        fixed: "left",
        render: (_: any, record: any) => 
          `${record.Student.first_name} ${record.Student.last_name}`,
        onCell: () => ({ className: "font-medium text-gray-900 dark:text-white" }),
        sorter: (a: any, b: any) =>
          `${a.Student.first_name} ${a.Student.last_name}`.localeCompare(
            `${b.Student.first_name} ${b.Student.last_name}`,
          ),
        ...(auth.user?.role !== "student" && {
          filters: students
            .map((student) => ({
              text: `${student.first_name} ${student.last_name}`,
              value: `${student.first_name} ${student.last_name}`,
            }))
            .sort((a, b) => a.text.localeCompare(b.text)),
          onFilter: (value: any, record: any) =>
            `${record.Student.first_name} ${record.Student.last_name}`.includes(
              value,
            ),
        }),
      },
      {
        title: "Class Type",
        key: "class_type",
        render: (_: any, record: any) => record.class_type.name,
        onCell: () => ({ className: "font-medium text-blue-600 dark:text-blue-400" }),
        sorter: (a: any, b: any) =>
          a.class_type.name.localeCompare(b.class_type.name),
        filters: classTypes
          .filter(classType => VALID_CLASS_TYPE_IDS.includes(classType.id))
          .map((classType) => ({
            text: classType.name,
            value: classType.name,
          })),
        onFilter: (value: any, record: any) =>
          record.class_type.name.includes(value),
      },
      {
        title: "Sum",
        dataIndex: "amount",
        key: "amount",
        sorter: (a: any, b: any) => a.amount - b.amount,
        render: (value: number) => `${value}$`,
        onCell: () => ({ className: "font-medium text-green-600 dark:text-green-400" }),
      },
      {
        title: "Lessons",
        dataIndex: "num_lessons",
        key: "num_lessons",
        width: "10%",
        sorter: (a: any, b: any) => a.num_lessons - b.num_lessons,
        onCell: () => ({ className: "font-medium text-red-600 dark:text-red-400" }),
      },
      {
        title: "Pay with",
        dataIndex: "payment_method",
        key: "payment_method",
        sorter: (a: any, b: any) =>
          a.payment_method.localeCompare(b.payment_method),
        onCell: () => ({ className: "font-medium text-purple-600 dark:text-purple-400" }),
      },
      {
        title: "Payment Date",
        key: "payment_date",
        render: (_: any, record: any) => {
          if (!record.payment_date) {
            return "-";
          }
          
          // Adjust payment date if needed due to timezone differences
          let adjustedDate = record.payment_date;
          if (record.payment_time) {
            const dayShift = getDayShift(record.payment_time, DEFAULT_DB_TIMEZONE, timezone);
            if (dayShift !== 0) {
              // Adjust the date by the number of days shifted
              adjustedDate = dayjs(record.payment_date).add(dayShift, 'day').format("YYYY-MM-DD");
            }
          }
          
          return dayjs(adjustedDate).format("YYYY-MM-DD");
        },
        onCell: () => ({ className: "font-medium text-gray-900 dark:text-white" }),
        sorter: (a: any, b: any) => {
          if (!a.payment_date) return -1;
          if (!b.payment_date) return 1;
          return dayjs(a.payment_date).unix() - dayjs(b.payment_date).unix();
        },
      },
      {
        title: "Payment Time",
        dataIndex: "payment_time",
        key: "payment_time",
        width: "14%",
        render: (text: string) => {
          if (!text) {
            return (
              <span className="font-medium text-gray-400">--:--</span>
            );
          }
          
          // Convert to user timezone
          const userTime = convertTimeToUserTimezone(text, timezone);
          if (!userTime) {
            return (
              <span className="font-medium text-gray-400">--:--</span>
            );
          }
          
          return (
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {formatTime(userTime, "HH:mm")}
            </span>
          );
        },
        sorter: (a: any, b: any) => {
          if (!a.payment_time) return -1;
          if (!b.payment_time) return 1;
          return a.payment_time.localeCompare(b.payment_time);
        },
      },
    ] as TableColumnsType<any>
  ).concat(
    permissions.update || permissions.delete
      ? [
          {
            title: "Action",
            key: "action",
            render: (_: any, record: any) => (
              <Space size="middle">
                {permissions.update && (
                  <AntButton
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => openEditPayment(record)}
                    style={{ color: "white" }}
                  />
                )}
                {permissions.delete && (
                  <AntButton
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => deletePayment(record.id)}
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
            <span className="text-lg font-semibold text-white">Payments</span>
            <div className="size-2 animate-pulse rounded-full bg-green-400" />
          </div>
        }
        className="overflow-hidden rounded-xl border-0 shadow-lg transition-shadow hover:shadow-xl"
        headStyle={cardStyles.header}
        bodyStyle={cardStyles.body}
        extra={
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row">
 
            {/* Action Buttons Container */}
            <div className="flex flex-col gap-2 xs:flex-row">
              {auth.user?.role === "student" && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:from-emerald-600 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                  onClick={handleBuyMoreLessons}
                >
                  <ShoppingCartOutlined className="mr-2 text-lg" />
                  BUY MORE LESSONS
                </motion.button>
              )}
              
              {permissions.create && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-900 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  onClick={() => {
                    setOpenModal(true);
                    setSelectedStudent("");
                    setSelectedClassType("");
                    setSelectedPaymentMethod("");
                    setAmount("");
                    setNumLessons("");
                  }}
                >
                  <PlusOutlined className="mr-2" />
                  Add Payment
                </motion.button>
              )}

              {permissions.download && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                  onClick={downloadCSV}
                >
                  <DownloadOutlined className="mr-2" />
                  Download CSV
                </motion.button>
              )}
            </div>
          </div>
        }
      >
        <div className="custom-table overflow-hidden rounded-lg shadow-md">
          <Table
            style={{ width: "100%" }}
            className="custom-table"
            columns={columns}
            dataSource={payments.map((item, index) => ({
              ...item,
              key: index,
            }))}
            pagination={false}
            loading={{
              spinning: loading,
              size: "large",
            }}
            scroll={{ x: "max-content", y: "calc(80vh - 200px)" }}
            size="middle"
          />
        </div>
      </Card>

      {/* Add Payment Modal */}
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
              Add Payment
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="student" value="Student" />
                <Select
                  id="student"
                  required
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full rounded-lg"
                >
                  <option value="">Select Student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="classType" value="Class Type" />
                <Select
                  id="classType"
                  required
                  value={selectedClassType}
                  onChange={(e) => setSelectedClassType(e.target.value)}
                  className="w-full rounded-lg"
                >
                  <option value="">Select Class Type</option>
                  {classTypes
                    .filter(classType => VALID_CLASS_TYPE_IDS.includes(classType.id))
                    .map((classType) => (
                      <option key={classType.id} value={classType.id}>
                        {classType.name}
                      </option>
                    ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="amount" value="Total Amount" />
                <TextInput
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg"
                />
              </div>
              <div>
                <Label htmlFor="numLessons" value="Number of Lessons" />
                <TextInput
                  id="numLessons"
                  type="number"
                  value={numLessons}
                  onChange={(e) => setNumLessons(e.target.value)}
                  className="w-full rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="paymentMethod" value="Payment Method" />
                <Select
                  id="paymentMethod"
                  required
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-full rounded-lg"
                >
                  <option value="">Select Payment Method</option>
                  {payMethods.map((methods: any, key: number) => (
                    <option key={key} value={methods}>
                      {methods}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="payment_date" value="Payment Date" />
                <DatePicker
                  id="payment_date"
                  size="large"
                  style={{
                    width: "100%",
                    backgroundColor: "#374151",
                    borderColor: "#4B5563",
                    color: "white",
                  }}
                  value={paymentDate}
                  onChange={(date) => setPaymentDate(date)}
                  placeholder="Select payment date"
                  className="rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="payment_time" value="Payment Time" />
                <TimePicker
                  id="payment_time"
                  size="large"
                  style={{
                    width: "100%",
                    backgroundColor: "#374151",
                    borderColor: "#4B5563",
                    color: "white",
                  }}
                  value={paymentTime}
                  onChange={(time) => setPaymentTime(time)}
                  placeholder="Select payment time"
                  format="HH:mm"
                  className="rounded-lg"
                />
                <div className="mt-1 text-xs text-gray-400">
                  Time in your local timezone ({timezone.replace(/_/g, ' ')})
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-4 xs:flex-row">
              <Button
                className="w-full xs:w-auto"
                gradientDuoTone="purpleToBlue"
                onClick={createPayment}
              >
                Add Payment
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

      {/* Edit Payment Modal - Similar updates to Add Payment Modal */}
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
                Edit Payment
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="student" value="Student" />
                  <Select
                    id="student"
                    required
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="w-full rounded-lg"
                  >
                    <option value="">Select Student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.last_name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="classType" value="Class Type" />
                  <Select
                    id="classType"
                    required
                    value={selectedClassType}
                    onChange={(e) => setSelectedClassType(e.target.value)}
                    className="w-full rounded-lg"
                  >
                    <option value="">Select Class Type</option>
                    {classTypes
                      .filter(classType => VALID_CLASS_TYPE_IDS.includes(classType.id))
                      .map((classType) => (
                        <option key={classType.id} value={classType.id}>
                          {classType.name}
                        </option>
                      ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="amount" value="Total Amount" />
                  <TextInput
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="numLessons" value="Number of Lessons" />
                  <TextInput
                    id="numLessons"
                    type="number"
                    value={numLessons}
                    onChange={(e) => setNumLessons(e.target.value)}
                    className="w-full rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="paymentMethod" value="Payment Method" />
                  <Select
                    id="paymentMethod"
                    required
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    className="w-full rounded-lg"
                  >
                    <option value="">Select Payment Method</option>
                    {payMethods.map((methods: any, key: number) => (
                      <option key={key} value={methods}>
                        {methods}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_payment_date" value="Payment Date" />
                  <DatePicker
                    id="edit_payment_date"
                    size="large"
                    style={{
                      width: "100%",
                      backgroundColor: "#374151",
                      borderColor: "#4B5563",
                      color: "white",
                    }}
                    value={paymentDate}
                    onChange={(date) => setPaymentDate(date)}
                    placeholder="Select payment date"
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit_payment_time" value="Payment Time" />
                  <TimePicker
                    id="edit_payment_time"
                    size="large"
                    style={{
                      width: "100%",
                      backgroundColor: "#374151",
                      borderColor: "#4B5563",
                      color: "white",
                    }}
                    value={paymentTime}
                    onChange={(time) => setPaymentTime(time)}
                    placeholder="Select payment time"
                    format="HH:mm"
                    className="rounded-lg"
                  />
                  <div className="mt-1 text-xs text-gray-400">
                    Time in your local timezone ({timezone.replace(/_/g, ' ')})
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4 xs:flex-row">
                <Button
                  className="w-full xs:w-auto"
                  gradientDuoTone="purpleToBlue"
                  onClick={updatePayment}
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

      {/* Stripe Payment Modal */}
      <Modal
        show={showStripeModal}
        size="xxl"
        onClose={() => setShowStripeModal(false)}
        popup
        className="responsive-modal stripe-modal"
        dismissible
        style={{backgroundColor: "#0f172a"}}
      >
        <Modal.Header className="border-b border-gray-200 dark:border-gray-700" style={{backgroundColor: "#0f172a"}}>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">
            Purchase Lessons
          </h3>
        </Modal.Header>
        <Modal.Body style={{backgroundColor: "#0f172a", padding: "1rem", overflow: "visible"}}>
          <div className="flex h-full flex-col">
            <div className="stripe-container grow" style={{ width: "100%" }}>
              {stripeScriptError ? (
                <div className="flex size-full flex-col items-center justify-center bg-[#0f172a] p-8">
                  <div className="mb-4 text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-white">Payment System Error</h3>
                  <p className="mb-4 text-gray-400">We couldn't load the payment system. Please try again later.</p>
                  <Button
                    gradientDuoTone="purpleToBlue"
                    onClick={() => {
                      setStripeScriptError(false);
                      setShowStripeModal(false);
                    }}
                  >
                    Close
                  </Button>
                </div>
              ) : !stripeScriptLoaded ? (
                <div className="flex size-full flex-col items-center justify-center bg-[#0f172a] p-8">
                  <div className="mb-4">
                    <div className="size-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-t-transparent"></div>
                  </div>
                  <p className="text-lg text-gray-300">Loading payment system...</p>
                </div>
              ) : (
                <div className="stripe-wrapper">
                  {/* Use different pricing table ID if the user already has lessons */}
                  {payments.length > 0 ? (
                    <stripe-pricing-table 
                      pricing-table-id="prctbl_1RMRqnL9NNHa18lJW0uXIc1T"
                      publishable-key="pk_live_51NyyfsL9NNHa18lJBqFEHnUaS20Lzf5gmywKeeSgvbo0Q4bj9O7CPmxhHCYEXD4IsCBCFqtot6d9nhmYCjnIvuej00iSNq9aJG"
                      customer-email={auth.user?.email || ''}
                      client-reference-id={auth.user?.id || ''}
                      success-url={`${window.location.origin}/payments?success=true&session_id={CHECKOUT_SESSION_ID}`}
                      cancel-url={`${window.location.origin}/payments?canceled=true`}
                    >
                    </stripe-pricing-table>
                  ) : (
                    <stripe-pricing-table 
                      pricing-table-id="prctbl_1R9XizL9NNHa18lJSQTtlSwK"
                      publishable-key="pk_live_51NyyfsL9NNHa18lJBqFEHnUaS20Lzf5gmywKeeSgvbo0Q4bj9O7CPmxhHCYEXD4IsCBCFqtot6d9nhmYCjnIvuej00iSNq9aJG"
                      customer-email={auth.user?.email || ''}
                      client-reference-id={auth.user?.id || ''}
                      success-url={`${window.location.origin}/payments?success=true&session_id={CHECKOUT_SESSION_ID}`}
                      cancel-url={`${window.location.origin}/payments?canceled=true`}
                    >
                    </stripe-pricing-table>
                  )
                  
                  
                  }
                </div>
              )}
            </div>
            <div className="fixed-button-container mt-4 flex justify-end border-t border-slate-700 pt-2">
              <Button
                color="light"
                onClick={() => setShowStripeModal(false)}
                className="bg-slate-700 px-5 py-2.5 text-white hover:bg-slate-600"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </motion.div>
  );
};

export default PaymentComponent;
