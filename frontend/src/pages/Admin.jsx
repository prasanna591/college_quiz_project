import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./Admin.css";
import QuizResults from "./QuizResults.jsx"; // Import the new component

const Admin = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizResults, setQuizResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const token = localStorage.getItem("adminToken");

  // Fix: Use import.meta.env instead of process.env for Vite
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

  const displayMessage = (msg, isError = false) => {
    setMessage(msg);
    const timeoutId = setTimeout(() => {
      setMessage("");
      clearTimeout(timeoutId);
    }, 5000);
  };

  const fetchActiveQuiz = useCallback(async () => {
    if (!token) {
      displayMessage("⚠️ Unauthorized! Please log in.", true);
      setTimeout(() => {
        window.location.href = "/admin/login";
      }, 2000);
      return;
    }

    setLoadingQuiz(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/active_quiz`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setActiveQuiz(response.data.data || null);
      setShowResults(false);
    } catch (error) {
      console.error("Error fetching active quiz:", error);
      setActiveQuiz(null);
      if (error.response?.status === 401) {
        // Improved error handling for authentication issues
        displayMessage("Authentication failed. Please log in again.", true);
        localStorage.removeItem("adminToken");
        setTimeout(() => {
          window.location.href = "/admin/login";
        }, 2000);
      } else if (error.response?.status === 404) {
        displayMessage("No active quiz found.");
      } else {
        displayMessage("Failed to fetch active quiz.", true);
      }
    } finally {
      setLoadingQuiz(false);
    }
  }, [token, API_BASE_URL]);

  const fetchQuizResults = useCallback(
    async (quizId) => {
      if (!token) return;

      setLoadingResults(true);
      try {
        const res = await axios.get(
          `${API_BASE_URL}/admin/quiz_results/${quizId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.data.status === "success") {
          setQuizResults(res.data.data || []);
          setShowResults(true);
        } else {
          displayMessage("Failed to fetch quiz results.", true);
        }
      } catch (err) {
        console.error("Error fetching quiz results:", err);
        if (err.response?.status === 401) {
          displayMessage("Authentication failed. Please log in again.", true);
          localStorage.removeItem("adminToken");
          setTimeout(() => {
            window.location.href = "/admin/login";
          }, 2000);
        } else {
          displayMessage(
            err.response?.data?.message || "Failed to fetch quiz results.",
            true
          );
        }
      } finally {
        setLoadingResults(false);
      }
    },
    [token, API_BASE_URL]
  );

  useEffect(() => {
    fetchActiveQuiz();
  }, [fetchActiveQuiz]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) {
      displayMessage("⚠️ No file selected.", true);
      return;
    }

    const fileExtension = selectedFile.name.split(".").pop().toLowerCase();
    if (!["xlsx", "csv"].includes(fileExtension)) {
      displayMessage(
        "❌ Invalid format. Upload only .xlsx or .csv files.",
        true
      );
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      displayMessage("⚠️ Please select a valid file.", true);
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", `Quiz-${new Date().toISOString()}`);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/upload_quiz`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      displayMessage(`✅ ${response.data.message}`);
      await fetchActiveQuiz();

      // Reset file input
      setFile(null);
      if (document.getElementById("fileInput")) {
        document.getElementById("fileInput").value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      if (error.response?.status === 401) {
        displayMessage("Authentication failed. Please log in again.", true);
        localStorage.removeItem("adminToken");
        setTimeout(() => {
          window.location.href = "/admin/login";
        }, 2000);
      } else {
        displayMessage(
          error.response?.data?.message || "❌ Upload failed.",
          true
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!activeQuiz) {
      displayMessage("⚠️ No quiz available to start.", true);
      return;
    }

    try {
      const res = await axios.post(
        `${API_BASE_URL}/admin/start_quiz/${activeQuiz.quiz_id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      displayMessage(`✅ ${res.data.message}`);
      await fetchActiveQuiz();
    } catch (error) {
      console.error("Error starting quiz:", error);
      if (error.response?.status === 401) {
        displayMessage("Authentication failed. Please log in again.", true);
        localStorage.removeItem("adminToken");
        setTimeout(() => {
          window.location.href = "/admin/login";
        }, 2000);
      } else {
        displayMessage(
          error.response?.data?.message || "❌ Failed to start quiz.",
          true
        );
      }
    }
  };

  const handleStopQuiz = async () => {
    if (!activeQuiz) {
      displayMessage("⚠️ No active quiz to stop.", true);
      return;
    }

    try {
      const res = await axios.post(
        `${API_BASE_URL}/admin/stop_quiz`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      displayMessage(`✅ ${res.data.message}`);
      await fetchActiveQuiz();

      // Fetch results after stopping quiz
      if (activeQuiz) {
        await fetchQuizResults(activeQuiz.quiz_id);
      }
    } catch (error) {
      console.error("Error stopping quiz:", error);
      if (error.response?.status === 401) {
        displayMessage("Authentication failed. Please log in again.", true);
        localStorage.removeItem("adminToken");
        setTimeout(() => {
          window.location.href = "/admin/login";
        }, 2000);
      } else {
        displayMessage(
          error.response?.data?.message || "❌ Failed to stop quiz.",
          true
        );
      }
    }
  };

  // New function to view results for current or previous quiz
  const handleViewResults = async () => {
    if (!activeQuiz) {
      displayMessage("⚠️ No quiz selected to view results.", true);
      return;
    }

    await fetchQuizResults(activeQuiz.quiz_id);
  };

  return (
    <div className="admin-container">
      <h2>Admin Panel - Manage Quiz</h2>

      {message && (
        <div
          className={`message ${
            message.includes("❌") || message.includes("⚠️")
              ? "error"
              : "success"
          }`}
        >
          {message}
        </div>
      )}

      <div className="file-upload-section">
        <input
          id="fileInput"
          type="file"
          onChange={handleFileChange}
          accept=".xlsx, .csv"
          disabled={uploading}
        />
        <button onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? "Uploading..." : "Upload Quiz"}
        </button>
      </div>

      <div className="active-quiz-section">
        <h3>📌 Active Quiz</h3>
        {loadingQuiz ? (
          <p>Loading...</p>
        ) : activeQuiz ? (
          <p>✅ Quiz "{activeQuiz.title}" is currently live!</p>
        ) : (
          <p>⚠️ No active quiz.</p>
        )}
      </div>

      <div className="quiz-controls">
        <button
          onClick={handleStartQuiz}
          disabled={uploading || (!file && !activeQuiz)}
          className="btn btn-start"
        >
          Start Quiz
        </button>
        <button
          onClick={handleStopQuiz}
          disabled={!activeQuiz}
          className="btn btn-stop"
        >
          Stop Quiz
        </button>
        <button
          onClick={handleViewResults}
          disabled={!activeQuiz}
          className="btn btn-view"
        >
          View Results
        </button>
      </div>

      {loadingResults && (
        <div className="loading-spinner">
          <p>Loading results...</p>
        </div>
      )}

      {showResults && quizResults.length > 0 && (
        <QuizResults
          results={quizResults}
          quizTitle={activeQuiz ? activeQuiz.title : "Quiz Results"}
        />
      )}

      {showResults && quizResults.length === 0 && (
        <div className="no-results">
          <p>No results available for this quiz yet.</p>
        </div>
      )}
    </div>
  );
};

export default Admin;
