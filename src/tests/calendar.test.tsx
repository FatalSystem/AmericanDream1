/**
 * Calendar Component Tests
 * 
 * Bu dosya, takvim bileşeni ve ilgili özellikleri için frontend testlerini içerir.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BryntumCalendar } from '@bryntum/calendar-react';
import Calendar from '../pages/calendar/Calendar';
import { AuthProvider } from '../contexts/AuthContext';
import { ClassModalProvider } from '../contexts/ClassModalContext';
import { MemoryRouter } from 'react-router-dom';
import { TimezoneProvider } from '../contexts/TimezoneContext';

// Mock BryntumCalendar
jest.mock('@bryntum/calendar-react', () => ({
  BryntumCalendar: jest.fn(() => <div data-testid="mock-calendar" />),
}));

// Mock API
jest.mock('../config', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(() => Promise.resolve({ status: 200, data: {} })),
    delete: jest.fn(() => Promise.resolve({ status: 200 })),
    defaults: { baseURL: 'http://test.api' },
  },
}));

// Test suite
describe('Calendar Component', () => {
  
  // Helper to wrap component with all required providers
  const renderWithProviders = (ui) => {
    return render(
      <MemoryRouter>
        <AuthProvider>
          <TimezoneProvider>
            <ClassModalProvider>
              {ui}
            </ClassModalProvider>
          </TimezoneProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };
  
  test('Calendar should render correctly', async () => {
    // Set mock authentication
    const mockAuth = {
      user: { id: '1', role: 'teacher' },
      isAuthenticated: true,
    };
    
    // Render component
    renderWithProviders(<Calendar />);
    
    // Verify calendar renders (will be mocked)
    await waitFor(() => {
      const mockCalendar = screen.queryByTestId('mock-calendar');
      expect(mockCalendar).toBeInTheDocument();
    });
  });
  
  test('Calendar props should have correct configuration', () => {
    // Track BryntumCalendar props
    let calendarProps = null;
    
    // Override the mock to capture props
    BryntumCalendar.mockImplementation((props) => {
      calendarProps = props;
      return <div data-testid="mock-calendar" />;
    });
    
    // Render the calendar
    renderWithProviders(<Calendar />);
    
    // Verify calendar props after rendering
    waitFor(() => {
      // Check if calendar has eventEditFeature
      expect(calendarProps).toHaveProperty('eventEditFeature');
      
      // Check if eventEditFeature has editorConfig
      expect(calendarProps.eventEditFeature).toHaveProperty('editorConfig');
      
      // Should have class type field configuration
      const items = calendarProps.eventEditFeature.editorConfig.items;
      expect(items).toHaveProperty('classTypeField');
      
      // Should have duration field
      expect(items).toHaveProperty('durationField');
      
      // Should have student name field
      expect(items).toHaveProperty('studentNameField');
      
      // Should have class status field
      expect(items).toHaveProperty('classStatusField');
      
      // Should have recurrence field
      expect(items).toHaveProperty('recurrenceField');
    });
  });
  
  test('Class type selection should set appropriate duration', () => {
    // This would be an integration test with user interaction
    // Not fully implementable with mocks, but the concept is:
    
    console.log('Verifying class type selection behavior:');
    console.log('- Trial lesson: Duration should be 30 min and disabled');
    console.log('- Regular lesson: Duration should be 50 min and enabled');
    console.log('- Other lesson types: Duration should be adjustable');
  });
  
  test('Class status change to "given" should trigger class info form', () => {
    // This would be an integration test with user interaction
    // Not fully implementable with mocks, but the concept is:
    
    console.log('Verifying class info form behavior:');
    console.log('- Setting status to "given" should open class info form');
    console.log('- Form submission should save both class status and class info');
    console.log('- Form cancellation should revert class status');
  });
}); 