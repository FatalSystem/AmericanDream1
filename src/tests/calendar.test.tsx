/**
 * Calendar Component Tests
 *
 * Bu dosya, takvim bileşeni ve ilgili özellikleri için frontend testlerini içerir.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import Calendar from "../pages/calendar/Calendar";
import { AuthProvider } from "../providers/AuthProvider";
import { TimezoneProvider } from "../contexts/TimezoneContext";

describe("Calendar Component", () => {
  const renderCalendar = () => {
    return render(
      <AuthProvider>
        <TimezoneProvider>
          <Calendar />
        </TimezoneProvider>
      </AuthProvider>,
    );
  };

  it("renders calendar component", () => {
    renderCalendar();
    expect(screen.getByText(/Create Event/i)).toBeInTheDocument();
  });
});
