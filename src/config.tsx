import axios from "axios";

// Create an Axios instance
const api = axios.create({
  baseURL: 'https://test-account.amdream.us/api',
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  },
  withCredentials: true,
  timeout: 20000,
});

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    // Додаємо реальний токен з localStorage, якщо він є
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }
    console.log(
      "Making request to:",
      config.url,
      "with method:",
      config.method,
      "with data:",
      config.data
    );
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    console.log(
      "Received response from:",
      response.config.url,
      "with status:",
      response.status,
      "with data:",
      response.data
    );
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    console.error("API Error:", {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      headers: error.config?.headers,
    });

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401) {
      console.error("Authorization error:", error.config.url);
      return Promise.reject(new Error("Please log in to continue"));
    }

    // Handle 404 errors
    if (error.response && error.response.status === 404) {
      console.error("API endpoint not found:", error.config.url);
      return Promise.reject(new Error("Service not available"));
    }

    // Don't retry if we already tried to retry
    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    if (
      error.code === "ECONNABORTED" ||
      (error.response &&
        (error.response.status === 408 || error.response.status === 503))
    ) {
      // Handle timeout or temporary server errors with a retry
      originalRequest._retry = true;

      // Adding a 1s delay before retry
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Retry the request
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;
