import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import FinalizeJobcardModal from "./FinalizeJobcardModal";
import SettleJobcardModal from "./SettleJobcardModal";
import JobcardPrintView from "../../components/JobcardPrintView";
import DatePicker from "../../components/DatePicker";

export default function PendingJobcard() {
  const navigate = useNavigate();
  const location = useLocation();
  const editedJobcardIdRef = useRef(null);
  const [jobcards, setJobcards] = useState([]);
  const [filteredJobcards, setFilteredJobcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [finalizingJobcard, setFinalizingJobcard] = useState(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [settlingJobcard, setSettlingJobcard] = useState(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [printingJobcard, setPrintingJobcard] = useState(null);
  const [searchName, setSearchName] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Same wording as jobcard creation form (Warranty Type dropdown)
  const getWarrantyTypeLabel = (value) => {
    if (!value) return "";
    const labels = { none: "No Warranty", full: "Full Warranty", battery: "Battery Only", charger: "Charger Only" };
    return labels[value] ?? value;
  };
  const getWarrantyDisplay = (jc) => {
    const label = getWarrantyTypeLabel(jc?.warrantyType);
    if (!label) return "";
    const date = jc?.warrantyDate && jc.warrantyDate !== "N/A" && jc.warrantyDate !== "NA" ? jc.warrantyDate : null;
    return date ? `${label} (${date})` : label;
  };

  const getTotalPaidByCustomer = (jc) => {
    if (!jc) return 0;
    if (jc.paymentHistory && jc.paymentHistory.length > 0) {
      return jc.paymentHistory.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      );
    }
    return Number(jc.paidAmount) || 0;
  };

  const calculatePartsTotalForPreview = (parts) => {
    if (!parts || parts.length === 0) return 0;
    return parts.reduce((sum, part) => {
      if (part.partType === "replacement" || part.replacementType) return sum;
      return sum + (Number(part.price) || 0) * (Number(part.quantity) || 1);
    }, 0);
  };

  /** Parts + labour before discount (totalAmount on card is net after discount). */
  const getJobcardGrossBillAmount = (jc) =>
    calculatePartsTotalForPreview(jc?.parts) + (Number(jc?.labour) || 0);

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

  // Capture editedJobcardId when returning from Edit Jobcard (Update)
  useEffect(() => {
    const editedId = location.state?.editedJobcardId;
    if (editedId) {
      editedJobcardIdRef.current = editedId;
      // Clear state so refresh doesn't re-scroll
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.editedJobcardId, location.pathname, navigate]);

  useEffect(() => {
    fetchPendingJobcards();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [jobcards, searchName, filterDate, filterStatus]);

  // Scroll edited jobcard into view after list loads
  useEffect(() => {
    if (loading || !editedJobcardIdRef.current || filteredJobcards.length === 0) return;
    const id = editedJobcardIdRef.current;
    editedJobcardIdRef.current = null; // Only scroll once
    const el = document.querySelector(`[data-jobcard-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, filteredJobcards]);

  const fetchPendingJobcards = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/jobcards?status=pending");
      if (!response.ok) {
        throw new Error("Failed to fetch pending jobcards");
      }
      const data = await response.json();
      // Sort by jobcard date (from form) first, then by creation time
      // Date field is in format "YYYY-MM-DD", createdAt is full timestamp
      const sortedData = [...data].sort((a, b) => {
        // First, compare by the date field (date entered in form)
        const dateA = a.date || "";
        const dateB = b.date || "";
        
        if (dateA !== dateB) {
          // Compare dates (YYYY-MM-DD format can be compared as strings)
          // Descending order: newer date first
          return dateB.localeCompare(dateA);
        }
        
        // If dates are the same, sort by creation time (createdAt)
        const getTimestamp = (jobcard) => {
          if (!jobcard.createdAt) return 0;
          const date = new Date(jobcard.createdAt);
          return isNaN(date.getTime()) ? 0 : date.getTime();
        };
        
        const timeA = getTimestamp(a);
        const timeB = getTimestamp(b);
        
        // Descending order: newest time first
        return timeB - timeA;
      });
      
      setJobcards(sortedData);
    } catch (error) {
      console.error("Error fetching pending jobcards:", error);
      alert(`Error loading jobcards: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (jobcard) => {
    navigate("/jobcards/new", {
      state: {
        editJobcard: jobcard,
      },
    });
  };

  const handleFinalize = (jobcard) => {
    // If jobcard has pending amount, show settle modal instead
    if (jobcard.pendingAmount && jobcard.pendingAmount > 0) {
      setSettlingJobcard(jobcard);
      setShowSettleModal(true);
    } else {
      setFinalizingJobcard(jobcard);
      setShowFinalizeModal(true);
    }
  };

  const handleFinalizeWithPending = async (jobcard) => {
    const pendingAmount = jobcard.pendingAmount || 0;
    const confirmMessage = `Pending amount of ₹${pendingAmount.toFixed(2)} is still left. Do you want to finalize? Sure?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/jobcards/${jobcard._id}/finalize`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          labour: jobcard.labour || 0,
          discount: jobcard.discount || 0,
          paymentMode: jobcard.paymentMode || "cash",
          forceFinalize: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to finalize jobcard");
      }

      alert("Jobcard finalized successfully!");
      fetchPendingJobcards(); // Refresh the list
    } catch (error) {
      console.error("Error finalizing jobcard:", error);
      alert(`Error finalizing jobcard: ${error.message}`);
    }
  };

  const handleSettleSuccess = () => {
    setShowSettleModal(false);
    setSettlingJobcard(null);
    fetchPendingJobcards();
  };

  const handleFinalizeSuccess = () => {
    setShowFinalizeModal(false);
    setFinalizingJobcard(null);
    fetchPendingJobcards(); // Refresh the list
  };

  const handleDelete = async (jobcardId) => {
    if (!window.confirm("Are you sure you want to delete this jobcard? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/jobcards/${jobcardId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete jobcard");
      }

      alert("Jobcard deleted successfully!");
      fetchPendingJobcards(); // Refresh the list
    } catch (error) {
      console.error("Error deleting jobcard:", error);
      alert(`Error deleting jobcard: ${error.message}`);
    }
  };

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

  const formatTime = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "N/A";
    }
  };

  const applyFilters = () => {
    let filtered = [...jobcards];

    // Filter by name (customer name)
    if (searchName.trim()) {
      const searchLower = searchName.toLowerCase().trim();
      filtered = filtered.filter((jobcard) =>
        jobcard.customerName?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by date
    if (filterDate) {
      // Convert filterDate (YYYY-MM-DD) to match jobcard.date format
      // jobcard.date is stored as YYYY-MM-DD string
      filtered = filtered.filter((jobcard) => {
        if (!jobcard.date) return false;
        return jobcard.date === filterDate;
      });
    }

    // Filter by status
    if (filterStatus !== "all") {
      if (filterStatus === "pending_payment") {
        filtered = filtered.filter(
          (jobcard) => jobcard.pendingAmount && jobcard.pendingAmount > 0
        );
      } else if (filterStatus === "not_finalized") {
        filtered = filtered.filter(
          (jobcard) => !jobcard.pendingAmount || jobcard.pendingAmount === 0
        );
      }
    }

    // Sort by jobcard date (from form) first, then by creation time
    // Date field is in format "YYYY-MM-DD", createdAt is full timestamp
    filtered.sort((a, b) => {
      // First, compare by the date field (date entered in form)
      const dateA = a.date || "";
      const dateB = b.date || "";
      
      if (dateA !== dateB) {
        // Compare dates (YYYY-MM-DD format can be compared as strings)
        // Descending order: newer date first
        return dateB.localeCompare(dateA);
      }
      
      // If dates are the same, sort by creation time (createdAt)
      const getTimestamp = (jobcard) => {
        if (!jobcard.createdAt) return 0;
        const date = new Date(jobcard.createdAt);
        return isNaN(date.getTime()) ? 0 : date.getTime();
      };
      
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);
      
      // Descending order: newest time first
      return timeB - timeA;
    });

    setFilteredJobcards(filtered);
  };

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p>Loading pending jobcards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Pending Jobcards</h2>
        <button
          onClick={() => navigate("/jobcards/new")}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            borderRadius: "0.375rem",
            border: "none",
            backgroundColor: "#3b82f6",
            color: "white",
            cursor: "pointer",
          }}
        >
          + New Jobcard
        </button>
      </div>

      {/* Search and Filter Section */}
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
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "1rem",
            alignItems: "end",
          }}
        >
          {/* Name Search */}
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
              }}
            />
          </div>

          {/* Date Filter */}
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
              <div style={{ flex: 1 }}>
                <DatePicker
                  value={filterDate}
                  onChange={(date) => setFilterDate(date)}
                  placeholder="Select date..."
                  style={{ width: "100%" }}
                />
              </div>
              {filterDate && (
                <button
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

          {/* Status Filter */}
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
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                fontSize: "0.875rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                outline: "none",
                backgroundColor: "white",
                cursor: "pointer",
              }}
            >
              <option value="all">All</option>
              <option value="pending_payment">Pending Payment</option>
              <option value="not_finalized">Not Finalized</option>
            </select>
          </div>
        </div>

        {/* Clear Filters Button */}
        {(searchName || filterDate || filterStatus !== "all") && (
          <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                setSearchName("");
                setFilterDate("");
                setFilterStatus("all");
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

      {filteredJobcards.length === 0 ? (
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
            {jobcards.length === 0
              ? "No pending jobcards found."
              : "No jobcards match the current filters."}
          </p>
          <button
            onClick={() => navigate("/jobcards/new")}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              borderRadius: "0.375rem",
              border: "none",
              backgroundColor: "#3b82f6",
              color: "white",
              cursor: "pointer",
            }}
          >
            Create New Jobcard
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "1.75rem",
          }}
        >
          {filteredJobcards.map((jobcard) => (
            <div
              key={jobcard._id}
              data-jobcard-id={jobcard._id}
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
                  <p style={{ margin: "0", fontSize: "0.875rem", color: "#6b7280" }}>
                    Type: <span style={{ textTransform: "capitalize" }}>{jobcard.jobcardType}</span> | Date: {formatDate(jobcard.date)} | Created: {formatTime(jobcard.createdAt)}
                  </p>
                </div>
                <span
                  style={{
                    padding: "0.25rem 0.75rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    borderRadius: "9999px",
                    backgroundColor: jobcard.pendingAmount && jobcard.pendingAmount > 0 ? "#fee2e2" : "#fef3c7",
                    color: jobcard.pendingAmount && jobcard.pendingAmount > 0 ? "#991b1b" : "#92400e",
                    border: jobcard.pendingAmount && jobcard.pendingAmount > 0 ? "1px solid #fecaca" : "none",
                  }}
                >
                  {jobcard.pendingAmount && jobcard.pendingAmount > 0 
                    ? `₹${jobcard.pendingAmount.toFixed(2)} Pending` 
                    : "Pending"}
                </span>
              </div>

              <div style={{ marginBottom: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Customer</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>{jobcard.customerName}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Mobile</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>{jobcard.mobile}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Place</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>{jobcard.place}</p>
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
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>Warranty</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>{getWarrantyDisplay(jobcard) || "—"}</p>
                </div>
              </div>

              {jobcard.parts && jobcard.parts.length > 0 && (() => {
                const getWarrantyTagForPart = (part) => {
                  const isBattery =
                    part?.salesType === "battery" ||
                    part?.replacementType === "battery";
                  const isCharger =
                    part?.salesType === "charger" ||
                    part?.replacementType === "charger";
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

                const grouped = { service: [], replacement: [], sales: [] };
                jobcard.parts.forEach((part) => {
                  const type = ["service", "replacement", "sales"].includes(part.partType)
                    ? part.partType
                    : (jobcard.jobcardType || "service");
                  grouped[type].push(part);
                });

                const categories = [
                  { key: "service", label: "🔧 Service", border: "#3b82f6", bg: "#eff6ff", chip: "#3b82f6" },
                  { key: "replacement", label: "🔄 Replacement", border: "#10b981", bg: "#ecfdf5", chip: "#10b981" },
                  { key: "sales", label: "💰 Sales", border: "#8b5cf6", bg: "#f5f3ff", chip: "#8b5cf6" },
                ];

                return (
                  <div
                    style={{
                      marginBottom: "1rem",
                      padding: "1rem",
                      backgroundColor: "#f8fafc",
                      borderRadius: "0.5rem",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 0.75rem 0",
                        fontSize: "0.875rem",
                        color: "#334155",
                        fontWeight: 700,
                      }}
                    >
                      Parts Overview ({jobcard.parts.length})
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {categories.map((category) =>
                        grouped[category.key].length > 0 ? (
                          <div
                            key={category.key}
                            style={{
                              padding: "0.75rem",
                              borderRadius: "0.5rem",
                              border: `1px solid ${category.border}`,
                              backgroundColor: category.bg,
                            }}
                          >
                            <p
                              style={{
                                margin: "0 0 0.5rem 0",
                                fontSize: "0.8125rem",
                                fontWeight: 700,
                                color: "#0f172a",
                              }}
                            >
                              {category.label} ({grouped[category.key].length})
                            </p>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                              {grouped[category.key].map((part, index) => {
                                const scrapQty =
                                  part.partType === "sales" &&
                                  part.salesType === "battery" &&
                                  part.scrapAvailable &&
                                  (Number(part.scrapQuantity) || 0) > 0
                                    ? Math.max(0, Number(part.scrapQuantity) || 0)
                                    : 0;
                                const showOldChargerTrade =
                                  partShowsCustomerOldChargerTradeIn(part);
                                const partChipStacked =
                                  scrapQty > 0 || showOldChargerTrade;
                                return (
                                <span
                                  key={`${category.key}-${index}`}
                                  style={{
                                    padding: "0.45rem 0.65rem",
                                    fontSize: "0.8125rem",
                                    backgroundColor: category.chip,
                                    borderRadius: "0.375rem",
                                    color: "#ffffff",
                                    fontWeight: 500,
                                    display: "inline-flex",
                                    flexDirection: partChipStacked
                                      ? "column"
                                      : "row",
                                    alignItems: partChipStacked
                                      ? "stretch"
                                      : "center",
                                    gap: partChipStacked ? "0.35rem" : "0.45rem",
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "0.45rem",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                  <span>
                                    {(() => {
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
                                      // Append model names when present and no battery/charger/replacement tag
                                      const modelNames = Array.isArray(
                                        part.models
                                      )
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
                                      return `${label}${typeSuffix}`;
                                    })()}
                                  </span>
                                  {(() => {
                                    const tag = getWarrantyTagForPart(part);
                                    if (!tag) return null;
                                    const styles =
                                      tag === "W"
                                        ? {
                                            backgroundColor: "#dcfce7",
                                            borderColor: "#86efac",
                                            color: "#166534",
                                          }
                                        : {
                                            backgroundColor: "#fee2e2",
                                            borderColor: "#fecaca",
                                            color: "#991b1b",
                                          };
                                    return (
                                      <span
                                        style={{
                                          padding: "0.1rem 0.35rem",
                                          borderRadius: "0.25rem",
                                          backgroundColor: styles.backgroundColor,
                                          border: `1px solid ${styles.borderColor}`,
                                          color: styles.color,
                                          fontSize: "0.72rem",
                                          fontWeight: 800,
                                        }}
                                        title={tag === "W" ? "Warranty" : "No Warranty"}
                                      >
                                        {tag}
                                      </span>
                                    );
                                  })()}
                                  <span
                                    style={{
                                      marginLeft: partChipStacked ? 0 : "auto",
                                      padding: "0.1rem 0.35rem",
                                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                                      borderRadius: "0.25rem",
                                      fontSize: "0.72rem",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Qty: {part.quantity}
                                  </span>
                                  </span>
                                  {scrapQty > 0 && (
                                    <span
                                      style={{
                                        fontSize: "0.7rem",
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
                                        fontSize: "0.7rem",
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
                            </div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                );
              })()}

              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "1rem",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
                    onClick={() => handleEdit(jobcard)}
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
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(jobcard._id)}
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

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {/* For pending-payment jobcards, show Settle just left of Finalize */}
                  {jobcard.pendingAmount && jobcard.pendingAmount > 0 ? (
                    <button
                      onClick={() => handleFinalize(jobcard)}
                      style={{
                        padding: "0.5rem 1rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        borderRadius: "0.375rem",
                        border: "none",
                        backgroundColor: "#3b82f6",
                        color: "white",
                        cursor: "pointer",
                      }}
                    >
                      Settle
                    </button>
                  ) : null}
                  <button
                    onClick={() =>
                      jobcard.pendingAmount && jobcard.pendingAmount > 0
                        ? handleFinalizeWithPending(jobcard)
                        : handleFinalize(jobcard)
                    }
                    style={{
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      borderRadius: "0.375rem",
                      border: "none",
                      backgroundColor: "#10b981",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    Finalize
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showFinalizeModal && finalizingJobcard && (
        <FinalizeJobcardModal
          jobcard={finalizingJobcard}
          onClose={() => {
            setShowFinalizeModal(false);
            setFinalizingJobcard(null);
          }}
          onSuccess={handleFinalizeSuccess}
          onEdit={() => {
            setShowFinalizeModal(false);
            setFinalizingJobcard(null);
            handleEdit(finalizingJobcard);
          }}
        />
      )}

      {showSettleModal && settlingJobcard && (
        <SettleJobcardModal
          jobcard={settlingJobcard}
          onClose={() => {
            setShowSettleModal(false);
            setSettlingJobcard(null);
          }}
          onSuccess={handleSettleSuccess}
        />
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
