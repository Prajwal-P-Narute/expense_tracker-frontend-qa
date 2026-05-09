import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./AppQuickActions.css";

const DASHBOARD_PATHS = new Set(["/", "/expense-tracker"]);

export default function AppQuickActions({
  visible,
  showThemeToggle,
  isDarkMode,
  onToggleDarkMode,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 640 : false,
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncViewport = () => {
      setIsCompactViewport(window.innerWidth <= 640);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, isCompactViewport]);

  if (!visible) {
    return null;
  }

  const onDashboard = DASHBOARD_PATHS.has(location.pathname);
  const openDashboard = () => {
    navigate("/expense-tracker");
    setIsMenuOpen(false);
  };

  const toggleMode = () => {
    onToggleDarkMode();
    setIsMenuOpen(false);
  };

  const actionButtons = (
    <>
      <button
        type="button"
        className={`app-quick-action ${onDashboard ? "active" : ""}`}
        onClick={openDashboard}
        disabled={onDashboard}
        aria-current={onDashboard ? "page" : undefined}
      >
        <i className="bi bi-speedometer2" aria-hidden="true" />
        <span className="app-quick-action-label">Dashboard</span>
      </button>

      {showThemeToggle ? (
        <button
          type="button"
          className="app-quick-action"
          onClick={toggleMode}
          aria-pressed={isDarkMode}
        >
          <i
            className={`bi ${
              isDarkMode ? "bi-brightness-high-fill" : "bi-moon-stars-fill"
            }`}
            aria-hidden="true"
          />
          <span className="app-quick-action-label">
            {isDarkMode ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
      ) : null}
    </>
  );

  if (isCompactViewport) {
    return (
      <div
        className={`app-quick-actions mobile ${isMenuOpen ? "open" : ""}`}
        aria-label="Quick actions"
      >
        {isMenuOpen ? (
          <div className="app-quick-actions-panel">
            {actionButtons}
          </div>
        ) : null}

        <button
          type="button"
          className="app-quick-actions-toggle"
          aria-label={isMenuOpen ? "Close quick actions" : "Open quick actions"}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
        >
          <i
            className={`bi ${isMenuOpen ? "bi-x-lg" : "bi-grid-3x3-gap-fill"}`}
            aria-hidden="true"
          />
        </button>
      </div>
    );
  }

  return (
    <div className="app-quick-actions" aria-label="Quick actions">
      {actionButtons}
    </div>
  );
}
