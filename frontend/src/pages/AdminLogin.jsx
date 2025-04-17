import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault(); // Prevents default form submission
    try {
      const res = await axios.post("http://127.0.0.1:5000/admin/login", {
        email,
        password,
      });
      if (res.data.status === "success") {
        localStorage.setItem("adminToken", res.data.data.token);
        localStorage.setItem("role", "admin");
        navigate("/admin/dashboard");
      } else {
        setMessage(res.data.message);
      }
    } catch (error) {
      setMessage("Login failed. Please try again.");
    }
  };

  return (
    <div style={styles.container}>
      <h2>Admin Login</h2>
      <form onSubmit={handleLogin} style={styles.form}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />
        <button type="submit" style={styles.button}>
          Login
        </button>
      </form>
      {message && <p style={styles.error}>{message}</p>}
    </div>
  );
};

// Inline styles
const styles = {
  container: { textAlign: "center", marginTop: "50px" },
  form: { display: "flex", flexDirection: "column", alignItems: "center" },
  input: { margin: "10px", padding: "8px", width: "250px" },
  button: {
    padding: "10px 15px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    cursor: "pointer",
  },
  error: { color: "red", marginTop: "10px" },
};

export default AdminLogin;
