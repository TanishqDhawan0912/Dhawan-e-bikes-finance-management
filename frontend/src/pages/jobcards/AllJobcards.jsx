import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import JobcardPrintView from "../../components/JobcardPrintView";
import DatePicker from "../../components/DatePicker";
import { getTodayForInput } from "../../utils/dateUtils";
import { getFetchErrorMessage } from "../../utils/apiError";

import { API_BASE } from "../../config/api";
export default function AllJobcards() {
  const navigate = useNavigate();
  const [jobcards, setJobcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all"); // all, service, replacement, sales
  const [searchName, setSearchName] = useState("");
  const [searchMobile, setSearchMobile] = useState("");
  const [searchPlace, setSearchPlace] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [jobcardToDelete, setJobcardToDelete] = useState(null);
  const [validatingPassword, setValidatingPassword] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedJobcard, setSelectedJobcard] = useState(null);
  const [printingJobcard, setPrintingJobcard] = useState(null);

  useEffect(() => {
    fetchFinalizedJobcards();
  }, [filterType]);

  const fetchFinalizedJobcards = async () => {
    try {
      setLoading(true);
      const filter = filterType === "all" ? "status=finalized" : `status=finalized&jobcardType=${filterType}`;
      const response = await fetch(`${API_BASE}/jobcards?${filter}`);
      if (!response.ok) {
        throw new Error("Failed to fetch finalized jobcards");
      }
      const data = await response.json();
      setJobcards(data);
    } catch (error) {
      console.error("Error fetching finalized jobcards:", error);
      alert(`Error loading jobcards: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredJobcards = useMemo(() => {
    let filtered = [...jobcards];

    if (searchName.trim()) {
      const q = searchName.toLowerCase().trim();
      filtered = filtered.filter((jc) =>
        jc.customerName?.toLowerCase().includes(q)
      );
    }

    if (searchMobile.trim()) {
      const raw = searchMobile.trim();
      const digitsOnly = raw.replace(/\D/g, "");
      filtered = filtered.filter((jc) => {
        const m = String(jc.mobile ?? "");
        if (digitsOnly.length > 0) {
          return m.replace(/\D/g, "").includes(digitsOnly);
        }
        return m.toLowerCase().includes(raw.toLowerCase());
      });
    }

    if (searchPlace.trim()) {
      const q = searchPlace.toLowerCase().trim();
      filtered = filtered.filter((jc) =>
        String(jc.place ?? "").toLowerCase().includes(q)
      );
    }

    if (filterDate) {
      filtered = filtered.filter((jc) => jc.date === filterDate);
    }

    return filtered;
  }, [jobcards, searchName, searchMobile, searchPlace, filterDate]);

  const hasActiveSearchFilters =
    Boolean(searchName.trim()) ||
    Boolean(searchMobile.trim()) ||
    Boolean(searchPlace.trim()) ||
    Boolean(filterDate);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const formatDateDDMMYYYY = (dateString) => {
    if (!dateString || dateString === "N/A") return "N/A";
    try {
      // Check if it's already in dd/mm/yyyy format
      if (typeof dateString === "string" && dateString.includes("/")) {
        const parts = dateString.split("/");
        if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2) {
          return dateString;
        }
      }
      // Try to parse as date
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // Not a valid date, treat as code
        return dateString.toUpperCase();
      }
      // Format as dd/mm/yyyy
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      // If parsing fails, treat as code and return uppercase
      return String(dateString).toUpperCase();
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "";
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      const dateStr = date.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const timeStr = date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return `${dateStr} ${timeStr}`;
    } catch {
      return dateString;
    }
  };

  const capitalizeText = (text) => {
    if (!text || text === "N/A") return text;
    return text
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const getWarrantyTagForPart = (part) => {
    const isBattery =
      part?.salesType === "battery" || part?.replacementType === "battery";
    const isCharger =
      part?.salesType === "charger" || part?.replacementType === "charger";
    if (!isBattery && !isCharger) return null;

    const ws = String(part?.warrantyStatus ?? "").toLowerCase();
    const isWarranty =
      ws &&
      ws !== "nowarranty" &&
      ws !== "no warranty" &&
      ws !== "withoutwarranty" &&
      ws !== "without warranty" &&
      ws !== "none";
    return isWarranty ? "W" : "NW";
  };

  /** New or old charger sale when customer also provides an old charger (voltage + condition). */
  const partShowsCustomerOldChargerTradeIn = (part) => {
    if (!part) return false;
    if (String(part.partType || "").toLowerCase() !== "sales") return false;
    if (String(part.salesType || "").toLowerCase() !== "charger") return false;
    return (
      part.oldChargerAvailable === true ||
      String(part.oldChargerAvailable) === "true"
    );
  };

  const customerOldChargerTradeInSummary = (part) => {
    const v = String(part?.oldChargerVoltage || "").trim();
    const w = String(part?.oldChargerWorking || "").toLowerCase();
    const workingLabel =
      w === "notworking" || w === "not_working" || w === "not working"
        ? "Not working"
        : "Working";
    const bits = [];
    if (v) bits.push(v);
    bits.push(workingLabel);
    return bits.join(" · ");
  };

  const formatWarrantyType = (warrantyType) => {
    if (!warrantyType || warrantyType === "none") return "None";
    return warrantyType.charAt(0).toUpperCase() + warrantyType.slice(1);
  };

  const handleViewDetails = (jobcard) => {
    setSelectedJobcard(jobcard);
    setShowDetailsModal(true);
  };

  const calculatePartsTotal = (parts) => {
    if (!parts || parts.length === 0) return 0;
    // Only count non-replacement parts in totals
    return parts.reduce((sum, part) => {
      if (part.partType === "replacement" || part.replacementType) {
        return sum;
      }
      return sum + (part.price || 0) * (part.quantity || 1);
    }, 0);
  };

  const getAllPayments = (jobcard) => {
    let payments = [];
    
    if (jobcard.paymentHistory && jobcard.paymentHistory.length > 0) {
      payments = [...jobcard.paymentHistory];
    } else if (jobcard.paidAmount && jobcard.paidAmount > 0) {
      payments = [{
        amount: jobcard.paidAmount,
        date: jobcard.date || getTodayForInput(),
        paymentMode: jobcard.paymentMode || "cash",
      }];
    }
    
    // Sort payments by date in ascending order
    return payments.sort((a, b) => {
      const dateAStr = a.date || "";
      const dateBStr = b.date || "";
      
      if (dateAStr.includes("/") && dateBStr.includes("/")) {
        const [dayA, monthA, yearA] = dateAStr.split("/").map(Number);
        const [dayB, monthB, yearB] = dateBStr.split("/").map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA - dateB;
      }
      
      const dateA = new Date(dateAStr);
      const dateB = new Date(dateBStr);
      return dateA - dateB;
    });
  };

  /** Sum of all recorded payments (paymentHistory or legacy paidAmount). */
  const getTotalPaidByCustomer = (jobcard) =>
    getAllPayments(jobcard).reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

  /** Parts + labour before discount (stored totalAmount is net after discount). */
  const getJobcardGrossBillAmount = (jobcard) =>
    calculatePartsTotal(jobcard?.parts || []) +
    (Number(jobcard?.labour) || 0);

  const formatPaymentDate = (dateString) => {
    if (!dateString) return "N/A";
    // If already in dd/mm/yyyy format, return as is
    if (typeof dateString === "string" && dateString.includes("/")) {
      const parts = dateString.split("/");
      if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2) {
        return dateString;
      }
    }
    // Otherwise, try to format it
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  const formatPaymentTime = (payment) => {
    // Prefer a canonical timestamp if available (avoids server timezone/ICU issues).
    if (payment?.paidAt) {
      try {
        const d = new Date(payment.paidAt);
        if (!Number.isNaN(d.getTime())) {
          return d.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
        }
      } catch {
        // fall through
      }
    }
    // Check if payment has a time field
    if (payment.time && payment.time !== "") {
      // Time is stored as string in HH:mm AM/PM format from backend
      return payment.time;
    }
    // Default to N/A if no time information available
    return "N/A";
  };

  const handleDeleteClick = (jobcard) => {
    setJobcardToDelete(jobcard);
    setShowPasswordModal(true);
    setPassword("");
    setPasswordError("");
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setValidatingPassword(true);

    try {
      // Validate password against backend admin security key
      const response = await fetch(`${API_BASE}/admin/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ securityKey: password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Password is correct, proceed with deletion
        if (jobcardToDelete) {
          await deleteJobcard(jobcardToDelete._id);
        }
      } else {
        setPasswordError("Incorrect admin password. Please try again.");
      }
    } catch (error) {
      console.error("Error validating password:", error);
      setPasswordError("Error validating password. Please try again.");
    } finally {
      setValidatingPassword(false);
    }
  };

  const deleteJobcard = async (jobcardId) => {
    try {
      const response = await fetch(`${API_BASE}/jobcards/${jobcardId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          await getFetchErrorMessage(response, "Failed to delete jobcard")
        );
      }

      alert("Jobcard deleted successfully!");
      setShowPasswordModal(false);
      setPassword("");
      setShowPassword(false);
      setJobcardToDelete(null);
      fetchFinalizedJobcards(); // Refresh the list
    } catch (error) {
      console.error("Error deleting jobcard:", error);
      alert(`Error deleting jobcard: ${error.message}`);
      setShowPasswordModal(false);
      setPassword("");
      setShowPassword(false);
      setJobcardToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowPasswordModal(false);
    setPassword("");
    setPasswordError("");
    setShowPassword(false);
    setJobcardToDelete(null);
  };

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p>Loading finalized jobcards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>All Jobcards (Finalized)</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setFilterType("all")}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              backgroundColor: filterType === "all" ? "#3b82f6" : "#ffffff",
              color: filterType === "all" ? "white" : "#374151",
              cursor: "pointer",
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilterType("service")}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              backgroundColor: filterType === "service" ? "#3b82f6" : "#ffffff",
              color: filterType === "service" ? "white" : "#374151",
              cursor: "pointer",
            }}
          >
            Service
          </button>
          <button
            onClick={() => setFilterType("replacement")}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              backgroundColor: filterType === "replacement" ? "#3b82f6" : "#ffffff",
              color: filterType === "replacement" ? "white" : "#374151",
              cursor: "pointer",
            }}
          >
            Replacement
          </button>
          <button
            onClick={() => setFilterType("sales")}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              backgroundColor: filterType === "sales" ? "#3b82f6" : "#ffffff",
              color: filterType === "sales" ? "white" : "#374151",
              cursor: "pointer",
            }}
          >
            Sales
          </button>
        </div>
      </div>

      {jobcards.length > 0 && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            backgroundColor: "#f9fafb",
            borderRadius: "0.5rem",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              alignItems: "end",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Search by Customer Name
              </label>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Enter customer name..."
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  fontSize: "0.875rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Search by Mobile
              </label>
              <input
                type="text"
                value={searchMobile}
                onChange={(e) => setSearchMobile(e.target.value)}
                placeholder="Enter mobile number..."
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  fontSize: "0.875rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Search by Place
              </label>
              <input
                type="text"
                value={searchPlace}
                onChange={(e) => setSearchPlace(e.target.value)}
                placeholder="Enter place..."
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  fontSize: "0.875rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                Filter by Date
              </label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <DatePicker
                    value={filterDate}
                    onChange={(date) => setFilterDate(date)}
                    placeholder="Select date..."
                    style={{ width: "100%" }}
                  />
                </div>
                {filterDate && (
                  <button
                    type="button"
                    onClick={() => setFilterDate("")}
                    style={{
                      padding: "0.5rem",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      borderRadius: "0.375rem",
                      border: "1px solid #d1d5db",
                      backgroundColor: "#ffffff",
                      color: "#374151",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                    title="Clear date filter"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
          {hasActiveSearchFilters && (
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setSearchName("");
                  setSearchMobile("");
                  setSearchPlace("");
                  setFilterDate("");
                }}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#ffffff",
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {jobcards.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            backgroundColor: "#f9fafb",
            borderRadius: "0.5rem",
            border: "1px solid #e5e7eb",
          }}
        >
          <p style={{ color: "#6b7280", fontSize: "1rem" }}>
            No finalized jobcards found{filterType !== "all" ? ` for ${filterType}` : ""}.
          </p>
        </div>
      ) : filteredJobcards.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            backgroundColor: "#f9fafb",
            borderRadius: "0.5rem",
            border: "1px solid #e5e7eb",
          }}
        >
          <p style={{ color: "#6b7280", fontSize: "1rem" }}>
            No jobcards match the current filters.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {filteredJobcards.map((jobcard) => (
            <div
              key={jobcard._id}
              style={{
                padding: "1.5rem",
                backgroundColor: "#ffffff",
                borderRadius: "0.5rem",
                border: "1px solid #e5e7eb",
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.125rem", fontWeight: 600 }}>
                    {jobcard.jobcardNumber || "N/A"}
                  </h3>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.875rem", color: "#6b7280" }}>
                    Type: <span style={{ textTransform: "capitalize" }}>{jobcard.jobcardType}</span> | Date: {formatDate(jobcard.updatedAt)} | Time: {formatTime(jobcard.updatedAt)}
                  </p>
                  <p style={{ margin: "0", fontSize: "0.75rem", color: "#9ca3af" }}>
                    Created: {formatDateTime(jobcard.createdAt)}
                  </p>
                </div>
                <span
                  style={{
                    padding: "0.25rem 0.75rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    borderRadius: "9999px",
                    backgroundColor: "#d1fae5",
                    color: "#065f46",
                  }}
                >
                  Finalized
                </span>
              </div>

              <div style={{ marginBottom: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Customer</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>{capitalizeText(jobcard.customerName)}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Mobile</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>{jobcard.mobile}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Place</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>{capitalizeText(jobcard.place)}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Total bill amount</p>
                  <p
                    style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#059669" }}
                    title="Parts + labour before discount"
                  >
                    ₹{getJobcardGrossBillAmount(jobcard).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Amount paid by customer</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#2563eb" }}>
                    ₹{getTotalPaidByCustomer(jobcard).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Warranty Status</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>{formatWarrantyType(jobcard.warrantyType)}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Warranty Date/Code</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>
                    {formatDateDDMMYYYY(jobcard.warrantyDate)}
                  </p>
                </div>
              </div>

              {jobcard.parts && jobcard.parts.length > 0 && (
                <div style={{ 
                  marginBottom: "1rem", 
                  padding: "1rem",
                  backgroundColor: "#eff6ff",
                  borderRadius: "0.5rem",
                  border: "2px solid #3b82f6",
                }}>
                  <p style={{ 
                    margin: "0 0 0.75rem 0", 
                    fontSize: "0.875rem", 
                    color: "#1e40af", 
                    fontWeight: 600 
                  }}>
                    Parts ({jobcard.parts.length})
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {jobcard.parts.slice(0, 5).map((part, index) => {
                      const tags = [];
                      if (
                        part.salesType === "battery" ||
                        part.replacementType === "battery"
                      ) {
                        tags.push("battery");
                      }
                      if (
                        part.salesType === "charger" ||
                        part.replacementType === "charger"
                      ) {
                        tags.push("charger");
                      }
                      if (
                        part.partType === "replacement" ||
                        part.replacementType
                      ) {
                        tags.push("replacement");
                      }
                      const modelNames = Array.isArray(part.models)
                        ? part.models.filter(Boolean)
                        : [];
                      if (!tags.length && modelNames.length) {
                        tags.push(...modelNames);
                      }
                      const typeSuffix = tags.length
                        ? ` <${tags.join(", ")}>`
                        : "";
                      let label = part.spareName;
                      if (part.salesType === "oldScooty") {
                        const rawPmc = String(part.pmcNo || "").trim();
                        const pmcDisplay = rawPmc
                          ? `PMC-${rawPmc.replace(/^PMC-?/i, "")}`
                          : "";
                        label = pmcDisplay
                          ? `Old Scooty - ${label} (${pmcDisplay})`
                          : `Old Scooty - ${label}`;
                      }
                      if (part.selectedColor) {
                        label += ` (${part.selectedColor})`;
                      }
                      const nameWithTypes = `${label}${typeSuffix}`;
                      const warrantyTag = getWarrantyTagForPart(part);
                      const warrantyStyles =
                        warrantyTag === "W"
                          ? {
                              backgroundColor: "#dcfce7",
                              borderColor: "#86efac",
                              color: "#166534",
                            }
                          : warrantyTag === "NW"
                          ? {
                              backgroundColor: "#fee2e2",
                              borderColor: "#fecaca",
                              color: "#991b1b",
                            }
                          : null;
                      const scrapQty =
                        part.partType === "sales" &&
                        part.salesType === "battery" &&
                        part.scrapAvailable &&
                        (Number(part.scrapQuantity) || 0) > 0
                          ? Math.max(0, Number(part.scrapQuantity) || 0)
                          : 0;
                      const showOldChargerTrade =
                        partShowsCustomerOldChargerTradeIn(part);
                      const partChipStacked = scrapQty > 0 || showOldChargerTrade;
                      return (
                      <span
                        key={index}
                        style={{
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.875rem",
                          backgroundColor: "#3b82f6",
                          borderRadius: "0.375rem",
                          color: "#ffffff",
                          fontWeight: 500,
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                          display: "inline-flex",
                          flexDirection: partChipStacked ? "column" : "row",
                          alignItems: partChipStacked ? "stretch" : "center",
                          gap: partChipStacked ? "0.35rem" : "0.5rem",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <span>{nameWithTypes}</span>
                          {warrantyTag && (
                            <span
                              style={{
                                padding: "0.125rem 0.375rem",
                                backgroundColor: warrantyStyles?.backgroundColor,
                                borderRadius: "0.25rem",
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                border: `1px solid ${warrantyStyles?.borderColor}`,
                                color: warrantyStyles?.color,
                              }}
                              title={
                                warrantyTag === "W" ? "Warranty" : "No Warranty"
                              }
                            >
                              {warrantyTag}
                            </span>
                          )}
                          <span
                            style={{
                              marginLeft: partChipStacked ? 0 : "auto",
                              padding: "0.125rem 0.375rem",
                              backgroundColor: "rgba(255, 255, 255, 0.2)",
                              borderRadius: "0.25rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            Qty: {part.quantity}
                          </span>
                        </span>
                        {scrapQty > 0 && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              padding: "0.2rem 0.45rem",
                              backgroundColor: "rgba(254, 243, 199, 0.95)",
                              color: "#92400e",
                              borderRadius: "0.25rem",
                              border: "1px solid rgba(251, 191, 36, 0.6)",
                              alignSelf: "flex-start",
                            }}
                            title={
                              String(part.batteryOldNew || "").toLowerCase() ===
                              "new"
                                ? "Old batteries received with this new battery sale"
                                : "Scrap received with this old battery sale"
                            }
                          >
                            Customer scrap available: ×{scrapQty}
                          </span>
                        )}
                        {showOldChargerTrade && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              padding: "0.2rem 0.45rem",
                              backgroundColor: "rgba(254, 243, 199, 0.95)",
                              color: "#92400e",
                              borderRadius: "0.25rem",
                              border: "1px solid rgba(251, 191, 36, 0.6)",
                              alignSelf: "flex-start",
                            }}
                            title={
                              part.oldChargerName
                                ? `Customer old charger: ${part.oldChargerName}`
                                : "Old charger received from customer with this charger sale"
                            }
                          >
                            Customer old charger:{" "}
                            {customerOldChargerTradeInSummary(part)}
                          </span>
                        )}
                      </span>
                      );
                    })}
                    {jobcard.parts.length > 5 && (
                      <span
                        style={{
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.875rem",
                          backgroundColor: "#60a5fa",
                          borderRadius: "0.375rem",
                          color: "#ffffff",
                          fontWeight: 500,
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                        }}
                      >
                        +{jobcard.parts.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {jobcard.details && jobcard.details.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Details</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {jobcard.details.map((detail, index) => (
                      <span
                        key={index}
                        style={{
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.75rem",
                          backgroundColor: "#eff6ff",
                          borderRadius: "0.25rem",
                          color: "#1e40af",
                        }}
                      >
                        {index + 1}) {detail}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button
                  onClick={() => setPrintingJobcard(jobcard)}
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    borderRadius: "0.375rem",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#ffffff",
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  Print
                </button>
                <button
                  onClick={() => handleViewDetails(jobcard)}
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    borderRadius: "0.375rem",
                    border: "1px solid #3b82f6",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  View Details
                </button>
                <button
                  onClick={() => handleDeleteClick(jobcard)}
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    borderRadius: "0.375rem",
                    border: "none",
                    backgroundColor: "#ef4444",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Password Confirmation Modal */}
      {showPasswordModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={handleCancelDelete}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "2rem",
              borderRadius: "0.5rem",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
              minWidth: "400px",
              maxWidth: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem", fontWeight: 600 }}>
              Confirm Deletion
            </h3>
            <p style={{ margin: "0 0 1.5rem 0", fontSize: "0.875rem", color: "#6b7280" }}>
              Please enter the admin password to delete this jobcard.
            </p>
            {jobcardToDelete && (
              <p style={{ margin: "0 0 1rem 0", fontSize: "0.875rem", color: "#374151", fontWeight: 500 }}>
                Jobcard: {jobcardToDelete.jobcardNumber}
              </p>
            )}
            <form onSubmit={handlePasswordSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Admin Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="Enter admin password"
                    style={{
                      width: "100%",
                      padding: "0.5rem 2.5rem 0.5rem 0.5rem",
                      fontSize: "0.875rem",
                      borderRadius: "0.375rem",
                      border: passwordError ? "1px solid #ef4444" : "1px solid #d1d5db",
                      outline: "none",
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "0.5rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#6b7280",
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.75rem", color: "#ef4444" }}>
                    {passwordError}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    borderRadius: "0.375rem",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#ffffff",
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={validatingPassword}
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    borderRadius: "0.375rem",
                    border: "none",
                    backgroundColor: validatingPassword ? "#9ca3af" : "#ef4444",
                    color: "white",
                    cursor: validatingPassword ? "not-allowed" : "pointer",
                  }}
                >
                  {validatingPassword ? "Validating..." : "Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showDetailsModal && selectedJobcard && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            overflowY: "auto",
            padding: "2rem",
          }}
          onClick={() => {
            setShowDetailsModal(false);
            setSelectedJobcard(null);
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "2rem",
              borderRadius: "0.5rem",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
              minWidth: "600px",
              maxWidth: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>
                Jobcard Details: {selectedJobcard.jobcardNumber}
              </h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedJobcard(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: "0.25rem",
                }}
              >
                ×
              </button>
            </div>

            {/* Spare Parts Section */}
            {selectedJobcard.parts && selectedJobcard.parts.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem", fontWeight: 600 }}>Spare Parts</h3>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "0.5rem", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f9fafb" }}>
                        <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>Part Name</th>
                        <th style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.875rem", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>Quantity</th>
                        <th style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>Price (₹)</th>
                        <th style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedJobcard.parts.map((part, index) => {
                        const isReplacement =
                          part.partType === "replacement" || part.replacementType;
                        const qty = part.quantity || 1;
                        const price = part.price || 0;
                        const lineAmount = isReplacement ? 0 : price * qty;
                        const tags = [];
                        if (
                          part.salesType === "battery" ||
                          part.replacementType === "battery"
                        ) {
                          tags.push("battery");
                        }
                        if (
                          part.salesType === "charger" ||
                          part.replacementType === "charger"
                        ) {
                          tags.push("charger");
                        }
                        if (isReplacement) {
                          tags.push("replacement");
                        }
                        const modelNames = Array.isArray(part.models)
                          ? part.models.filter(Boolean)
                          : [];
                        if (!tags.length && modelNames.length) {
                          tags.push(...modelNames);
                        }
                        const typeSuffix = tags.length
                          ? ` <${tags.join(", ")}>`
                          : "";
                        let label = part.spareName;
                        if (part.salesType === "oldScooty") {
                          const rawPmc = String(part.pmcNo || "").trim();
                          const pmcDisplay = rawPmc
                            ? `PMC-${rawPmc.replace(/^PMC-?/i, "")}`
                            : "";
                          label = pmcDisplay
                            ? `Old Scooty - ${label} (${pmcDisplay})`
                            : `Old Scooty - ${label}`;
                        }
                        if (part.selectedColor) {
                          label += ` (${part.selectedColor})`;
                        }
                        const nameWithTypes = `${label}${typeSuffix}`;
                        const warrantyTag = getWarrantyTagForPart(part);
                        const warrantyStyles =
                          warrantyTag === "W"
                            ? {
                                backgroundColor: "#dcfce7",
                                borderColor: "#86efac",
                                color: "#166534",
                              }
                            : warrantyTag === "NW"
                            ? {
                                backgroundColor: "#fee2e2",
                                borderColor: "#fecaca",
                                color: "#991b1b",
                              }
                            : null;
                        const modalScrapQty =
                          part.partType === "sales" &&
                          part.salesType === "battery" &&
                          part.scrapAvailable &&
                          (Number(part.scrapQuantity) || 0) > 0
                            ? Math.max(0, Number(part.scrapQuantity) || 0)
                            : 0;
                        const modalShowOldChargerTrade =
                          partShowsCustomerOldChargerTradeIn(part);

                        return (
                          <tr
                            key={index}
                            style={{
                              borderBottom:
                                index < selectedJobcard.parts.length - 1
                                  ? "1px solid #e5e7eb"
                                  : "none",
                            }}
                          >
                            <td
                              style={{
                                padding: "0.75rem",
                                fontSize: "0.875rem",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.35rem",
                                  alignItems: "flex-start",
                                }}
                              >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                  <span>{nameWithTypes}</span>
                                  {warrantyTag && (
                                    <span
                                      style={{
                                        padding: "0.1rem 0.35rem",
                                        borderRadius: "0.25rem",
                                        backgroundColor:
                                          warrantyStyles?.backgroundColor,
                                        color: warrantyStyles?.color,
                                        fontSize: "0.75rem",
                                        fontWeight: 800,
                                        border: `1px solid ${warrantyStyles?.borderColor}`,
                                      }}
                                      title={
                                        warrantyTag === "W"
                                          ? "Warranty"
                                          : "No Warranty"
                                      }
                                    >
                                      {warrantyTag}
                                    </span>
                                  )}
                                </span>
                                {modalScrapQty > 0 && (
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      color: "#92400e",
                                      backgroundColor: "#fffbeb",
                                      padding: "0.2rem 0.45rem",
                                      borderRadius: "0.25rem",
                                      border: "1px solid #fcd34d",
                                    }}
                                  >
                                    Customer scrap available: ×{modalScrapQty}
                                  </span>
                                )}
                                {modalShowOldChargerTrade && (
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      color: "#92400e",
                                      backgroundColor: "#fffbeb",
                                      padding: "0.2rem 0.45rem",
                                      borderRadius: "0.25rem",
                                      border: "1px solid #fcd34d",
                                    }}
                                    title={
                                      part.oldChargerName
                                        ? `Customer old charger: ${part.oldChargerName}`
                                        : "Old charger received from customer with this charger sale"
                                    }
                                  >
                                    Customer old charger:{" "}
                                    {customerOldChargerTradeInSummary(part)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td
                              style={{
                                padding: "0.75rem",
                                textAlign: "center",
                                fontSize: "0.875rem",
                              }}
                            >
                              {qty}
                            </td>
                            <td
                              style={{
                                padding: "0.75rem",
                                textAlign: "right",
                                fontSize: "0.875rem",
                              }}
                            >
                              {price.toFixed(2)}
                            </td>
                            <td
                              style={{
                                padding: "0.75rem",
                                textAlign: "right",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}
                            >
                              ₹{lineAmount.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ backgroundColor: "#f9fafb", fontWeight: 600 }}>
                        <td colSpan="3" style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem" }}>Parts Total:</td>
                        <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem" }}>
                          ₹{calculatePartsTotal(selectedJobcard.parts).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bill Summary Section */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem", fontWeight: 600 }}>Bill Summary</h3>
              <div style={{ backgroundColor: "#f9fafb", padding: "1rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.875rem" }}>Parts Total:</span>
                  <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>₹{calculatePartsTotal(selectedJobcard.parts || []).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.875rem" }}>Labour:</span>
                  <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>₹{(selectedJobcard.labour || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", borderTop: "1px solid #e5e7eb", paddingTop: "0.5rem" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Total Bill Amount:</span>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#059669" }}>
                    ₹{((calculatePartsTotal(selectedJobcard.parts || []) + (selectedJobcard.labour || 0)).toFixed(2))}
                  </span>
                </div>
                {selectedJobcard.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                    <span style={{ fontSize: "0.875rem" }}>Discount:</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#ef4444" }}>-₹{(selectedJobcard.discount || 0).toFixed(2)}</span>
                  </div>
                )}
                {selectedJobcard.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", borderTop: "1px solid #e5e7eb", paddingTop: "0.5rem" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Price After Discount:</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#059669" }}>
                      ₹{((calculatePartsTotal(selectedJobcard.parts || []) + (selectedJobcard.labour || 0) - (selectedJobcard.discount || 0)).toFixed(2))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment History Section */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem", fontWeight: 600 }}>Payment History</h3>
              {getAllPayments(selectedJobcard).length > 0 ? (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "0.5rem", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f9fafb" }}>
                        <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>Date</th>
                        <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>Time</th>
                        <th style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>Amount (₹)</th>
                        <th style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.875rem", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getAllPayments(selectedJobcard).map((payment, index) => (
                        <tr key={index} style={{ borderBottom: index < getAllPayments(selectedJobcard).length - 1 ? "1px solid #e5e7eb" : "none" }}>
                          <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>{formatPaymentDate(payment.date)}</td>
                          <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>{formatPaymentTime(payment)}</td>
                          <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", fontWeight: 500 }}>
                            ₹{(payment.amount || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.875rem", textTransform: "uppercase" }}>
                            {payment.paymentMode || "Cash"}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: "#f9fafb", fontWeight: 600 }}>
                        <td colSpan="3" style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem" }}>Total Paid:</td>
                        <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem" }}>
                          ₹{getAllPayments(selectedJobcard).reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>No payment history available.</p>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedJobcard(null);
                }}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#ffffff",
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {printingJobcard && (
        <div
          className="jobcard-print-modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            overflow: "auto",
          }}
          onClick={(e) => e.target === e.currentTarget && setPrintingJobcard(null)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "0.5rem",
              maxWidth: "95vw",
              maxHeight: "95vh",
              overflow: "auto",
              padding: "1rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <JobcardPrintView
              jobcard={printingJobcard}
              onClose={() => setPrintingJobcard(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
