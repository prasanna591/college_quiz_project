import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./QuizResults.css";

const QuizResults = ({ results, quizTitle }) => {
  const [filteredResults, setFilteredResults] = useState([]);
  const [filterDepartment, setFilterDepartment] = useState("All");
  const [filterClass, setFilterClass] = useState("All");
  const [sortOrder, setSortOrder] = useState("score");

  // Extract unique departments and classes for filters
  const departments = ["All", ...new Set(results.map((r) => r.department))];
  const classes = ["All", ...new Set(results.map((r) => r.class_name))];

  useEffect(() => {
    // Apply filters and sorting
    let filtered = [...results];

    if (filterDepartment !== "All") {
      filtered = filtered.filter((r) => r.department === filterDepartment);
    }

    if (filterClass !== "All") {
      filtered = filtered.filter((r) => r.class_name === filterClass);
    }

    // Always sort by score in descending order for ranking
    filtered.sort((a, b) => b.score - a.score);

    // Add rank property
    filtered = filtered.map((result, index) => ({
      ...result,
      rank: index + 1,
    }));

    setFilteredResults(filtered);
  }, [results, filterDepartment, filterClass, sortOrder]);

  // Calculate statistics
  const stats = {
    average: filteredResults.length
      ? (
          filteredResults.reduce((sum, r) => sum + r.score, 0) /
          filteredResults.length
        ).toFixed(1)
      : 0,
    highest: filteredResults.length ? filteredResults[0].score : 0,
    lowest: filteredResults.length
      ? filteredResults[filteredResults.length - 1].score
      : 0,
    participants: filteredResults.length,
  };

  // Prepare data for chart - limit to top 10 for better visualization
  const chartData = filteredResults.slice(0, 10).map((result) => ({
    name:
      result.name.length > 10
        ? `${result.name.substring(0, 10)}...`
        : result.name,
    score: result.score,
    fullName: result.name,
  }));

  return (
    <div className="quiz-results-container">
      <h2>{quizTitle || "Quiz Results"}</h2>

      <div className="results-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.participants}</span>
          <span className="stat-label">Participants</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.average}</span>
          <span className="stat-label">Average Score</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.highest}</span>
          <span className="stat-label">Highest Score</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.lowest}</span>
          <span className="stat-label">Lowest Score</span>
        </div>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label>Department:</label>
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Class:</label>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            {classes.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="chart-container">
          <h3>Top 10 Performers</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value, name, props) => {
                  const studentName =
                    props?.payload?.[0]?.payload?.fullName || "Unknown";
                  return [`${value}`, `Score of ${studentName}`];
                }}
              />

              <Bar dataKey="score" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="results-table">
        <h3>Ranking</h3>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Class</th>
              <th>Department</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.map((result) => (
              <tr
                key={result.name + result.class_name}
                className={result.rank <= 3 ? `rank-${result.rank}` : ""}
              >
                <td>
                  {result.rank <= 3 ? (
                    <span className={`medal rank-${result.rank}`}>
                      {result.rank === 1
                        ? "🥇"
                        : result.rank === 2
                        ? "🥈"
                        : "🥉"}
                    </span>
                  ) : (
                    result.rank
                  )}
                </td>
                <td>{result.name}</td>
                <td>{result.class_name}</td>
                <td>{result.department}</td>
                <td className="score-cell">{result.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QuizResults;
