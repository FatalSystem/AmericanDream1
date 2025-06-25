import React, { useState, useEffect } from "react";
import { useTimezone } from "../contexts/TimezoneContext";
import { ClockCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Select } from "antd";

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Common timezone options
const COMMON_TIMEZONES = [
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Istanbul",
  "Asia/Tokyo",
  "Asia/Jakarta",
  "Australia/Sydney",
  "Pacific/Auckland",
];

interface TimezoneDisplayProps {
  compact?: boolean;
}

const TimezoneDisplay: React.FC<TimezoneDisplayProps> = ({
  compact = false,
}) => {
  const { timezone, setTimezone } = useTimezone();
  const [currentTime, setCurrentTime] = useState<dayjs.Dayjs>(
    dayjs().tz(timezone),
  );

  // Update time every second instead of every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(dayjs().tz(timezone));
    }, 1000);

    return () => clearInterval(interval);
  }, [timezone]);

  // Get current time formatted in user's timezone
  const timeString = currentTime.format("HH:mm:ss");

  const handleTimezoneChange = (value: string) => {
    setTimezone(value);

    console.log("🌍 Timezone changed to:", value);

    // Send custom event to update all components
    const event = new CustomEvent("timezoneChanged", {
      detail: { timezone: value },
    });
    window.dispatchEvent(event);
  };

  if (compact) {
    // Compact version for small spaces
    return (
      <div className="flex items-center space-x-1">
        <ClockCircleOutlined />
        <span className="font-medium">{timeString}</span>
      </div>
    );
  }

  // Full version with timezone selector
  return (
    <div className="flex items-center space-x-2 text-white">
      <div className="flex items-center space-x-2">
        <ClockCircleOutlined className="text-blue-400" />
        <span className="text-base font-bold text-blue-300">{timeString}</span>
      </div>
      <Select
        size="small"
        style={{ width: 180 }}
        value={timezone}
        onChange={handleTimezoneChange}
        options={COMMON_TIMEZONES.map((tz) => ({
          value: tz,
          label: tz.replace(/_/g, " "),
        }))}
        showSearch
        placeholder="Select timezone"
        className="text-white"
      />
    </div>
  );
};

export default TimezoneDisplay;
