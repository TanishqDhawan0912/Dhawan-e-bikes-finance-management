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
    // Proactively clear any pending timers to avoid lingering callbacks
    if (window.sessionTimeout) {
      clearTimeout(window.sessionTimeout);
      window.sessionTimeout = null;
    }
    if (window.warningTimeout) {
      clearTimeout(window.warningTimeout);
      window.warningTimeout = null;
    }
    alert("Your session has expired due to inactivity. Please log in again.");
    // Navigate instead of full reload to avoid browser hang/popups
    navigate("/admin-login", { replace: true });
  }, [navigate]);

  const showAdminLeavePrompt = useCallback((onStayLoggedIn, onLogout) => {
    const backdrop = document.createElement("div");
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 11000;
    `;

    const dialog = document.createElement("div");
    dialog.style.cssText = `
      background: #ffffff;
      border-radius: 12px;
      padding: 1.75rem 2rem;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.25),
        0 10px 10px -5px rgba(15, 23, 42, 0.2);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
    `;

    dialog.innerHTML = `
      <div style="margin-bottom: 1.25rem;">
        <h2 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 600; color: #111827;">
          Leaving admin section
        </h2>
        <p style="margin: 0; font-size: 0.9rem; line-height: 1.5; color: #4b5563;">
          You are trying to move out of the admin section. Choose whether you want to
          stay logged in as admin or logout and continue.
        </p>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem;">
        <button id="adminStayLoggedIn" style="
          padding: 0.55rem 1.1rem;
          border-radius: 9999px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #111827;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
        ">
          Stay logged in
        </button>
        <button id="adminLogout" style="
          padding: 0.55rem 1.2rem;
          border-radius: 9999px;
          border: none;
          background: #dc2626;
          color: #ffffff;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 10px 15px -3px rgba(220, 38, 38, 0.35);
        ">
          Logout as admin
        </button>
      </div>
    `;

    const cleanup = () => {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
    };

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        cleanup();
        if (typeof onStayLoggedIn === "function") {
          onStayLoggedIn();
        }
      }
    });

    const stayButton = dialog.querySelector("#adminStayLoggedIn");
    const logoutButton = dialog.querySelector("#adminLogout");

    stayButton.addEventListener("click", () => {
      cleanup();
      if (typeof onStayLoggedIn === "function") {
        onStayLoggedIn();
      }
    });

    logoutButton.addEventListener("click", () => {
      cleanup();
      if (typeof onLogout === "function") {
        onLogout();
      }
    });

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
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

  return { resetSessionTimeout, showAdminLeavePrompt };
};
