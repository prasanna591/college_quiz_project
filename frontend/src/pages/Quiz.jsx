import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Quiz.css";

const Quiz = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [quizId, setQuizId] = useState(null);
  const [startTime] = useState(Date.now());
  const navigate = useNavigate();

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

  // Create authenticated axios instance with token set during initialization
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("student_token");

    // Check if token exists and redirect to login if missing
    if (!token) {
      navigate("/");
      return null;
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [navigate]);

  // Fetch quiz data
  const fetchQuizData = useCallback(async () => {
    try {
      setLoading(true);

      // Get fresh auth headers for each request
      const headers = getAuthHeaders();
      if (!headers) return;

      // Fetch the active quiz first
      const activeQuizRes = await axios.get(
        `${API_BASE_URL}/student/get_active_quiz`,
        {
          headers,
        }
      );

      if (!activeQuizRes.data.quiz_id) {
        setError("No active quiz available. Please try again later.");
        setLoading(false);
        return; // Ensure function exits
      }

      const quizId = activeQuizRes.data.quiz_id;
      setQuizId(quizId);

      // Get fresh auth headers again for the second request
      const questionsHeaders = getAuthHeaders();
      if (!questionsHeaders) return;

      // Then fetch the questions for that quiz
      const questionsRes = await axios.get(
        `${API_BASE_URL}/student/get_questions?quiz_id=${quizId}`,
        { headers: questionsHeaders }
      );

      if (questionsRes.data.status === "success") {
        setQuestions(questionsRes.data.questions);
      } else {
        throw new Error(
          questionsRes.data.message || "Failed to load questions."
        );
      }
    } catch (err) {
      console.error("Error fetching quiz:", err);
      // Check for unauthorized status
      if (err.response?.status === 401) {
        localStorage.removeItem("student_token");
        navigate("/");
        return;
      }
      setError(
        err.response?.data?.message || "Failed to load quiz. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [navigate, API_BASE_URL, getAuthHeaders]);

  useEffect(() => {
    fetchQuizData();
  }, [fetchQuizData]);

  // Handler for selecting an answer
  const handleAnswerSelect = (questionId, option) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  // Navigation handlers with improved safety
  const nextQuestion = () => {
    setCurrentQuestion((prev) => Math.min(prev + 1, questions.length - 1));
  };

  const prevQuestion = () => {
    setCurrentQuestion((prev) => Math.max(prev - 1, 0));
  };

  // Check if all questions have been answered
  const allQuestionsAnswered = () => {
    return questions.every((question) => answers[question.id] !== undefined);
  };

  const handleSubmit = async () => {
    if (!allQuestionsAnswered()) {
      setError("Please answer all questions before submitting.");
      return;
    }

    // Convert answers object to use string keys to match server expectations
    const formattedAnswers = {};
    for (const [questionId, answer] of Object.entries(answers)) {
      formattedAnswers[String(questionId)] = answer; // Ensure keys are strings
    }

    setLoading(true);
    try {
      if (!quizId) {
        throw new Error("Quiz ID not found. Please reload the quiz.");
      }

      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      const headers = getAuthHeaders();
      if (!headers) return;

      // Log the payload being sent
      console.log("Submitting payload:", {
        answers: formattedAnswers,
        quiz_id: quizId,
        time_taken: timeTaken,
      });

      const res = await axios.post(
        `${API_BASE_URL}/student/submit_quiz`,
        {
          answers: formattedAnswers,
          quiz_id: quizId,
          time_taken: timeTaken,
        },
        { headers }
      );

      if (res.data.status === "success") {
        setSubmitted(true);
        setScore(res.data.score);
        setError("");
      } else {
        throw new Error(res.data.message || "Failed to submit quiz.");
      }
    } catch (err) {
      console.error("Error submitting quiz:", err);
      if (err.response?.status === 401) {
        localStorage.removeItem("student_token");
        navigate("/");
        return;
      }
      setError(err.response?.data?.message || "Submission failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("student_token");
    navigate("/");
  };

  // Render loading state
  if (loading) return <div className="quiz-loading">Loading quiz...</div>;

  // Render error state
  if (error && !questions.length) {
    return (
      <div className="quiz-error">
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={handleLogout}>Back to Login</button>
      </div>
    );
  }

  // Render submitted state
  if (submitted) {
    return (
      <div className="quiz-completed">
        <h2>Quiz Completed!</h2>
        <div className="quiz-score">
          <p>Your score:</p>
          <div className="score-value">
            {score} / {questions.length}
          </div>
          <div className="score-percentage">
            {Math.round((score / questions.length) * 100)}%
          </div>
        </div>
        <button onClick={handleLogout} className="logout-btn">
          Exit Quiz
        </button>
      </div>
    );
  }

  // Render no questions state
  if (!questions.length) {
    return (
      <div className="quiz-error">
        <h3>No Questions Available</h3>
        <p>There are no questions available for this quiz.</p>
        <button onClick={handleLogout}>Back to Login</button>
      </div>
    );
  }

  // Main quiz rendering
  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <h2>Student Quiz</h2>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>

      <div className="quiz-progress">
        <div className="progress-text">
          Question {currentQuestion + 1} of {questions.length}
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{
              width: `${Math.min(
                ((currentQuestion + 1) / questions.length) * 100,
                100
              )}%`, // Cap at 100%
            }}
          ></div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="quiz-content">
        <div className="question">
          <h3>{questions[currentQuestion].question_text}</h3>
          <div className="options">
            {questions[currentQuestion].options.map((option, index) => (
              <div
                key={index}
                className={`option ${
                  answers[questions[currentQuestion].id] === index
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  handleAnswerSelect(questions[currentQuestion].id, index)
                }
              >
                <span className="option-letter">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="option-text">{option}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="quiz-navigation">
          <button
            onClick={prevQuestion}
            disabled={currentQuestion === 0}
            className="nav-btn"
          >
            Previous
          </button>
          {currentQuestion < questions.length - 1 ? (
            <button onClick={nextQuestion} className="nav-btn primary">
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!allQuestionsAnswered()}
              className={`submit-btn ${
                !allQuestionsAnswered() ? "disabled" : ""
              }`}
            >
              Submit Quiz
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Quiz;
