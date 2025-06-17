import { RouterProvider } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { TimezoneProvider } from "./contexts/TimezoneContext";
import routes from "./route";
import { ClassModalProvider } from "./contexts/ClassModalContext";

function App() {
  return (
    <main className="flex min-h-screen items-center justify-center gap-2 dark:bg-gray-800">
      <TimezoneProvider>
        <ClassModalProvider>
          <RouterProvider router={routes} />
          <ToastContainer />
        </ClassModalProvider>
      </TimezoneProvider>
    </main>
  );
}

export default App;
