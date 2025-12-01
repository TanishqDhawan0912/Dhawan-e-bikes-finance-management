import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function AdminLogin() {
  const [securityKey, setSecurityKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log("Attempting admin authentication...");
      const response = await fetch("http://localhost:5000/api/admin/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ securityKey }),
      });

      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);

      if (data.success) {
        // Store admin authentication in sessionStorage
        sessionStorage.setItem("adminAuth", "true");

        // Check for redirect parameter
        const redirectUrl = searchParams.get("redirect");
        if (redirectUrl) {
          navigate(redirectUrl, { replace: true });
        } else {
          navigate("/admin", { replace: true });
        }
      } else {
        setError("Invalid security key");
      }
    } catch (err) {
      console.error("Authentication error:", err);
      setError("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Admin Login</h1>
            <p>Enter the security key to access admin panel</p>
          </div>
          <div className="header-right">
            <button
              className="btn btn-back-home"
              onClick={() => navigate("/")}
              title="Back to Home"
            >
              🏠 Home
            </button>
          </div>
        </div>
      </header>

      <div
        className="admin-login-container"
        style={{
          maxWidth: "400px",
          margin: "2rem auto",
          padding: "2rem",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="securityKey"
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "bold",
              }}
            >
              Security Key:
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                id="securityKey"
                value={securityKey}
                onChange={(e) => setSecurityKey(e.target.value)}
                required
                placeholder="Enter admin security key"
                className="form-control"
                style={{
                  width: "100%",
                  padding: "0.75rem 3rem 0.75rem 0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "1rem",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                  color: "#666",
                  padding: "5px",
                  borderRadius: "3px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "30px",
                  height: "30px",
                }}
                title={showPassword ? "Hide password" : "Show password"}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#f0f0f0";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "none";
                }}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="error-message"
              style={{
                color: "#dc3545",
                marginBottom: "1rem",
                padding: "0.5rem",
                backgroundColor: "#f8d7da",
                border: "1px solid #f5c6cb",
                borderRadius: "4px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor: loading ? "#6c757d" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Authenticating..." : "Access Admin Panel"}
          </button>
        </form>
      </div>
    </div>
  );
}
