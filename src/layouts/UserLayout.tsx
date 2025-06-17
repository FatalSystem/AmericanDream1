import { useState, ReactNode, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  FaUsers,
  FaDashcube,
  FaMoneyBill,
  FaChalkboardTeacher,
  FaChild,
  FaStudiovinari,
  FaAdjust,
  FaCalendar,
  FaPaypal,
  FaFileWord,
  FaInfo,
  FaBars,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { HiLogout } from "react-icons/hi";
import api from "../config";
import { toast } from "react-toastify";
import { useAuth } from "../hooks/useAuth";
import { Avatar, Badge, Dropdown, MenuProps } from "antd";
import { BellOutlined, UserOutlined, SettingOutlined } from "@ant-design/icons";
import TimezoneDisplay from "../components/TimezoneDisplay";

// Define the types for the SidebarItem props
interface SidebarItemProps {
  label: string;
  icon: ReactNode;
  dropdownId?: string;
  onClick?: () => void;
  isDropdownOpen?: boolean;
  items?: string[];
  route?: string[];
  currentPath?: string;
  isCollapsed?: boolean;
}

// Add this icon mapping object
const iconComponents: { [key: string]: ReactNode } = {
  FaUsers: <FaUsers />,
  FaDashcube: <FaDashcube />,
  FaMoneyBill: <FaMoneyBill />,
  FaChalkboardTeacher: <FaChalkboardTeacher />,
  HiLogout: <HiLogout />,
  FaChild: <FaChild />,
  FaStudiovinari: <FaStudiovinari />,
  FaAdjust: <FaAdjust />,
  FaCalendar: <FaCalendar />,
  FaPaypal: <FaPaypal />,
  FaFileWord: <FaFileWord />,
  FaInfo: <FaInfo />,
};

export default function UserLayout() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Add state for sidebar collapse
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState ? JSON.parse(savedState) : false;
  });
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications] = useState<number>(1); // Example notification count

  // Save collapsed state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById("default-sidebar");
      const toggleButton = document.getElementById("sidebar-toggle");
      if (
        sidebar &&
        toggleButton &&
        !sidebar.contains(event.target as Node) &&
        !toggleButton.contains(event.target as Node)
      ) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    setCurrentPath(location.pathname);
  }, [location]);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const res = await api.get("/getMenus");
      auth.setAuth({ type: "MENU", payload: { menu: res.data?.data || [] } });
    } catch (error: any) {
      console.error("API Error:", error);
      // Ігноруємо помилки API
      auth.setAuth({ type: "MENU", payload: { menu: [] } });
    }
  };

  const handleApiError = (error: any) => {
    console.error("API Error:", error);
    // Прибираємо перенаправлення на логін
    toast.error("An error occurred. Please try again.", { theme: "dark" });
  };

  const userMenuItems: MenuProps["items"] = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Profile",
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Settings",
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <HiLogout />,
      label: "Logout",
      danger: true,
      onClick: () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/");
      },
    },
  ];

  // Toggle sidebar collapsed state
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Enhanced Navbar */}
      <nav className="fixed top-0 z-50 w-screen border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/95">
        <div className="px-6 py-4 lg:px-5 lg:pl-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                id="sidebar-toggle"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="inline-flex items-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600 sm:hidden"
              >
                <FaBars className="size-5" />
              </button>
              <a href="" className="flex items-center gap-3">
                <img
                  src="https://flowbite.com/docs/images/logo.svg"
                  className="size-8 transition-transform hover:scale-110"
                  alt="American Dream"
                />
                <span className="self-center whitespace-nowrap text-xl font-semibold text-gray-800 dark:text-white">
                  American Dream
                </span>
              </a>
            </div>

            {/* Add user menu and notifications */}
            <div className="flex items-center gap-4">
              {/* Timezone Display */}
              <div className="hidden md:block">
                <TimezoneDisplay />
              </div>

              <Badge
                count={notifications}
                className="cursor-pointer"
                color="gray"
                size="small"
              >
                <BellOutlined className="text-xl text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200" />
              </Badge>
              <Dropdown
                menu={{ items: userMenuItems }}
                trigger={["click"]}
                placement="bottomRight"
              >
                <div className="flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Avatar size="small" icon={<UserOutlined />} />
                  <span className="hidden text-sm font-medium text-gray-700 dark:text-gray-200 md:block">
                    {auth.user?.first_name + " " + auth.user?.last_name ||
                      "User"}
                  </span>
                </div>
              </Dropdown>
            </div>
          </div>
        </div>
      </nav>

      {/* Enhanced Sidebar */}
      <aside
        id="default-sidebar"
        className={`fixed left-0 top-0 z-40 h-screen border-r border-gray-200 bg-white/95 pt-16 shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-800/95 sm:translate-x-0${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "w-20" : "w-64"}`}
        aria-label="Sidenav"
      >
        <div className="flex h-full flex-col justify-between px-3 py-4">
          <div className="space-y-4">
            <div
              className={`flex justify-between px-3 ${isCollapsed ? "justify-center px-0" : ""}`}
            >
              {!isCollapsed && (
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Main Menu
                </h2>
              )}
              <button
                onClick={toggleCollapse}
                className="rounded-lg p-1.5 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
              </button>
            </div>
            <ul className="space-y-1.5">
              <SidebarItem
                label="Dashboard"
                route={["/dashboard"]}
                icon={<FaDashcube />}
                currentPath={currentPath}
                isCollapsed={isCollapsed}
              />
              <SidebarItem
                label="Students"
                route={["/users/students"]}
                icon={<FaChild />}
                currentPath={currentPath}
                isCollapsed={isCollapsed}
              />
              <SidebarItem
                label="Teachers"
                route={["/users/teachers"]}
                icon={<FaChalkboardTeacher />}
                currentPath={currentPath}
                isCollapsed={isCollapsed}
              />
              <SidebarItem
                label="Classes"
                route={["/class/manage"]}
                icon={<FaStudiovinari />}
                currentPath={currentPath}
                isCollapsed={isCollapsed}
              />
              <SidebarItem
                label="Calendar"
                route={["/calendar"]}
                icon={<FaCalendar />}
                currentPath={currentPath}
                isCollapsed={isCollapsed}
              />
              <SidebarItem
                label="Payments"
                route={["/payments"]}
                icon={<FaPaypal />}
                currentPath={currentPath}
                isCollapsed={isCollapsed}
              />
            </ul>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`min-h-screen pt-16 transition-all duration-300 ease-in-out ${
          isCollapsed ? "sm:ml-20" : "sm:ml-64"
        }`}
      >
        <div className="p-4">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const SidebarItem = ({
  label,
  icon,
  dropdownId,
  onClick = () => {},
  isDropdownOpen,
  items,
  route = [],
  currentPath = "",
  isCollapsed = false,
}: SidebarItemProps) => {
  const navigate = useNavigate();
  const isActive = route.some((path) => currentPath.startsWith(path));

  const toNavigate = (url: string) => {
    navigate(url);
  };

  return (
    <li>
      <button
        onClick={() => toNavigate(route[0])}
        className={`flex w-full items-center rounded-lg p-2 text-base font-normal text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700 ${
          isActive ? "bg-gray-100 dark:bg-gray-700" : ""
        }`}
      >
        <span className="flex size-6 items-center justify-center text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white">
          {icon}
        </span>
        {!isCollapsed && (
          <span className="ml-3 flex-1 whitespace-nowrap">{label}</span>
        )}
      </button>
    </li>
  );
};
