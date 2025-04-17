import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./AuthPage.css"; // Ensure this CSS file contains the updated styles

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Login form state
  const [loginData, setLoginData] = useState({
    register_number: "",
  });

  // Register form state
  const [registerData, setRegisterData] = useState({
    name: "",
    register_number: "",
    class_name: "1st year",
    section: "A",
    department: "CSE",
  });

  // Dropdown options
  const classOptions = ["1st year", "2nd year", "3rd year", "4th year"];
  const sectionOptions = ["A", "B", "C", "D"];
  const departmentOptions = [
    "CSE",
    "ECE",
    "EEE",
    "AI&DS",
    "CSBS",
    "IT",
    "MEC",
    "CIVIL",
  ];

  // Handle login form changes
  const handleLoginChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  // Handle register form changes
  const handleRegisterChange = (e) => {
    setRegisterData({ ...registerData, [e.target.name]: e.target.value });
  };

  // Toggle between login and register forms
  const toggleForm = () => {
    setIsLogin(!isLogin);
    setMessage("");
    setError("");
  };

  // Handle login submission
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await axios.post(
        "http://127.0.0.1:5000/student/login",
        loginData,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      if (res.data.status === "success") {
        setMessage(res.data.message);
        // Store token
        localStorage.setItem("student_token", res.data.token);
        // Redirect after a brief delay to show success message
        setTimeout(() => navigate("/student/quiz"), 1000);
      } else {
        setError(res.data.message || "Login failed.");
      }
    } catch (error) {
      console.error(
        "Error:",
        error.response ? error.response.data : error.message
      );
      setError(
        error.response?.data?.message || "Server error! Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle registration submission
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await axios.post(
        "http://127.0.0.1:5000/student/register",
        registerData,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      if (res.data.status === "success") {
        setMessage(res.data.message);
        // Store student ID if provided
        if (res.data.student_id) {
          localStorage.setItem("student_id", res.data.student_id);
        }
        // Switch to login form after successful registration
        setTimeout(() => {
          setIsLogin(true);
          setMessage("Registration successful! Please login.");
        }, 1500);
      } else {
        setError(res.data.message || "Registration failed.");
      }
    } catch (error) {
      console.error(
        "Error:",
        error.response ? error.response.data : error.message
      );
      setError(
        error.response?.data?.message || "Server error! Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{isLogin ? "Student Login" : "Student Registration"}</h2>
          <div className="auth-tabs">
            <button
              className={isLogin ? "active" : ""}
              onClick={() => setIsLogin(true)}
            >
              Login
            </button>
            <button
              className={!isLogin ? "active" : ""}
              onClick={() => setIsLogin(false)}
            >
              Register
            </button>
          </div>
        </div>

        <div className="auth-content">
          {isLogin ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="login-register-number">Register Number</label>
                <input
                  id="login-register-number"
                  type="text"
                  name="register_number"
                  value={loginData.register_number}
                  onChange={handleLoginChange}
                  required
                  placeholder="Enter your register number"
                  className="form-input"
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>

              <p className="toggle-text">
                Don't have an account?
                <span onClick={toggleForm}> Register now</span>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="reg-name">Full Name</label>
                <input
                  id="reg-name"
                  type="text"
                  name="name"
                  value={registerData.name}
                  onChange={handleRegisterChange}
                  required
                  placeholder="Enter your full name"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-register-number">Register Number</label>
                <input
                  id="reg-register-number"
                  type="text"
                  name="register_number"
                  value={registerData.register_number}
                  onChange={handleRegisterChange}
                  required
                  placeholder="Enter your register number"
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="reg-class">Class</label>
                  <select
                    id="reg-class"
                    name="class_name"
                    value={registerData.class_name}
                    onChange={handleRegisterChange}
                    required
                    className="form-input"
                  >
                    {classOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-section">Section</label>
                  <select
                    id="reg-section"
                    name="section"
                    value={registerData.section}
                    onChange={handleRegisterChange}
                    required
                    className="form-input"
                  >
                    {sectionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg-department">Department</label>
                <select
                  id="reg-department"
                  name="department"
                  value={registerData.department}
                  onChange={handleRegisterChange}
                  required
                  className="form-input"
                >
                  {departmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Registering..." : "Register"}
              </button>

              <p className="toggle-text">
                Already have an account?
                <span onClick={toggleForm}> Login now</span>
              </p>
            </form>
          )}

          {message && <div className="message success">{message}</div>}
          {error && <div className="message error">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
