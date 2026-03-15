import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { FaCalendarAlt } from "react-icons/fa";

export default function DatePicker({ value, onChange, placeholder = "dd/mm/yyyy", style = {}, className = "" }) {
  const isModern = className.includes("date-picker-modern");
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const pickerRef = useRef(null);
  const inputRef = useRef(null);

  // Convert YYYY-MM-DD to dd/mm/yyyy
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  // Convert dd/mm/yyyy to YYYY-MM-DD
  const parseDateFromDisplay = (dateString) => {
    if (!dateString) return "";
    try {
      const parts = dateString.split("/");
      if (parts.length === 3) {
        const day = parts[0];
        const month = parts[1];
        const year = parts[2];
        const date = new Date(`${year}-${month}-${day}`);
        if (isNaN(date.getTime())) return "";
        return `${year}-${month}-${day}`;
      }
      return "";
    } catch {
      return "";
    }
  };

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      const formatted = formatDateForDisplay(value);
      setDisplayValue(formatted);
      const parsed = parseDateFromDisplay(formatted);
      if (parsed) {
        setSelectedDate(new Date(parsed));
        setCurrentMonth(new Date(parsed));
      }
    } else {
      setDisplayValue("");
      setSelectedDate(null);
    }
  }, [value]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target) && 
          inputRef.current && !inputRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    const inputValue = e.target.value;
    // Allow only digits and slashes
    const cleaned = inputValue.replace(/[^\d/]/g, "");
    // Auto-format as user types
    let formatted = cleaned;
    if (cleaned.length > 2 && !cleaned.includes("/")) {
      formatted = cleaned.slice(0, 2) + "/" + cleaned.slice(2);
    }
    if (formatted.length > 5 && formatted.split("/").length === 2) {
      formatted = formatted.slice(0, 5) + "/" + formatted.slice(5, 9);
    }
    // Limit to dd/mm/yyyy format (10 characters)
    if (formatted.length <= 10) {
      setDisplayValue(formatted);
      const parsed = parseDateFromDisplay(formatted);
      if (parsed) {
        const date = new Date(parsed);
        if (!isNaN(date.getTime())) {
          setSelectedDate(date);
          setCurrentMonth(date);
          if (onChange) {
            onChange(parsed);
          }
        }
      }
    }
  };

  const handleInputClick = () => {
    setIsOpen(true);
  };

  const handleDateSelect = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    const isoDate = `${year}-${month}-${dayStr}`;
    const formatted = formatDateForDisplay(isoDate);
    setDisplayValue(formatted);
    if (onChange) {
      onChange(isoDate);
    }
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const today = new Date();
  const isToday = (day) => {
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day) => {
    if (!selectedDate || !day) return false;
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    );
  };

  const dropdownClass = `date-picker-dropdown ${isModern ? "date-picker-dropdown-modern" : ""}`;
  const accentBg = isModern ? "#6366f1" : "#3b82f6";
  const accentLight = isModern ? "#eef2ff" : "#eff6ff";

  return (
    <div className={`date-picker-root ${className}`.trim()} style={{ position: "relative", width: "100%", zIndex: isOpen ? 9999 : "auto" }}>
      <div className={isModern ? "date-picker-input-wrap-modern" : ""} style={{ position: "relative", width: "100%" }}>
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onClick={handleInputClick}
          placeholder={placeholder}
          maxLength={10}
          className={isModern ? "date-picker-input-modern" : ""}
          style={{
            width: "100%",
            padding: isModern ? "0.6rem 2.5rem 0.6rem 0.85rem" : "0.5rem",
            borderRadius: isModern ? "0.5rem" : "0.375rem",
            border: "1px solid #e5e7eb",
            fontSize: "1rem",
            cursor: "pointer",
            ...style,
          }}
        />
        {isModern && (
          <span className="date-picker-icon" aria-hidden="true">
            <FaCalendarAlt />
          </span>
        )}
      </div>
      {isOpen && createPortal(
        <div
          ref={pickerRef}
          className={dropdownClass}
          style={{
            position: "fixed",
            top: inputRef.current ? `${inputRef.current.getBoundingClientRect().bottom + 8}px` : "50%",
            left: inputRef.current ? `${inputRef.current.getBoundingClientRect().left}px` : "50%",
            transform: inputRef.current ? "none" : "translate(-50%, -50%)",
            backgroundColor: "white",
            borderRadius: isModern ? "12px" : "0.5rem",
            boxShadow: isModern ? "0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            border: "1px solid #e5e7eb",
            zIndex: 9999,
            padding: isModern ? "1.25rem" : "1rem",
            minWidth: "300px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <button
              type="button"
              className={isModern ? "date-picker-nav-btn-modern" : ""}
              onClick={handlePrevMonth}
              style={{
                padding: "0.35rem 0.5rem",
                border: "none",
                backgroundColor: "transparent",
                cursor: "pointer",
                fontSize: "1.1rem",
                color: "#6b7280",
                borderRadius: "6px",
              }}
            >
              ←
            </button>
            <h3 style={{ margin: 0, fontSize: isModern ? "1.05rem" : "1rem", fontWeight: 600, color: "#111827" }}>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <button
              type="button"
              className={isModern ? "date-picker-nav-btn-modern" : ""}
              onClick={handleNextMonth}
              style={{
                padding: "0.35rem 0.5rem",
                border: "none",
                backgroundColor: "transparent",
                cursor: "pointer",
                fontSize: "1.1rem",
                color: "#6b7280",
                borderRadius: "6px",
              }}
            >
              →
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.25rem", marginBottom: "0.5rem" }}>
            {dayNames.map((day) => (
              <div key={day} style={{ textAlign: "center", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", padding: "0.35rem" }}>
                {day}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.35rem" }}>
            {days.map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={() => day && handleDateSelect(day)}
                disabled={!day}
                className={isModern ? "date-picker-day-modern" : ""}
                style={{
                  padding: "0.5rem",
                  border: "none",
                  backgroundColor: isSelected(day) ? accentBg : isToday(day) ? accentLight : "transparent",
                  color: isSelected(day) ? "white" : isToday(day) ? (isModern ? "#6366f1" : "#3b82f6") : "#111827",
                  borderRadius: isModern ? "8px" : "0.375rem",
                  cursor: day ? "pointer" : "default",
                  fontSize: "0.875rem",
                  fontWeight: isSelected(day) || isToday(day) ? 600 : 400,
                  minHeight: "2.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (day && !isSelected(day)) e.currentTarget.style.backgroundColor = "#f3f4f6";
                }}
                onMouseLeave={(e) => {
                  if (day && !isSelected(day)) e.currentTarget.style.backgroundColor = isToday(day) ? accentLight : "transparent";
                }}
              >
                {day || ""}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

