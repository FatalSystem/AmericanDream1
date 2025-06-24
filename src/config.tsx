import axios from "axios";

// Create an Axios instance

const api = axios.create({
    // baseURL: "http://localhost:5100/api", 
    // baseURL: "https://account.amdream.us/api", // Production API URL
    baseURL: "https://test-account.amdream.us/api",
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  },
  withCredentials: true,
  timeout: 20000,
});

// Add a request interceptor to include the token in headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token"); // Get token from local storage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`; // Attach token
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // Don't retry if we already tried to retry
    if (originalRequest._retry) {
      return Promise.reject(error);
    }
    
    if (error.code === 'ECONNABORTED' || (error.response && (error.response.status === 408 || error.response.status === 503))) {
      // Handle timeout or temporary server errors with a retry
      originalRequest._retry = true;
      
      // Adding a 1s delay before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Retry the request
      return api(originalRequest);
    }
    
    return Promise.reject(error);
  }
);

export default api;
