import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const useSessionTimeout = () => {
  const navigate = useNavigate();

  // Session timeout settings (5 minutes)
  const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
  const WARNING_TIMEOUT = 2 * 60 * 1000; // 2 minutes warning before timeout

  // Handle automatic logout
  const handleAutoLogout = useCallback(() => {
    sessionStorage.removeItem("adminAuth");
    alert("Your session has expired due to inactivity. Please log in again.");
    window.location.reload(); // Refresh page to ensure clean state
  }, []);

  // Reset session timeout on user activity
  const resetSessionTimeout = useCallback(() => {
    // Clear existing timeouts
    if (window.sessionTimeout) {
      clearTimeout(window.sessionTimeout);
    }
    if (window.warningTimeout) {
      clearTimeout(window.warningTimeout);
    }

    // Set warning timeout (28 minutes before session timeout)
    window.warningTimeout = setTimeout(() => {
      // Inline warning creation to avoid circular dependency
      const warningDialog = document.createElement("div");
      warningDialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        text-align: center;
        min-width: 300px;
      `;

      warningDialog.innerHTML = `
        <h3 style="margin: 0 0 1rem 0; color: #dc3545;">Session Timeout Warning</h3>
        <p style="margin: 0 0 1.5rem 0; color: #666;">
          Your session will expire in 2 minutes due to inactivity. 
          <br>Click "Continue Session" to stay logged in.
        </p>
        <button id="continueSession" style="
          background: #007bff;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 0.5rem;
        ">Continue Session</button>
        <button id="logoutNow" style="
          background: #dc3545;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 4px;
          cursor: pointer;
        ">Logout Now</button>
      `;

      // Add backdrop
      const backdrop = document.createElement("div");
      backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
      `;

      document.body.appendChild(backdrop);
      document.body.appendChild(warningDialog);

      // Auto-logout after 2 minutes if no interaction
      const autoLogoutTimer = setTimeout(() => {
        // Clean up modal
        if (document.body.contains(warningDialog)) {
          document.body.removeChild(warningDialog);
        }
        if (document.body.contains(backdrop)) {
          document.body.removeChild(backdrop);
        }
        // Auto logout and refresh
        handleAutoLogout();
      }, WARNING_TIMEOUT);

      // Handle continue session button
      const continueBtn = warningDialog.querySelector("#continueSession");
      const logoutBtn = warningDialog.querySelector("#logoutNow");

      continueBtn.addEventListener("click", () => {
        clearTimeout(autoLogoutTimer);
        if (document.body.contains(warningDialog)) {
          document.body.removeChild(warningDialog);
        }
        if (document.body.contains(backdrop)) {
          document.body.removeChild(backdrop);
        }
        // Reset session timeout
        resetSessionTimeout();
      });

      logoutBtn.addEventListener("click", () => {
        clearTimeout(autoLogoutTimer);
        if (document.body.contains(warningDialog)) {
          document.body.removeChild(warningDialog);
        }
        if (document.body.contains(backdrop)) {
          document.body.removeChild(backdrop);
        }
        // Manual logout
        sessionStorage.removeItem("adminAuth");
        navigate("/admin-login", { replace: true });
      });
    }, SESSION_TIMEOUT - WARNING_TIMEOUT);

    // Set session timeout
    window.sessionTimeout = setTimeout(() => {
      handleAutoLogout();
    }, SESSION_TIMEOUT);
  }, [SESSION_TIMEOUT, WARNING_TIMEOUT, handleAutoLogout, navigate]);

  // Setup session timeout and activity listeners
  useEffect(() => {
    // Check if user is authenticated as admin
    const isAdminAuth = sessionStorage.getItem("adminAuth");
    if (!isAdminAuth) {
      return; // Don't setup timeout if not admin 
    }

    // Initial session timeout setup
    resetSessionTimeout();

    // Activity listeners to reset timeout
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    const handleActivity = () => {
      resetSessionTimeout();
    };

    // Add event listeners
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    // Cleanup on unmount
    return () => {
      if (window.sessionTimeout) {
        clearTimeout(window.sessionTimeout);
      }
      if (window.warningTimeout) {
        clearTimeout(window.warningTimeout);
      }
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [resetSessionTimeout]);

  return { resetSessionTimeout };
};
