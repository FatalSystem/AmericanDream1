import { RouterProvider } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import { AuthProvider } from "./providers/AuthProvider";
import { TimezoneProvider } from "./contexts/TimezoneContext";
import { CalendarProvider } from "./store/CalendarContext";
import { SyncProvider } from "./contexts/SyncContext";
import routes from "./route";
import { ClassModalProvider } from "./contexts/ClassModalContext";

function App() {
  return (
    <main className="flex min-h-screen items-center justify-center gap-2 dark:bg-gray-800">
      <AuthProvider>
        <TimezoneProvider>
          <SyncProvider>
            <CalendarProvider>
              <ClassModalProvider>
                <RouterProvider router={routes} />
                <ToastContainer />
              </ClassModalProvider>
            </CalendarProvider>
          </SyncProvider>
        </TimezoneProvider>
      </AuthProvider>
    </main>
  );
}

export default App;
