import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo, useRef } from "react";
import { formatDate, getTodayForInput } from "../utils/dateUtils";

import { API_BASE } from "../config/api";
import { getFetchErrorMessage } from "../utils/apiError";
/** Parse yyyy-mm-dd to local Date (noon) for stable calendar math */
function ymdToLocalDate(ymd) {
  const parts = String(ymd || "").split("-");
  if (parts.length !== 3) return new Date();
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0);
}

function dateToYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdToDdMmYyyy(ymd) {
  const parts = String(ymd || "").split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** yyyy-mm -> display as mm/yyyy */
function yyyyMmToSlashDisplay(yyyyMm) {
  const [y, m] = String(yyyyMm || "").split("-");
  if (!y || !m) return "";
  return `${String(m).padStart(2, "0")}/${y}`;
}

const FINANCE_MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
import { useSessionTimeout } from "../hooks/useSessionTimeout";
import {
  FaTools,
  FaBatteryFull,
  FaMotorcycle,
  FaMoneyBillWave,
} from "react-icons/fa";

/** Jobcard row date shown as dd/mm/yyyy in finance lists */
function formatFinanceJobcardDate(raw) {
  if (raw == null || raw === "") return "—";
  const s = String(raw).trim();
  const head = s.split(" ")[0];
  if (head.includes("/") && !/^\d{4}-\d{2}-\d{2}$/.test(head)) {
    return head;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
    return formatDate(`${head}T12:00:00`);
  }
  const out = formatDate(s);
  return out || s;
}

export default function Admin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState("spares");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [spares, setSpares] = useState([]);
  const [sparesLoading, setSparesLoading] = useState(false);
  const [sparesError, setSparesError] = useState("");
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [batteries, setBatteries] = useState([]);
  const [batteriesLoading, setBatteriesLoading] = useState(false);
  const [batteriesError, setBatteriesError] = useState("");
  const [showBatteryLowStockModal, setShowBatteryLowStockModal] =
    useState(false);
  const [chargers, setChargers] = useState([]);
  const [chargersLoading, setChargersLoading] = useState(false);
  const [chargersError, setChargersError] = useState("");
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billsError, setBillsError] = useState("");
  const [jobcards, setJobcards] = useState([]);
  const [jobcardsLoading, setJobcardsLoading] = useState(false);
  const [jobcardsError, setJobcardsError] = useState("");
  const [oldScooties, setOldScooties] = useState([]);
  /** null = finance home (pick Bills vs Jobcards); otherwise full detail for that area */
  const [financeSubView, setFinanceSubView] = useState(null); // null | "bills" | "jobcards"
  const [financeRangeMode, setFinanceRangeMode] = useState("day"); // "day" | "month"
  const [financeSelectedDate, setFinanceSelectedDate] = useState(() =>
    dateToYmd(new Date())
  ); // yyyy-mm-dd (local)
  const [financeSelectedMonth, setFinanceSelectedMonth] = useState(() =>
    dateToYmd(new Date()).slice(0, 7)
  ); // yyyy-mm (local)
  const [showFinanceDayPicker, setShowFinanceDayPicker] = useState(false);
  const [showFinanceMonthPicker, setShowFinanceMonthPicker] = useState(false);
  const [financeCalMonth, setFinanceCalMonth] = useState(() => new Date());
  const [financeMonthPickYear, setFinanceMonthPickYear] = useState(() =>
    new Date().getFullYear()
  );
  const financeDayPickerRef = useRef(null);
  const financeMonthPickerRef = useRef(null);
  /** Last local calendar day we synced finance pickers to (rollover → jump to “today”). */
  const financeWallClockDayRef = useRef(dateToYmd(new Date()));
  /** Finance jobcards profit — full FIFO breakdown in overlay */
  const [financeJobcardProfitModalJobcard, setFinanceJobcardProfitModalJobcard] =
    useState(null);
  /** Finance bills — which row is expanded (inline details below header) */
  const [financeExpandedBillId, setFinanceExpandedBillId] = useState(null);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("sellingPrice");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [companies, setCompanies] = useState([]);

  // Initialize session timeout for admin
  const { showAdminLeavePrompt } = useSessionTimeout();

  // Handle authentication check in useEffect
  useEffect(() => {
    const isAdminAuth = sessionStorage.getItem("adminAuth");
    if (!isAdminAuth) {
      navigate("/admin-login", { replace: true });
    }
  }, [navigate]);

  // Handle URL parameter for section
  useEffect(() => {
    const section = searchParams.get("section");
    if (
      section &&
      ["spares", "batteries", "models", "finance"].includes(section)
    ) {
      setActiveSection(section);
    }
  }, [searchParams]);

  const fetchModels = async () => {
    try {
      setModelsLoading(true);
      setModelsError("");
      // Add cache-busting timestamp so latest model changes always reflect
      const timestamp = Date.now();
      const response = await fetch(
        `${API_BASE}/models?limit=1000&admin=1&t=${timestamp}`
      );
      const data = await response.json();

      console.log("Admin fetchModels - Response:", data);
      console.log("Admin fetchModels - Data array:", data.data);
      console.log("Admin fetchModels - Data length:", data.data?.length);

      if (!response.ok) {
        throw new Error(data.message || "Error fetching models");
      }

      setModels(data.data || []);
      // Extract unique companies for filter
      const uniqueCompanies = [
        ...new Set(data.data?.map((m) => m.company).filter(Boolean) || []),
      ];
      setCompanies(uniqueCompanies);
    } catch (err) {
      console.error("Error fetching models:", err);
      setModelsError(err.message || "Error fetching models");
    } finally {
      setModelsLoading(false);
    }
  };

  // Fetch models data
  useEffect(() => {
    if (activeSection === "models") {
      fetchModels();
    }
  }, [activeSection]);

  // Fetch spares data for admin spares section
  const fetchSparesForAdmin = async () => {
    try {
      setSparesLoading(true);
      setSparesError("");

      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(
        `${API_BASE}/spares?t=${timestamp}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error fetching spares");
      }

      setSpares(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Admin - Error fetching spares:", error);
      setSparesError(error.message || "Error fetching spares. Please try again.");
    } finally {
      setSparesLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === "spares") {
      fetchSparesForAdmin();
    }
  }, [activeSection]);

  // Fetch batteries data for admin batteries section
  const fetchBatteriesForAdmin = async () => {
    try {
      setBatteriesLoading(true);
      setBatteriesError("");

      const timestamp = Date.now();
      const response = await fetch(
        `${API_BASE}/batteries?t=${timestamp}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error fetching batteries");
      }

      setBatteries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Admin - Error fetching batteries:", error);
      setBatteriesError(
        error.message || "Error fetching batteries. Please try again."
      );
    } finally {
      setBatteriesLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === "batteries") {
      fetchBatteriesForAdmin();
    }
  }, [activeSection]);

  const fetchChargersForAdmin = async () => {
    try {
      setChargersLoading(true);
      setChargersError("");
      const timestamp = Date.now();
      const response = await fetch(
        `${API_BASE}/chargers?t=${timestamp}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Error fetching chargers");
      }
      setChargers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Admin - Error fetching chargers:", error);
      setChargersError(
        error.message || "Error fetching chargers. Please try again."
      );
    } finally {
      setChargersLoading(false);
    }
  };

  const fetchBillsForAdmin = async () => {
    try {
      setBillsLoading(true);
      setBillsError("");
      const timestamp = Date.now();
      const response = await fetch(
        `${API_BASE}/bills?t=${timestamp}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Error fetching bills");
      }
      setBills(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Admin - Error fetching bills:", error);
      setBillsError(error.message || "Error fetching bills. Please try again.");
    } finally {
      setBillsLoading(false);
    }
  };

  const fetchJobcardsForAdmin = async () => {
    try {
      setJobcardsLoading(true);
      setJobcardsError("");
      const timestamp = Date.now();
      const response = await fetch(
        `${API_BASE}/jobcards?status=finalized&t=${timestamp}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Error fetching jobcards");
      }
      setJobcards(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Admin - Error fetching jobcards:", error);
      setJobcardsError(
        error.message || "Error fetching jobcards. Please try again."
      );
    } finally {
      setJobcardsLoading(false);
    }
  };

  const fetchOldScootiesForAdmin = async () => {
    try {
      const timestamp = Date.now();
      const response = await fetch(
        `${API_BASE}/old-scooties?t=${timestamp}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Error fetching old scooties");
      }
      setOldScooties(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Admin - Error fetching old scooties:", e);
      setOldScooties([]);
    }
  };

  // When finance section is active, fetch the data needed for profit calculations
  useEffect(() => {
    if (activeSection !== "finance") return;
    fetchBillsForAdmin();
    fetchJobcardsForAdmin();
    // Needed to estimate cost (profit = revenue - cost)
    fetchSparesForAdmin();
    fetchModels();
    fetchBatteriesForAdmin();
    fetchChargersForAdmin();
    fetchOldScootiesForAdmin();
  }, [activeSection, financeSubView]);

  useEffect(() => {
    if (activeSection !== "finance") {
      setFinanceSubView(null);
    }
  }, [activeSection]);

  useEffect(() => {
    if (!showFinanceDayPicker && !showFinanceMonthPicker) return;
    const close = (e) => {
      const t = e.target;
      if (
        financeDayPickerRef.current?.contains(t) ||
        financeMonthPickerRef.current?.contains(t)
      ) {
        return;
      }
      setShowFinanceDayPicker(false);
      setShowFinanceMonthPicker(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showFinanceDayPicker, showFinanceMonthPicker]);

  // Finance: when the real calendar day advances (midnight) or tab regains focus, move selection to today.
  useEffect(() => {
    if (activeSection !== "finance") return;
    const syncFinanceDateToTodayIfNewDay = () => {
      const today = dateToYmd(new Date());
      if (today === financeWallClockDayRef.current) return;
      financeWallClockDayRef.current = today;
      setFinanceSelectedDate(today);
      setFinanceSelectedMonth(today.slice(0, 7));
      setFinanceCalMonth(ymdToLocalDate(today));
      setFinanceMonthPickYear(Number(today.slice(0, 4), 10));
    };
    syncFinanceDateToTodayIfNewDay();
    const intervalId = window.setInterval(syncFinanceDateToTodayIfNewDay, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        syncFinanceDateToTodayIfNewDay();
      }
    };
    window.addEventListener("focus", syncFinanceDateToTodayIfNewDay);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncFinanceDateToTodayIfNewDay);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeSection]);

  // Check if user is authenticated
  const isAdminAuth = sessionStorage.getItem("adminAuth");
  if (!isAdminAuth) {
    return null;
  }

  // Filter and sort models
  const getFilteredAndSortedModels = () => {
    let filtered = [...models];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (model) =>
          model.modelName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          model.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          model.colour?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply company filter
    if (filterCompany !== "all") {
      filtered = filtered.filter((model) => model.company === filterCompany);
    }

    // Apply stock filter
    if (filterStock === "instock") {
      filtered = filtered.filter((model) => model.quantity > 0);
    } else if (filterStock === "outofstock") {
      filtered = filtered.filter((model) => model.quantity === 0);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Handle different data types
      if (
        sortBy === "quantity" ||
        sortBy === "purchasePrice" ||
        sortBy === "sellingPrice"
      ) {
        aValue = aValue ?? 0;
        bValue = bValue ?? 0;
        aValue = typeof aValue === "number" ? aValue : parseFloat(aValue) || 0;
        bValue = typeof bValue === "number" ? bValue : parseFloat(bValue) || 0;
        if (sortOrder === "asc") return aValue - bValue;
        return bValue - aValue;
      } else if (sortBy === "purchasedInWarranty") {
        // For warranty sorting, convert boolean to number for comparison
        aValue = aValue ? 1 : 0;
        bValue = bValue ? 1 : 0;
      } else {
        aValue = (aValue || "").toString().toLowerCase();
        bValue = (bValue || "").toString().toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  };

  // Group models by name and company (matching Models page grouping & quantities)
  const getModelsGroupedByNameAndCompany = () => {
    const filteredModels = getFilteredAndSortedModels();
    const grouped = {};

    filteredModels.forEach((model) => {
      const key = `${model.modelName}-${model.company}`;

      if (!grouped[key]) {
        grouped[key] = {
          modelName: model.modelName,
          company: model.company,
          // Use earliest purchase date within the group for display
          purchaseDate: model.purchaseDate || model.createdAt || null,
          // True if any entry in the group was purchased in warranty
          purchasedInWarranty: !!model.purchasedInWarranty,
          colours: [],
          // Map of description label -> { [colour]: quantity }
          descriptionColorMap: {},
          totalQuantity: 0,
          totalValue: 0,
          hasMissingPrice: false,
          inWarranty: false,
          models: [],
          lowestPrice: null,
          sellingPrice: null,
        };
      } else {
        // Keep the earliest purchase date for the group
        const currentDate = grouped[key].purchaseDate
          ? new Date(grouped[key].purchaseDate)
          : null;
        const modelDate = model.purchaseDate || model.createdAt || null;
        if (modelDate) {
          const modelDateObj = new Date(modelDate);
          if (!currentDate || modelDateObj < currentDate) {
            grouped[key].purchaseDate = modelDate;
          }
        }

        if (model.purchasedInWarranty) {
          grouped[key].purchasedInWarranty = true;
        }
      }

      // Store selling price from model (first non-null)
      if (!grouped[key].sellingPrice && model.sellingPrice) {
        grouped[key].sellingPrice = model.sellingPrice;
      }

      // Update lowest purchase price (only consider prices > 0)
      if (model.purchasePrice && model.purchasePrice > 0) {
        if (
          grouped[key].lowestPrice === null ||
          model.purchasePrice < grouped[key].lowestPrice
        ) {
          grouped[key].lowestPrice = model.purchasePrice;
        }
      }

      // Aggregate colors from stockEntries if available
      let hasColorsFromStockEntries = false;
      if (
        model.stockEntries &&
        Array.isArray(model.stockEntries) &&
        model.stockEntries.length > 0
      ) {
        model.stockEntries.forEach((entry) => {
          if (
            entry.colorQuantities &&
            Array.isArray(entry.colorQuantities) &&
            entry.colorQuantities.length > 0
          ) {
            hasColorsFromStockEntries = true;
            entry.colorQuantities.forEach((cq) => {
              if (cq.color && cq.color.trim() !== "") {
                const existingColor = grouped[key].colours.find(
                  (c) => c.colour === cq.color
                );
                const quantityToAdd = parseInt(cq.quantity) || 0;
                if (existingColor) {
                  existingColor.quantity += quantityToAdd;
                } else {
                  grouped[key].colours.push({
                    colour: cq.color,
                    quantity: quantityToAdd,
                  });
                }
                grouped[key].totalQuantity += quantityToAdd;

                // Also aggregate by combined description tags for this stock entry.
                // All description tags entered together for this entry are treated as ONE label.
                const descParts = Array.isArray(entry.description)
                  ? entry.description
                  : entry.description
                  ? [entry.description]
                  : [];
                const combinedLabel = descParts
                  .map((d) => (d || "").toString().trim())
                  .filter(Boolean)
                  .join(", ");
                if (combinedLabel) {
                  if (!grouped[key].descriptionColorMap[combinedLabel]) {
                    grouped[key].descriptionColorMap[combinedLabel] = {};
                  }
                  const mapForDesc =
                    grouped[key].descriptionColorMap[combinedLabel];
                  const colorKey = cq.color;
                  mapForDesc[colorKey] =
                    (mapForDesc[colorKey] || 0) + quantityToAdd;
                }
              }
            });
          }
        });
      }

      // Also check model.colorQuantities directly (aggregated from stockEntries)
      if (
        model.colorQuantities &&
        Array.isArray(model.colorQuantities) &&
        model.colorQuantities.length > 0
      ) {
        model.colorQuantities.forEach((cq) => {
          if (cq.color && cq.color.trim() !== "") {
            const existingColor = grouped[key].colours.find(
              (c) => c.colour === cq.color
            );
            const quantityToAdd = parseInt(cq.quantity) || 0;
            if (existingColor) {
              // Only update if the quantity from colorQuantities is greater (more recent/accurate)
              if (quantityToAdd > existingColor.quantity) {
                grouped[key].totalQuantity -= existingColor.quantity;
                existingColor.quantity = quantityToAdd;
                grouped[key].totalQuantity += quantityToAdd;
              }
            } else {
              grouped[key].colours.push({
                colour: cq.color,
                quantity: quantityToAdd,
              });
              grouped[key].totalQuantity += quantityToAdd;
            }

            // Also aggregate by combined model-level description tags if present
            const descParts = Array.isArray(model.description)
              ? model.description
              : model.description
              ? [model.description]
              : [];
            const combinedLabel = descParts
              .map((d) => (d || "").toString().trim())
              .filter(Boolean)
              .join(", ");
            if (combinedLabel) {
              if (!grouped[key].descriptionColorMap[combinedLabel]) {
                grouped[key].descriptionColorMap[combinedLabel] = {};
              }
              const mapForDesc =
                grouped[key].descriptionColorMap[combinedLabel];
              const colorKey = cq.color;
              mapForDesc[colorKey] =
                (mapForDesc[colorKey] || 0) + quantityToAdd;
            }
          }
        });
      }

      // Fallback: use old single colour/quantity fields if no colorQuantities found
      if (
        !hasColorsFromStockEntries &&
        (!model.colorQuantities || model.colorQuantities.length === 0) &&
        model.colour &&
        model.colour.trim() !== ""
      ) {
        const modelQuantity = model.quantity || 0;
        const existingColor = grouped[key].colours.find(
          (c) => c.colour === model.colour
        );
        if (existingColor) {
          existingColor.quantity += modelQuantity;
        } else {
          grouped[key].colours.push({
            colour: model.colour,
            quantity: modelQuantity,
          });
        }
        grouped[key].totalQuantity += modelQuantity;

        // Also aggregate fallback colour by combined model-level description tags if present
        const descParts = Array.isArray(model.description)
          ? model.description
          : model.description
          ? [model.description]
          : [];
        const combinedLabel = descParts
          .map((d) => (d || "").toString().trim())
          .filter(Boolean)
          .join(", ");
        if (combinedLabel) {
          if (!grouped[key].descriptionColorMap[combinedLabel]) {
            grouped[key].descriptionColorMap[combinedLabel] = {};
          }
          const mapForDesc =
            grouped[key].descriptionColorMap[combinedLabel];
          const colorKey = model.colour;
          mapForDesc[colorKey] =
            (mapForDesc[colorKey] || 0) + modelQuantity;
        }
      }

      // Inventory value: sum purchasePrice × quantity per stock entry (like Models/AddMoreStock).
      // Also mark groups that have missing purchase prices.
      let modelValueFromEntries = 0;
      let modelHasMissingPrice = false;

      if (
        model.stockEntries &&
        Array.isArray(model.stockEntries) &&
        model.stockEntries.length > 0
      ) {
        model.stockEntries.forEach((entry) => {
          const entryQuantity = Array.isArray(entry.colorQuantities)
            ? entry.colorQuantities.reduce(
                (sum, cq) => sum + (parseInt(cq.quantity) || 0),
                0
              )
            : 0;

          if (entryQuantity <= 0) return;

          const entryPurchasePrice = parseFloat(entry.purchasePrice) || 0;
          if (entryPurchasePrice > 0) {
            modelValueFromEntries += entryQuantity * entryPurchasePrice;
          } else {
            modelHasMissingPrice = true;
          }
        });
      }

      // Fallback for older models without detailed stockEntries: use model-level quantity × purchasePrice
      if (modelValueFromEntries === 0) {
        const qty = model.quantity || 0;
        const purchasePrice = parseFloat(model.purchasePrice) || 0;

        if (qty > 0 && purchasePrice > 0) {
          modelValueFromEntries += qty * purchasePrice;
        } else if (qty > 0) {
          modelHasMissingPrice = true;
        }
      }

      grouped[key].totalValue += modelValueFromEntries;
      if (modelHasMissingPrice) {
        grouped[key].hasMissingPrice = true;
      }
      if (model.purchasedInWarranty) grouped[key].inWarranty = true;
      grouped[key].models.push(model);
    });

    // Convert to array and sort: by selling price if selected, else by lowest purchase price
    const groupedArray = Object.values(grouped);
    if (sortBy === "sellingPrice") {
      groupedArray.sort((a, b) => {
        const pa = parseFloat(a.sellingPrice) || 0;
        const pb = parseFloat(b.sellingPrice) || 0;
        return sortOrder === "asc" ? pa - pb : pb - pa;
      });
    } else {
      groupedArray.sort((a, b) => {
        if (a.lowestPrice === null && b.lowestPrice === null) return 0;
        if (a.lowestPrice === null) return 1;
        if (b.lowestPrice === null) return -1;
        return a.lowestPrice - b.lowestPrice;
      });
    }

    return groupedArray;
  };

  // Get colour for display
  const getColourDisplay = (colour) => {
    const colourMap = {
      red: "#dc3545",
      cherry: "#8B0000",
      blue: "#007bff",
      green: "#28a745",
      black: "#343a40",
      white: "#f8f9fa",
      peacock: "#006994",
      grey: "#808080",
      silver: "#C0C0C0",
      yellow: "#FFFF00",
      "white-black": "#6c757d",
    };
    return colourMap[colour?.toLowerCase()] || "#6c757d";
  };

  // Function to update model price in database
  const updateModelPrice = async (modelId, newPrice) => {
    try {
      const response = await fetch(
        `${API_BASE}/models/${modelId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ purchasePrice: parseFloat(newPrice) }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error updating price");
      }

      // Update local state with the updated model
      setModels((prevModels) =>
        prevModels.map((m) => (m._id === modelId ? data.data : m))
      );

      return true;
    } catch (error) {
      console.error("Error updating model price:", error);
      alert(`Error updating price: ${error.message}`);
      return false;
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const handleLogout = () => {
    // Clear session and warning timeouts
    if (window.sessionTimeout) {
      clearTimeout(window.sessionTimeout);
    }
    if (window.warningTimeout) {
      clearTimeout(window.warningTimeout);
    }
    // Remove auth and navigate
    sessionStorage.removeItem("adminAuth");
    navigate("/", { replace: true });
  };

  const handleNavigateOutsideAdmin = (targetPath) => {
    showAdminLeavePrompt(
      () => {
        navigate(targetPath);
      },
      () => {
        if (window.sessionTimeout) {
          clearTimeout(window.sessionTimeout);
        }
        if (window.warningTimeout) {
          clearTimeout(window.warningTimeout);
        }
        sessionStorage.removeItem("adminAuth");
        navigate(targetPath, { replace: true });
      }
    );
  };

  // -------- SPARES HELPERS --------

  // Determine if color tracking is enabled for a spare
  const isColorTrackingEnabled = (spare) => {
    if (!spare) return false;
    if (spare.hasColors === true) return true;
    if (spare.hasColors === false) return false;
    return Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0;
  };

  // Safely parse purchase dates (supports dd/mm/yyyy and ISO strings)
  const parsePurchaseDate = (dateValue) => {
    if (!dateValue || typeof dateValue !== "string") return NaN;

    // Handle dd/mm/yyyy format
    if (dateValue.includes("/")) {
      const parts = dateValue.split("/");
      if (parts.length === 3) {
        const [dayStr, monthStr, yearStr] = parts;
        const day = parseInt(dayStr, 10);
        const month = parseInt(monthStr, 10);
        const year = parseInt(yearStr, 10);
        if (
          !Number.isNaN(day) &&
          !Number.isNaN(month) &&
          !Number.isNaN(year) &&
          day > 0 &&
          month > 0
        ) {
          return new Date(year, month - 1, day).getTime();
        }
      }
    }

    // Fallback to Date parsing for other formats (e.g., ISO)
    const timestamp = new Date(dateValue).getTime();
    return Number.isNaN(timestamp) ? NaN : timestamp;
  };

  // Get latest purchase date from both stockEntries and colorQuantity
  const getLastPurchaseDate = (spare) => {
    if (!spare) return "N/A";

    const allDates = [];

    if (Array.isArray(spare.stockEntries)) {
      spare.stockEntries.forEach((entry) => {
        if (entry && entry.purchaseDate) {
          allDates.push(entry.purchaseDate);
        }
      });
    }

    if (Array.isArray(spare.colorQuantity)) {
      spare.colorQuantity.forEach((cq) => {
        if (cq && cq.purchaseDate) {
          allDates.push(cq.purchaseDate);
        }
      });
    }

    if (allDates.length === 0) return "N/A";

    const dated = allDates
      .map((raw) => ({
        raw,
        time: parsePurchaseDate(raw),
      }))
      .filter((d) => !Number.isNaN(d.time));

    if (dated.length === 0) return "N/A";

    const latest = dated.reduce((max, curr) =>
      curr.time > max.time ? curr : max
    );

    return latest.raw;
  };

  // Total number of spares
  const totalSpares = useMemo(() => spares.length, [spares]);

  // Calculate total inventory value for spares: quantity × purchasePrice
  const totalSparesValue = useMemo(() => {
    if (!Array.isArray(spares) || spares.length === 0) return 0;

    return spares.reduce((sum, spare) => {
      // If color tracking is enabled, use colorQuantity purchase prices
      if (isColorTrackingEnabled(spare) && Array.isArray(spare.colorQuantity)) {
        const valueFromColors = spare.colorQuantity.reduce((subSum, cq) => {
          const qty = cq.quantity || 0;
          const price = cq.purchasePrice || 0;
          return subSum + qty * price;
        }, 0);
        if (valueFromColors > 0) return sum + valueFromColors;
      }

      // Otherwise, fall back to stockEntries
      if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
        const valueFromEntries = spare.stockEntries.reduce((subSum, entry) => {
          const qty = entry.quantity || 0;
          const price = entry.purchasePrice || 0;
          return subSum + qty * price;
        }, 0);
        return sum + valueFromEntries;
      }

      return sum;
    }, 0);
  }, [spares]);

  // Compute low-stock info for each spare
  const lowStockItems = useMemo(() => {
    if (!Array.isArray(spares) || spares.length === 0) return [];

    const items = [];

    spares.forEach((spare) => {
      const colorTracking = isColorTrackingEnabled(spare);

      if (colorTracking && Array.isArray(spare.colorQuantity)) {
        // Find colors that are below their individual min stock levels
        const lowColors = spare.colorQuantity.filter((cq) => {
          const qty = cq.quantity || 0;
          const minLevel = cq.minStockLevel || 0;
          return qty < minLevel;
        });

        if (lowColors.length === 0) return;

        const currentQty = lowColors.reduce(
          (total, cq) => total + (cq.quantity || 0),
          0
        );

        const colorDisplay = lowColors
          .map(
            (cq) =>
              `${cq.color || "N/A"} (${cq.quantity || 0}/${cq.minStockLevel || 0})`
          )
          .join(", ");

        const minStockDisplay = lowColors
          .map((cq) => cq.minStockLevel || 0)
          .join(", ");

        items.push({
          id: spare._id,
          name: spare.name,
          supplierName: spare.supplierName || "N/A",
          models:
            Array.isArray(spare.models) && spare.models.length > 0
              ? spare.models.join(", ")
              : "N/A",
          colorDisplay,
          currentQuantity: currentQty,
          minStockDisplay,
          sellingPrice: spare.sellingPrice || 0,
          status: "Low Stock (Colors)",
          lastPurchaseDate: getLastPurchaseDate(spare),
        });
      } else {
        // Non-color-tracked spare: compare total quantity to global minStockLevel
        let totalQuantity = 0;

        // Match main Spares table logic:
        // Prefer stored `quantity` when present; otherwise sum stockEntries.
        if (typeof spare.quantity === "number") {
          totalQuantity = spare.quantity;
        } else if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
          totalQuantity = spare.stockEntries.reduce(
            (sum, entry) => sum + (entry.quantity || 0),
            0
          );
        }

        const minLevel = spare.minStockLevel || 0;

        if (totalQuantity < minLevel && minLevel > 0) {
          items.push({
            id: spare._id,
            name: spare.name,
            supplierName: spare.supplierName || "N/A",
            models:
              Array.isArray(spare.models) && spare.models.length > 0
                ? spare.models.join(", ")
                : "N/A",
            colorDisplay: "N/A",
            currentQuantity: totalQuantity,
            minStockDisplay: String(minLevel),
            sellingPrice: spare.sellingPrice || 0,
            status: "Low Stock",
            lastPurchaseDate: getLastPurchaseDate(spare),
          });
        }
      }
    });

    return items;
  }, [spares]);

  const lowStockCount = useMemo(
    () => lowStockItems.length,
    [lowStockItems]
  );

  // Batteries admin summary
  const totalBatteryVarieties = useMemo(
    () => (Array.isArray(batteries) ? batteries.length : 0),
    [batteries]
  );

  // Total sets available (sum of totalSets)
  const totalBatterySetsAvailable = useMemo(() => {
    if (!Array.isArray(batteries) || batteries.length === 0) return 0;
    return batteries.reduce(
      (sum, b) => sum + (Number(b?.totalSets) || 0),
      0
    );
  }, [batteries]);

  const getBatteryLastPurchaseDate = (battery) => {
    if (!battery) return "N/A";
    const entries = Array.isArray(battery.stockEntries) ? battery.stockEntries : [];
    if (entries.length === 0) return battery.purchaseDate ? formatDate(battery.purchaseDate) : "N/A";

    const sorted = [...entries].sort(
      (a, b) => new Date(b.purchaseDate || 0) - new Date(a.purchaseDate || 0)
    );
    const latest = sorted[0]?.purchaseDate;
    return latest ? formatDate(latest) : "N/A";
  };

  const batteryLowStockItems = useMemo(() => {
    if (!Array.isArray(batteries) || batteries.length === 0) return [];

    return batteries
      .map((b) => {
        const currentSets = Number(b?.totalSets) || 0;
        const minSets = Number(b?.minStockLevel) || 0;
        if (minSets <= 0) return null;
        if (currentSets >= minSets) return null;

        return {
          id: b._id,
          name: b.name || "N/A",
          batteryType: b.batteryType || "N/A",
          ampereValue: b.ampereValue || "N/A",
          supplierName: b.supplierName || "N/A",
          currentSets,
          minSets,
          lastPurchaseDate: getBatteryLastPurchaseDate(b),
        };
      })
      .filter(Boolean);
  }, [batteries]);

  const batteryLowStockCount = useMemo(
    () => batteryLowStockItems.length,
    [batteryLowStockItems]
  );

  // -------- FINANCE (Profit) --------
  const normalizeDateLabel = (raw) => {
    if (!raw) return "";
    const s = String(raw).trim();
    if (!s) return "";
    if (s.includes("T")) return s.split("T")[0];
    return s;
  };

  const toYmd = (raw) => {
    const s = normalizeDateLabel(raw);
    if (!s) return "";
    // dd/mm/yyyy -> yyyy-mm-dd
    if (s.includes("/")) {
      const parts = s.split("/");
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        if (yyyy && mm && dd) {
          return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(
            2,
            "0"
          )}`;
        }
      }
    }
    return s;
  };

  const isSameDay = (raw, ymd) => toYmd(raw) === ymd;
  const isSameMonth = (raw, yyyyMm) => {
    const s = toYmd(raw);
    return s && s.startsWith(`${yyyyMm}-`);
  };

  const effectiveYmd =
    financeRangeMode === "day"
      ? financeSelectedDate
      : `${financeSelectedMonth}-01`;
  const effectiveMonth =
    financeRangeMode === "month"
      ? financeSelectedMonth
      : financeSelectedDate.slice(0, 7);

  /**
   * Estimated unit purchase cost from spare stock rows (each row’s purchasePrice × remaining qty).
   * Prefers weighted average of layers with quantity > 0. Bills/jobcards with stored FIFO costs
   * use those fields instead of this fallback.
   */
  const getSpareUnitCost = (spareId) => {
    if (!spareId) return 0;
    const spare = Array.isArray(spares)
      ? spares.find((s) => String(s._id) === String(spareId))
      : null;
    if (!spare) return 0;

    const rowPurchaseTime = (raw) => {
      if (raw == null || raw === "") return -Infinity;
      if (typeof raw === "string") {
        const t = parsePurchaseDate(raw);
        return Number.isNaN(t) ? -Infinity : t;
      }
      const x = new Date(raw).getTime();
      return Number.isNaN(x) ? -Infinity : x;
    };

    const weightedAvgFromEntries = (rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return null;
      let totalQty = 0;
      let totalCost = 0;
      for (const row of rows) {
        if (!row) continue;
        const q = Math.max(0, Number(row.quantity) || 0);
        if (q <= 0) continue;
        const p = Number(row.purchasePrice) || 0;
        totalQty += q;
        totalCost += q * p;
      }
      if (totalQty > 0) {
        const wAvg = totalCost / totalQty;
        if (wAvg > 0) return wAvg;
        return null;
      }
      return null;
    };

    /** When no layer has qty left, use mean of any positive purchasePrice (incl. sold-out rows). */
    const meanPositivePurchasePrices = (rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const prices = [];
      for (const row of rows) {
        if (!row) continue;
        const p = Number(row.purchasePrice) || 0;
        if (p > 0) prices.push(p);
      }
      if (prices.length === 0) return null;
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    };

    /** When no stock remains, use latest-dated row’s purchasePrice as a reference. */
    const latestEntryPurchasePrice = (rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return 0;
      let bestI = -1;
      let bestT = -Infinity;
      rows.forEach((row, i) => {
        if (!row) return;
        const t = rowPurchaseTime(row.purchaseDate);
        if (t > bestT || (t === bestT && i > bestI)) {
          bestT = t;
          bestI = i;
        }
      });
      if (bestI >= 0 && bestT > -Infinity) {
        return Number(rows[bestI].purchasePrice) || 0;
      }
      return Number(rows[rows.length - 1]?.purchasePrice) || 0;
    };

    const resolveFromRows = (rows) => {
      const w = weightedAvgFromEntries(rows);
      if (w != null) return w;
      const pos = meanPositivePurchasePrices(rows);
      if (pos != null) return pos;
      return latestEntryPurchasePrice(rows);
    };

    if (Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0) {
      return resolveFromRows(spare.colorQuantity);
    }

    if (Array.isArray(spare.stockEntries) && spare.stockEntries.length > 0) {
      return resolveFromRows(spare.stockEntries);
    }

    return 0;
  };

  const getBatteryUnitCost = (batteryId) => {
    if (!batteryId) return 0;
    const b = Array.isArray(batteries)
      ? batteries.find((x) => String(x._id) === String(batteryId))
      : null;
    if (!b) return 0;
    const entries = Array.isArray(b.stockEntries) ? b.stockEntries : [];
    if (entries.length === 0) return 0;
    const sorted = [...entries].sort(
      (a, c) => new Date(c.purchaseDate || 0) - new Date(a.purchaseDate || 0)
    );
    const latest = sorted[0] || {};
    const perSet =
      latest.batteriesPerSet !== undefined && latest.batteriesPerSet !== null
        ? Number(latest.batteriesPerSet)
        : Number(b.batteriesPerSet) || 0;
    const pricePerSet = Number(latest.purchasePrice) || 0;
    return perSet > 0 ? pricePerSet / perSet : pricePerSet;
  };

  const getChargerUnitCost = (chargerId) => {
    if (!chargerId) return 0;
    const c = Array.isArray(chargers)
      ? chargers.find((x) => String(x._id) === String(chargerId))
      : null;
    if (!c) return 0;
    const entries = Array.isArray(c.stockEntries) ? c.stockEntries : [];
    if (entries.length === 0) return 0;
    const sorted = [...entries].sort(
      (a, b) => new Date(b.purchaseDate || 0) - new Date(a.purchaseDate || 0)
    );
    return Number(sorted[0]?.purchasePrice) || 0;
  };

  const parseModelStockEntryTime = (entry) => {
    const raw = entry?.purchaseDate;
    if (raw == null || raw === "") return 0;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    const d = new Date(raw);
    const t = d.getTime();
    if (!Number.isNaN(t)) return t;
    const s = String(raw).trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10) - 1;
      const yy = parseInt(m[3], 10);
      return new Date(yy, mm, dd).getTime();
    }
    return 0;
  };

  const stockEntryUnitQuantity = (e) => {
    if (Array.isArray(e?.colorQuantities) && e.colorQuantities.length > 0) {
      return e.colorQuantities.reduce(
        (sum, cq) => sum + (Number(cq.quantity) || 0),
        0
      );
    }
    return Number(e?.quantity) || 0;
  };

  /**
   * Per-unit purchase rate for profit (same idea as Models “per pc” on the latest stock lot).
   * Uses the newest stock entry’s purchasePrice — not a weighted average across old lots (that
   * produced confusing values like ₹30,545.455 when lots mixed ₹31k with older prices).
   */
  const getModelPurchaseUnitCostFromDoc = (m) => {
    if (!m) return 0;
    const direct = Number(m.purchasePrice) || 0;
    if (Array.isArray(m.stockEntries) && m.stockEntries.length > 0) {
      const sorted = [...m.stockEntries].sort(
        (a, b) => parseModelStockEntryTime(b) - parseModelStockEntryTime(a)
      );
      for (const e of sorted) {
        const q = stockEntryUnitQuantity(e);
        const price = Number(e.purchasePrice) || 0;
        if (q > 0 && price > 0) return price;
      }
    }
    if (direct > 0) return direct;
    return 0;
  };

  const getModelUnitCost = (modelId) => {
    if (!modelId) return 0;
    const m = Array.isArray(models)
      ? models.find((x) => String(x._id) === String(modelId))
      : null;
    return getModelPurchaseUnitCostFromDoc(m);
  };

  /** Net bill / deal total on the bill document (often cash paid + trade-in credit toward list price). */
  const billNetAmount = (bill) => Number(bill?.netAmount) || 0;
  /** Cash actually paid by the customer (use for “customer paid” and bill profit first term). */
  const billCashPaid = (bill) => Number(bill?.paidAmount) || 0;

  /**
   * Match catalog model for a bill: by modelId, then modelName + bill colour (variants are separate docs).
   */
  const findInventoryModelForBill = (bill) => {
    if (!bill || !Array.isArray(models) || models.length === 0) return null;
    const id = bill.modelId != null ? String(bill.modelId).trim() : "";
    if (id) {
      const byId = models.find((x) => String(x._id) === id);
      if (byId) return byId;
    }
    const want = String(bill.modelPurchased || "").trim().toLowerCase();
    if (!want) return null;
    const nameMatches = models.filter(
      (x) => String(x.modelName || "").trim().toLowerCase() === want
    );
    if (nameMatches.length === 0) return null;
    const colorWant = String(bill.modelColor || "").trim().toLowerCase();
    if (colorWant) {
      const byColor = nameMatches.find(
        (x) => String(x.colour || "").trim().toLowerCase() === colorWant
      );
      if (byColor) return byColor;
    }
    const withCost = [...nameMatches].sort(
      (a, b) =>
        getModelPurchaseUnitCostFromDoc(b) - getModelPurchaseUnitCostFromDoc(a)
    );
    return withCost[0] || nameMatches[0];
  };

  const billEstimatedCost = (bill) => {
    if (!bill) return 0;
    let cost = 0;
    cost += getModelPurchaseUnitCostFromDoc(findInventoryModelForBill(bill));

    if (bill.withBattery && bill.batteryId && bill.batteryId !== "custom") {
      const type = String(bill.batteryTypeForBill || "").toLowerCase();
      const v = String(bill.batteryVoltageForBill || "");
      const units =
        type === "lead"
          ? v.includes("72")
            ? 6
            : v.includes("60")
            ? 5
            : v.includes("48")
            ? 4
            : 0
          : 1;
      cost += (Number(units) || 0) * getBatteryUnitCost(bill.batteryId);
    }

    if (bill.withCharger && bill.chargerId && bill.chargerId !== "custom") {
      cost += getChargerUnitCost(bill.chargerId);
    }

    if (Array.isArray(bill.accessoryDetails) && bill.accessoryDetails.length > 0) {
      bill.accessoryDetails.forEach((a) => {
        const stored = Number(a?.unitPurchaseCost) || 0;
        cost += stored > 0 ? stored : getSpareUnitCost(a?.id) * 1;
      });
    }

    return cost;
  };

  /** Per display label, sum quantity; preserve first-seen order. */
  const aggregateThingQtyByLabel = (entries) => {
    const qtyByName = new Map();
    const order = [];
    for (const e of entries) {
      const n = String(e?.name || "").trim() || "Unnamed";
      const q = Number(e?.quantity) || 0;
      if (q <= 0) continue;
      if (!qtyByName.has(n)) {
        qtyByName.set(n, 0);
        order.push(n);
      }
      qtyByName.set(n, qtyByName.get(n) + q);
    }
    return order.map((name) => ({ name, quantity: qtyByName.get(name) }));
  };

  const pushThingExtra = (extras, v) => {
    const s = String(v || "").trim();
    if (!s || extras.includes(s)) return;
    extras.push(s);
  };

  const classifyJobcardThingCategory = (part) => {
    const pt = String(part?.partType || "service").toLowerCase();
    if (pt === "replacement" || part?.replacementType) return "replacement";
    if (pt === "sales") return "sales";
    return "service";
  };

  /** Human-readable line for jobcard “things” chips (service / replacement / sales). */
  const formatJobcardThingLabel = (part) => {
    const partName = String(part?.spareName || "").trim() || "Part";
    const color = String(part?.selectedColor || "").trim();
    let main = color ? `${partName} (${color})` : partName;

    const pt = String(part?.partType || "service").toLowerCase();
    const st = String(part?.salesType || "").toLowerCase();
    const rt = String(part?.replacementType || "").toLowerCase();

    if (pt === "sales" && st === "oldScooty") {
      const rawPmc = String(part?.pmcNo || "").trim();
      if (rawPmc) {
        const pmcDisplay = `PMC-${rawPmc.replace(/^PMC-?/i, "")}`;
        main = `${pmcDisplay} — ${main}`;
      }
    }

    const extras = [];
    const isReplacement = pt === "replacement" || Boolean(part?.replacementType);

    if (isReplacement) {
      if (rt) pushThingExtra(extras, rt.charAt(0).toUpperCase() + rt.slice(1));
      if (part?.replacementFromCompany) pushThingExtra(extras, "From company");
      if (part?.voltage) pushThingExtra(extras, `${part.voltage}V`);
      if (part?.batteryType) pushThingExtra(extras, String(part.batteryType));
      if (part?.ampereValue) pushThingExtra(extras, `${part.ampereValue}A`);
      if (part?.oldChargerName)
        pushThingExtra(extras, `Old charger: ${part.oldChargerName}`);
    } else if (pt === "sales") {
      if (st === "battery") {
        pushThingExtra(extras, "Battery");
        if (part?.batteryType) pushThingExtra(extras, String(part.batteryType));
        if (part?.voltage) pushThingExtra(extras, `${part.voltage}V`);
        if (part?.batteryOldNew)
          pushThingExtra(extras, part.batteryOldNew === "new" ? "New" : "Old");
        if (part?.scrapAvailable && (Number(part.scrapQuantity) || 0) > 0) {
          pushThingExtra(
            extras,
            `Customer scrap ×${Number(part.scrapQuantity) || 0}`
          );
        }
      } else if (st === "charger") {
        pushThingExtra(extras, "Charger");
        if (part?.ampereValue) pushThingExtra(extras, `${part.ampereValue}A`);
        if (part?.voltage) pushThingExtra(extras, `${part.voltage}V`);
      } else if (st === "oldScooty") {
        pushThingExtra(extras, "Old scooty");
      } else if (st === "spare") {
        pushThingExtra(extras, "Spare sale");
      }
    }

    if (part?.isCustom) pushThingExtra(extras, "Custom");

    const w = String(part?.warrantyStatus || "").trim();
    if (w && !/^(none|no[- ]?warranty|nw)$/i.test(w)) pushThingExtra(extras, w);

    return extras.length ? `${main} · ${extras.join(" · ")}` : main;
  };

  const resolveBatteryInventoryIdFromJobcardPart = (part) => {
    if (!part) return null;
    const raw =
      part.batteryInventoryId ??
      part.batteryId ??
      part.spareId ??
      part.id;
    if (raw == null || raw === "") return null;
    const id = typeof raw === "object" && raw._id != null ? raw._id : raw;
    return id ? String(id) : null;
  };

  const resolveChargerInventoryIdFromJobcardPart = (part) => {
    if (!part) return null;
    const raw =
      part.chargerInventoryId ??
      part.chargerId ??
      part.spareId ??
      part.id;
    if (raw == null || raw === "") return null;
    const id = typeof raw === "object" && raw._id != null ? raw._id : raw;
    return id ? String(id) : null;
  };

  /** Resolve Charger doc for profit cost (id first; then name + voltage for legacy rows where spareId was lost to Spare populate). */
  const findChargerDocForJobcardPart = (part) => {
    if (!part || !Array.isArray(chargers)) return null;
    const id = resolveChargerInventoryIdFromJobcardPart(part);
    if (id) {
      const byId = chargers.find((x) => String(x._id) === String(id));
      if (byId) return byId;
    }
    const name = String(part.spareName || part.chargerName || part.name || "")
      .trim()
      .toLowerCase();
    const volt = String(part.voltage || "").trim().toLowerCase();
    if (!name) return null;
    return (
      chargers.find(
        (x) =>
          String(x.name || "").trim().toLowerCase() === name &&
          String(x.voltage || "").trim().toLowerCase() === volt
      ) || null
    );
  };

  const getChargerUnitCostForJobcardPart = (part) => {
    const c = findChargerDocForJobcardPart(part);
    if (!c) return 0;
    return getChargerUnitCost(c._id);
  };

  // Jobcard profit: service + spare sales + batteries + chargers (FIFO / rules per line).
  // profit = paidAmount - sum(purchaseCost of those lines) + scrap credits
  /** Cash-equivalent credit from customer old batteries on new battery sales (scrap qty × price/unit). */
  const sumNewBatteryCustomerScrapCredit = (parts) => {
    if (!Array.isArray(parts)) return 0;
    return parts.reduce((sum, p) => {
      if (!p) return sum;
      if (String(p.partType || "").toLowerCase() !== "sales") return sum;
      if (String(p.salesType || "").toLowerCase() !== "battery") return sum;
      if (String(p.batteryOldNew || "").toLowerCase() !== "new") return sum;
      if (!p.scrapAvailable) return sum;
      const sq = Math.max(0, Number(p.scrapQuantity) || 0);
      const sp = Math.max(0, Number(p.scrapPricePerUnit) || 0);
      return sum + sq * sp;
    }, 0);
  };

  /** Old battery sale: scrap brought in — credit in profit (qty × rate; rate defaults to ₹800). */
  const sumOldBatteryScrapCredit = (parts, imputedPerUnit = 800) => {
    if (!Array.isArray(parts)) return 0;
    return parts.reduce((sum, p) => {
      if (!p) return sum;
      if (String(p.partType || "").toLowerCase() !== "sales") return sum;
      if (String(p.salesType || "").toLowerCase() !== "battery") return sum;
      if (String(p.batteryOldNew || "").toLowerCase() !== "old") return sum;
      if (!p.scrapAvailable) return sum;
      const sq = Math.max(0, Number(p.scrapQuantity) || 0);
      if (sq <= 0) return sum;
      const rate =
        Math.max(0, Number(p.scrapPricePerUnit) || 0) || imputedPerUnit;
      return sum + sq * rate;
    }, 0);
  };

  const buildJobcardServiceAndSalesProfitDetail = (jc) => {
    /** When old battery is sold without customer scrap, treat ₹800/unit as imputed scrap / cost in profit. */
    const OLD_BATTERY_IMPUTED_SCRAP_PER_UNIT = 800;
    const paidAmount = Number(jc?.paidAmount) || 0;
    const parts = Array.isArray(jc?.parts) ? jc.parts : [];
    const customerScrapCreditTotal = sumNewBatteryCustomerScrapCredit(parts);
    const oldBatteryScrapCreditTotal = sumOldBatteryScrapCredit(
      parts,
      OLD_BATTERY_IMPUTED_SCRAP_PER_UNIT
    );

    const isProfitOldBatterySaleLine = (p) => {
      if (!p) return false;
      // Custom old-battery lines (no inventory id) still use imputed scrap cost — do not exclude isCustom.
      const pt = String(p.partType || "").toLowerCase();
      const st = String(p.salesType || "").toLowerCase();
      if (pt !== "sales" || st !== "battery") return false;
      return String(p.batteryOldNew || "").toLowerCase() === "old";
    };

    const isProfitSpareLine = (p) => {
      if (!p || p.isCustom === true || !p.spareId) return false;
      const pt = String(p.partType || "").toLowerCase();
      const st = String(p.salesType || "").toLowerCase();
      if (pt === "service") return true;
      if (pt === "sales" && st === "spare") return true;
      return false;
    };

    const isProfitBatteryLine = (p) => {
      if (!p || p.isCustom === true) return false;
      const battId = resolveBatteryInventoryIdFromJobcardPart(p);
      if (!battId) return false;
      const pt = String(p.partType || "").toLowerCase();
      const st = String(p.salesType || "").toLowerCase();
      const rt = String(p.replacementType || "").toLowerCase();
      if (
        pt === "sales" &&
        st === "battery" &&
        String(p.batteryOldNew || "").toLowerCase() === "new"
      ) {
        return true;
      }
      if (pt === "replacement" && rt === "battery") return true;
      return false;
    };

    /** New charger from stock: profit deducts purchase (latest stock entry / FIFO on part). */
    const isProfitNewChargerSaleLine = (p) => {
      if (!p) return false;
      const pt = String(p.partType || "").toLowerCase();
      const st = String(p.salesType || "").toLowerCase();
      if (pt !== "sales" || st !== "charger") return false;
      return String(p.chargerOldNew || "").toLowerCase() !== "old";
    };

    /** Old charger sale (custom / old stock): no purchase cost in profit — revenue counts fully. */
    const isProfitOldChargerSaleLine = (p) => {
      if (!p) return false;
      const pt = String(p.partType || "").toLowerCase();
      const st = String(p.salesType || "").toLowerCase();
      if (pt !== "sales" || st !== "charger") return false;
      return String(p.chargerOldNew || "").toLowerCase() === "old";
    };

    /** Old scooty sale — COGS from master purchase, battery scrap rules, new battery/charger stock, nested spares. */
    const isProfitOldScootySaleLine = (p) => {
      if (!p) return false;
      const pt = String(p.partType || "").toLowerCase();
      const st = String(p.salesType || "").toLowerCase();
      return pt === "sales" && st === "oldscooty";
    };

    const normalizePmcKeyForOldScooty = (v) =>
      String(v || "")
        .trim()
        .toLowerCase()
        .replace(/^pmc-?/i, "")
        .replace(/\s+/g, "");

    const findConsumedOldScootySnapshot = (jobcard, part) => {
      const rows = Array.isArray(jobcard?.consumedOldScooties)
        ? jobcard.consumedOldScooties
        : [];
      const key = normalizePmcKeyForOldScooty(part?.pmcNo);
      if (!key) return null;
      return (
        rows.find((s) => normalizePmcKeyForOldScooty(s?.pmcNo) === key) || null
      );
    };

    const oldScootySoldBatteryCellCount = (p) => {
      const chem = String(p?.batteryChemistry || "").toLowerCase();
      if (chem === "lithium") return 1;
      const v = String(p?.batteryVoltage || "").trim();
      if (v.includes("72")) return 6;
      if (v.includes("60")) return 5;
      if (v.includes("48")) return 4;
      return 0;
    };

    const OLD_SCOOTY_IMPUTED_SCRAP_PER_BATTERY = 800;

    const computeOldScootyPurchaseCostForProfit = (p, snap) => {
      const masterPurchase = snap ? Number(snap.purchasePrice) || 0 : 0;
      const cameWith = snap?.withBattery
        ? Math.max(0, Number(snap.batteryCount) || 0)
        : 0;
      const soldCells = oldScootySoldBatteryCellCount(p);
      const bt = String(p?.batteryType || "").toLowerCase();
      const scrap = OLD_SCOOTY_IMPUTED_SCRAP_PER_BATTERY;

      let batteryRelated = 0;
      if (bt === "oldbattery") {
        // Rule: purchasePrice - ₹800*(batteries that came with scooty entry) + ₹800*(batteries used in this jobcard sale)
        batteryRelated = masterPurchase - scrap * cameWith + scrap * soldCells;
      } else if (bt === "newbattery") {
        const storedBatteryFifo = Number(p.oldScootyBatteryFifoCost) || 0;
        let newBattPurchase = storedBatteryFifo;
        if (newBattPurchase <= 0) {
          const battId = resolveBatteryInventoryIdFromJobcardPart(p);
          if (battId && soldCells > 0) {
            const unit = getBatteryUnitCost(battId);
            newBattPurchase = soldCells * unit;
          }
        }
        // Still subtract the old batteries that originally came with the old-scooty entry (imputed ₹800 each).
        batteryRelated = masterPurchase - scrap * cameWith + newBattPurchase;
      } else {
        batteryRelated = masterPurchase - scrap * cameWith;
      }

      let chargerPurchase = 0;
      const ct = String(p?.chargerType || "").toLowerCase();
      if (ct === "newcharger") {
        const storedChargerFifo = Number(p.oldScootyChargerFifoCost) || 0;
        chargerPurchase =
          storedChargerFifo > 0
            ? storedChargerFifo
            : getChargerUnitCostForJobcardPart(p);
      }

      let nestedSparesPurchase = 0;
      const su = Array.isArray(p?.sparesUsed) ? p.sparesUsed : [];
      for (const s of su) {
        if (!s || s.fromOldScooty) continue;
        const sid = s.spareId?._id || s.spareId;
        if (!sid) continue;
        const q = Math.max(1, Number(s.quantity) || 1);
        nestedSparesPurchase += q * getSpareUnitCost(sid);
      }

      return Math.max(
        0,
        batteryRelated + chargerPurchase + nestedSparesPurchase
      );
    };

    const profitParts = parts.filter(
      (p) =>
        isProfitSpareLine(p) ||
        isProfitBatteryLine(p) ||
        isProfitOldBatterySaleLine(p) ||
        isProfitNewChargerSaleLine(p) ||
        isProfitOldChargerSaleLine(p) ||
        isProfitOldScootySaleLine(p)
    );

    const lines = profitParts
      .map((p) => {
        if (isProfitOldScootySaleLine(p)) {
          const qty =
            Number(
              p.selectedQuantity !== undefined && p.selectedQuantity !== null
                ? p.selectedQuantity
                : p.quantity
            ) || 1;
          const snap = findConsumedOldScootySnapshot(jc, p);
          const lineCost = computeOldScootyPurchaseCostForProfit(p, snap);
          const baseName =
            String(p.spareName || p.name || "Old scooty").trim() ||
            "Old scooty";
          const pmcRaw = String(p.pmcNo || "").trim();
          const pmcDisplay = pmcRaw
            ? `PMC-${pmcRaw.replace(/^PMC-?/i, "")}`
            : "";
          const name = pmcDisplay ? `${baseName} (${pmcDisplay})` : baseName;
          return {
            name,
            kind: "old-scooty-sale",
            kindDisplay: "old scooty sale",
            quantity: qty,
            unitCost: qty > 0 ? lineCost / qty : lineCost,
            lineCost,
          };
        }
        if (isProfitOldBatterySaleLine(p)) {
          const qty =
            Number(
              p.selectedQuantity !== undefined && p.selectedQuantity !== null
                ? p.selectedQuantity
                : p.quantity
            ) || 0;
          const lineCost = qty * OLD_BATTERY_IMPUTED_SCRAP_PER_UNIT;
          const unitCost = qty > 0 ? lineCost / qty : 0;
          const baseName =
            String(p.spareName || p.batteryName || "Battery").trim() ||
            "Battery";
          return {
            name: baseName,
            kind: "battery-old-sale",
            kindDisplay: "old battery sale",
            quantity: qty,
            unitCost,
            lineCost,
          };
        }
        if (isProfitOldChargerSaleLine(p)) {
          const qty =
            Number(
              p.selectedQuantity !== undefined && p.selectedQuantity !== null
                ? p.selectedQuantity
                : p.quantity
            ) || 0;
          const baseName =
            String(
              p.spareName || p.chargerName || p.name || "Charger"
            ).trim() || "Charger";
          return {
            name: baseName,
            kind: "charger-old-sale",
            kindDisplay: "old charger sale",
            quantity: qty,
            unitCost: 0,
            lineCost: 0,
          };
        }
        if (isProfitNewChargerSaleLine(p)) {
          const qty =
            Number(
              p.selectedQuantity !== undefined && p.selectedQuantity !== null
                ? p.selectedQuantity
                : p.quantity
            ) || 0;
          const storedFifo = Number(p.fifoLinePurchaseCost) || 0;
          let unitCost;
          let lineCost;
          if (storedFifo > 0) {
            lineCost = storedFifo;
            unitCost = qty > 0 ? storedFifo / qty : 0;
          } else {
            unitCost = getChargerUnitCostForJobcardPart(p);
            lineCost = qty * unitCost;
          }
          const baseName =
            String(
              p.spareName || p.chargerName || p.name || "Charger"
            ).trim() || "Charger";
          return {
            name: baseName,
            kind: "charger-new-sale",
            kindDisplay: "new charger sale",
            quantity: qty,
            unitCost,
            lineCost,
          };
        }
        if (isProfitBatteryLine(p)) {
          const qty =
            Number(
              p.selectedQuantity !== undefined && p.selectedQuantity !== null
                ? p.selectedQuantity
                : p.quantity
            ) || 0;
          const battId = resolveBatteryInventoryIdFromJobcardPart(p);
          const storedFifo = Number(p.fifoLinePurchaseCost) || 0;
          let unitCost;
          let lineCost;
          if (storedFifo > 0) {
            lineCost = storedFifo;
            unitCost = qty > 0 ? storedFifo / qty : 0;
          } else {
            unitCost = getBatteryUnitCost(battId);
            lineCost = qty * unitCost;
          }
          const pt = String(p.partType || "").toLowerCase();
          const isSale = pt === "sales";
          const kind = isSale ? "battery-sale" : "battery-replacement";
          const kindDisplay = isSale ? "battery sale" : "battery replacement";
          const baseName =
            String(p.spareName || p.batteryName || "Battery").trim() ||
            "Battery";
          return {
            name: baseName,
            kind,
            kindDisplay,
            quantity: qty,
            unitCost,
            lineCost,
          };
        }

        const qty = Number(p.quantity) || 0;
        const spareId = p.spareId?._id || p.spareId;
        const storedFifo = Number(p.fifoLinePurchaseCost) || 0;
        let unitCost;
        let lineCost;
        if (storedFifo > 0) {
          lineCost = storedFifo;
          unitCost = qty > 0 ? storedFifo / qty : 0;
        } else {
          unitCost = getSpareUnitCost(spareId);
          lineCost = qty * unitCost;
        }
        const pt = String(p.partType || "").toLowerCase();
        const kind = pt === "sales" ? "sales" : "service";
        const kindDisplay = kind;
        const baseName = String(p.spareName || "").trim() || "N/A";
        const color = String(p.selectedColor || "").trim();
        const name = color ? `${baseName} (${color})` : baseName;
        return {
          name,
          kind,
          kindDisplay,
          quantity: qty,
          unitCost,
          lineCost,
        };
      })
      .filter((l) => l.quantity > 0);

    const thingBuckets = { service: [], replacement: [], sales: [] };
    for (const p of parts) {
      if (!p) continue;
      const qty = Number(p.quantity) || 0;
      if (qty <= 0) continue;
      const cat = classifyJobcardThingCategory(p);
      thingBuckets[cat].push({
        name: formatJobcardThingLabel(p),
        quantity: qty,
      });
    }
    const serviceThingSummaries = aggregateThingQtyByLabel(thingBuckets.service);
    const replacementThingSummaries = aggregateThingQtyByLabel(
      thingBuckets.replacement
    );
    const salesThingSummaries = aggregateThingQtyByLabel(thingBuckets.sales);

    const totalCost = lines.reduce((sum, l) => sum + (l.lineCost || 0), 0);
    const serviceSpareCost = lines
      .filter((l) => l.kind === "service")
      .reduce((sum, l) => sum + (l.lineCost || 0), 0);
    const salesSpareCost = lines
      .filter((l) => l.kind === "sales")
      .reduce((sum, l) => sum + (l.lineCost || 0), 0);
    const batteryInventoryCost = lines
      .filter(
        (l) =>
          l.kind === "battery-sale" || l.kind === "battery-replacement"
      )
      .reduce((sum, l) => sum + (l.lineCost || 0), 0);
    /** FIFO totals aligned with jobcard sections: Service / Sales / Replacement */
    const fifoCostServiceSection = serviceSpareCost;
    const fifoCostSalesSection = lines
      .filter(
        (l) =>
          l.kind === "sales" ||
          l.kind === "battery-sale" ||
          l.kind === "battery-old-sale" ||
          l.kind === "charger-new-sale" ||
          l.kind === "charger-old-sale" ||
          l.kind === "old-scooty-sale"
      )
      .reduce((sum, l) => sum + (l.lineCost || 0), 0);
    const fifoCostReplacementSection = lines
      .filter((l) => l.kind === "battery-replacement")
      .reduce((sum, l) => sum + (l.lineCost || 0), 0);
    // New battery: paid net of scrap discount — add new-battery scrap credit back.
    // Old battery: always include imputed ₹800/unit in totalCost; add old-battery scrap credit when customer supplies scrap.
    const profit =
      paidAmount -
      totalCost +
      customerScrapCreditTotal +
      oldBatteryScrapCreditTotal;

    /** Lines included in profit math but with ₹0 cost (no FIFO on part + no unit cost from stock). */
    const missingPurchaseCostLabels = lines
      .filter(
        (l) =>
          l.quantity > 0 &&
          (Number(l.lineCost) || 0) <= 0 &&
          l.kind !== "battery-old-sale" &&
          l.kind !== "charger-old-sale"
      )
      .map((l) =>
        l.quantity > 1
          ? `${l.name} (${l.kindDisplay}, ×${l.quantity})`
          : `${l.name} (${l.kindDisplay})`
      );

    return {
      id: jc?._id,
      jobcardNumber: jc?.jobcardNumber || "N/A",
      date: jc?.date || "",
      customerName: jc?.customerName || "N/A",
      paidAmount,
      lines,
      totalCost,
      serviceSpareCost,
      salesSpareCost,
      batteryInventoryCost,
      customerScrapCreditTotal,
      oldBatteryScrapCreditTotal,
      profit,
      missingPurchaseCostLabels,
      serviceThingSummaries,
      replacementThingSummaries,
      salesThingSummaries,
      fifoCostServiceSection,
      fifoCostSalesSection,
      fifoCostReplacementSection,
    };
  };

  const buildBillProfitDetail = (bill) => {
    const netBillAmount = billNetAmount(bill);
    const customerPaidAmount = billCashPaid(bill);
    let totalCostTally = 0;

    // Bill profit: customer paid (net) − new-vehicle cost + old-scooty trade-in value (when present).
    // New-vehicle cost = adjusted model purchase + accessories; adjustment ₹2000 × battery unit diff (lead).
    const modelDoc = findInventoryModelForBill(bill);
    const baseModelCost = getModelPurchaseUnitCostFromDoc(modelDoc);
    const purchasedBatteryUnits = modelDoc
      ? Number(modelDoc.batteriesPerSet) || 0
      : 0;
    const batteryType = String(bill?.batteryTypeForBill || "").toLowerCase();
    const batteryV = String(bill?.batteryVoltageForBill || "").trim();
    const soldBatteryUnits =
      bill?.withBattery && batteryType === "lead"
        ? batteryV.includes("72")
          ? 6
          : batteryV.includes("60")
          ? 5
          : batteryV.includes("48")
          ? 4
          : 0
        : null;

    const parts = [];
    if (!bill?.withBattery) {
      parts.push("No battery on bill");
    } else {
      if (soldBatteryUnits != null && soldBatteryUnits > 0) {
        parts.push(`${soldBatteryUnits} with sale`);
      }
      if (purchasedBatteryUnits > 0) {
        parts.push(`${purchasedBatteryUnits} in model catalog set`);
      }
      if (batteryV) parts.push(batteryV);
      if (batteryType === "lithium") parts.push("lithium");
      else if (batteryType === "lead") parts.push("lead");
      if (parts.length === 0) parts.push("Battery on bill");
    }
    const batteryQtyLine = parts.join(" · ");

    const modelBatteryAdjustment =
      soldBatteryUnits != null &&
      purchasedBatteryUnits > 0 &&
      soldBatteryUnits > 0
        ? (soldBatteryUnits - purchasedBatteryUnits) * 2000
        : 0;
    const modelCost = (Number(baseModelCost) || 0) + modelBatteryAdjustment;
    totalCostTally += modelCost;

    const accessoryLines = [];
    if (Array.isArray(bill?.accessoryDetails) && bill.accessoryDetails.length > 0) {
      bill.accessoryDetails.forEach((a) => {
        const stored = Number(a?.unitPurchaseCost) || 0;
        const lineCost = stored > 0 ? stored : getSpareUnitCost(a?.id) * 1;
        accessoryLines.push({
          label: a?.name || "Accessory",
          cost: lineCost,
        });
        totalCostTally += lineCost;
      });
    }

    const totalCost = totalCostTally;

    const osId = String(bill?.oldScootyId || "").trim();
    const osDoc =
      osId && Array.isArray(oldScooties)
        ? oldScooties.find((x) => String(x._id) === osId)
        : null;
    const exchangePrice = Number(bill?.oldScootyExchangePrice) || 0;
    const exchangeText = String(bill?.oldScootyExchange || "").trim();
    const pmcFromBill = String(bill?.oldScootyPmcNo || "").trim();
    const hasOldScootyFinance =
      exchangeText.length > 0 || exchangePrice > 0 || Boolean(osDoc);

    const invName = osDoc ? String(osDoc.name || "").trim() : "";
    const genericInvName = /^old scooty exchange$/i.test(invName);
    const modelFromInventory = invName && !genericInvName ? invName : "";
    const modelLabel =
      modelFromInventory ||
      (hasOldScootyFinance ? "Trade-in scooty" : "");
    const purchaseRecorded =
      osDoc != null
        ? Number(osDoc.purchasePrice) || exchangePrice
        : exchangePrice;
    const pmcDisplay =
      pmcFromBill || (osDoc ? String(osDoc.pmcNo || "").trim() : "");
    const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
    const specNotes =
      exchangeText && norm(exchangeText) !== norm(modelFromInventory)
        ? exchangeText
        : "";

    const oldScootyBlock = hasOldScootyFinance
      ? {
          modelLabel: modelLabel || "—",
          purchasePrice: purchaseRecorded,
          exchangePrice,
          pmcNo: pmcDisplay,
          specNotes,
        }
      : null;

    // Profit: customer paid (net) − inventory cost of new sale + recorded old-scooty trade-in value
    const tradeInCreditAmount = hasOldScootyFinance
      ? Number(purchaseRecorded) || 0
      : 0;
    const profit = customerPaidAmount - totalCost + tradeInCreditAmount;

    return {
      id: bill?._id,
      billNo: bill?.billNo || "N/A",
      billDate: bill?.billDate || "",
      customerName: bill?.customerName || "N/A",
      /** Cash paid — used for display, profit, and period totals */
      revenue: customerPaidAmount,
      netBillAmount,
      modelName: bill?.modelPurchased || "—",
      modelDescription: String(bill?.descriptionVariant || "").trim(),
      modelColor: String(bill?.modelColor || "").trim(),
      batteryQtyLine,
      accessoryLines,
      oldScooty: oldScootyBlock,
      totalCost,
      tradeInCreditAmount,
      profit,
    };
  };

  const financeTotals = useMemo(() => {
    const billsForDay = (Array.isArray(bills) ? bills : []).filter((b) =>
      isSameDay(b?.billDate, effectiveYmd)
    );
    const billsForMonth = (Array.isArray(bills) ? bills : []).filter((b) =>
      isSameMonth(b?.billDate, effectiveMonth)
    );
    const jobcardsForDay = (Array.isArray(jobcards) ? jobcards : []).filter((j) =>
      isSameDay(j?.date, effectiveYmd)
    );
    const jobcardsForMonth = (Array.isArray(jobcards) ? jobcards : []).filter((j) =>
      isSameMonth(j?.date, effectiveMonth)
    );

    const billDetailsDay = billsForDay.map(buildBillProfitDetail);
    const billDetailsMonth = billsForMonth.map(buildBillProfitDetail);
    const jobcardDetailsDay = jobcardsForDay.map(
      buildJobcardServiceAndSalesProfitDetail
    );
    const jobcardDetailsMonth = jobcardsForMonth.map(
      buildJobcardServiceAndSalesProfitDetail
    );

    const sumProfit = (list) => list.reduce((sum, x) => sum + (Number(x.profit) || 0), 0);
    const sumRevenue = (list) => list.reduce((sum, x) => sum + (Number(x.revenue) || 0), 0);
    const sumPaid = (list) => list.reduce((sum, x) => sum + (Number(x.paidAmount) || 0), 0);

    return {
      bill: {
        day: {
          revenue: sumRevenue(billDetailsDay),
          profit: sumProfit(billDetailsDay),
          details: billDetailsDay,
        },
        month: {
          revenue: sumRevenue(billDetailsMonth),
          profit: sumProfit(billDetailsMonth),
          details: billDetailsMonth,
        },
      },
      jobcard: {
        day: {
          paid: sumPaid(jobcardDetailsDay),
          profit: sumProfit(jobcardDetailsDay),
          details: jobcardDetailsDay,
        },
        month: {
          paid: sumPaid(jobcardDetailsMonth),
          profit: sumProfit(jobcardDetailsMonth),
          details: jobcardDetailsMonth,
        },
      },
    };
  }, [
    bills,
    jobcards,
    spares,
    models,
    batteries,
    chargers,
    oldScooties,
    financeRangeMode,
    financeSelectedDate,
    financeSelectedMonth,
  ]);

  // Total inventory value across all batteries:
  // For each stock entry: (purchasePricePerSet / batteriesPerSet) * entry.quantity
  const totalBatteriesValue = useMemo(() => {
    if (!Array.isArray(batteries) || batteries.length === 0) return 0;

    const getPerSetForEntry = (battery, entry) => {
      const entryPerSet =
        entry?.batteriesPerSet !== undefined && entry?.batteriesPerSet !== null
          ? Number(entry.batteriesPerSet)
          : Number(battery?.batteriesPerSet);
      return Number.isFinite(entryPerSet) ? entryPerSet : 0;
    };

    return batteries.reduce((sum, battery) => {
      if (!battery) return sum;
      const entries = Array.isArray(battery.stockEntries)
        ? battery.stockEntries
        : [];
      if (entries.length === 0) return sum;

      const valueFromEntries = entries.reduce((subSum, entry) => {
        const qty = Number(entry?.quantity) || 0; // total batteries (pieces) in this entry
        const pricePerSet = Number(entry?.purchasePrice) || 0; // purchase price per set
        const perSet = getPerSetForEntry(battery, entry);
        const perBatteryPrice = perSet > 0 ? pricePerSet / perSet : pricePerSet;
        return subSum + qty * perBatteryPrice;
      }, 0);

      return sum + valueFromEntries;
    }, 0);
  }, [batteries]);

  const sidebarItems = [
    { id: "spares", name: "Spares", icon: FaTools, color: "#007bff" },
    {
      id: "batteries",
      name: "Batteries",
      icon: FaBatteryFull,
      color: "#28a745",
    },
    { id: "models", name: "Models", icon: FaMotorcycle, color: "#ffc107" },
    { id: "finance", name: "Finance", icon: FaMoneyBillWave, color: "#dc3545" },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "spares":
        return (
          <div className="admin-content">
            <h2>Spares Management</h2>

            {/* Summary cards */}
            <div className="admin-cards">
              <div className="admin-card">
                <h3>Total Spares</h3>
                <p className="card-number">
                  {sparesLoading ? "…" : totalSpares}
                </p>
                <small>Unique spare items</small>
              </div>
              <div className="admin-card">
                <h3>Low Stock</h3>
                <p
                  className="card-number"
                  style={{ color: lowStockCount > 0 ? "#dc2626" : "#16a34a" }}
                >
                  {sparesLoading ? "…" : lowStockCount}
                </p>
                <small>Items below minimum stock level</small>
              </div>
              <div className="admin-card">
                <h3>Total Value</h3>
                <p className="card-number">
                  ₹{sparesLoading ? "…" : totalSparesValue.toLocaleString()}
                </p>
                <small>Quantity × purchase price</small>
              </div>
            </div>

            {/* Actions */}
            <div className="admin-actions" style={{ marginBottom: "1.5rem" }}>
              <button
                className="btn btn-primary"
                onClick={() => handleNavigateOutsideAdmin("/spares/add")}
              >
                Add New Spare
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleNavigateOutsideAdmin("/spares/all")}
              >
                View All Spares
              </button>
              <button
                className="btn btn-info"
                onClick={() => setShowLowStockModal(true)}
                disabled={sparesLoading}
              >
                Low Stock Report
              </button>
            </div>

            {/* Error / loading state */}
            {sparesLoading && (
              <div
                style={{
                  padding: "1rem 0",
                  color: "#6b7280",
                  fontSize: "0.9rem",
                }}
              >
                Loading spares data…
              </div>
            )}
            {sparesError && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#fef2f2",
                  color: "#b91c1c",
                  fontSize: "0.875rem",
                }}
              >
                {sparesError}
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: "0.75rem", padding: "0.25rem 0.75rem" }}
                  onClick={fetchSparesForAdmin}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Low Stock Report Modal */}
            {showLowStockModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(15, 23, 42, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 50,
                }}
                onClick={() => setShowLowStockModal(false)}
              >
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "0.75rem",
                    maxWidth: "1100px",
                    width: "95%",
                    maxHeight: "80vh",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow:
                      "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: "1rem 1.5rem",
                      borderBottom: "1px solid #e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "1.125rem",
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        Low Stock Report
                      </h3>
                      <p
                        style={{
                          margin: "0.25rem 0 0 0",
                          fontSize: "0.875rem",
                          color: "#6b7280",
                        }}
                      >
                        Showing spares where quantity is below minimum stock
                        level.
                      </p>
                    </div>
                    <button
                      className="btn"
                      style={{
                        backgroundColor: "#ef4444",
                        color: "white",
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.875rem",
                      }}
                      onClick={() => setShowLowStockModal(false)}
                    >
                      Close
                    </button>
                  </div>

                  <div style={{ padding: "1rem 1.5rem", overflow: "auto" }}>
                    {lowStockItems.length === 0 ? (
                      <div
                        style={{
                          padding: "2rem",
                          textAlign: "center",
                          color: "#6b7280",
                          fontSize: "0.95rem",
                        }}
                      >
                        No items are currently below their minimum stock level.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "0.85rem",
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                backgroundColor: "#f9fafb",
                                borderBottom: "1px solid #e5e7eb",
                              }}
                            >
                              {[
                                "Spare Name",
                                "Supplier",
                                "Models",
                                "Color (Low Stock)",
                                "Current Quantity",
                                "Min Stock Level",
                                "Selling Price",
                                "Last Purchase Date",
                                "Status",
                              ].map((header) => (
                                <th
                                  key={header}
                                  style={{
                                    padding: "0.75rem 0.75rem",
                                    textAlign: "left",
                                    fontWeight: 600,
                                    color: "#374151",
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    borderRight: "1px solid #e5e7eb",
                                  }}
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {lowStockItems.map((item) => (
                              <tr
                                key={item.id}
                                style={{
                                  borderBottom: "1px solid #f3f4f6",
                                  backgroundColor: "white",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    fontWeight: 600,
                                    color: "#111827",
                                  }}
                                >
                                  {item.name}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#4b5563",
                                  }}
                                >
                                  {item.supplierName}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#4b5563",
                                  }}
                                >
                                  {item.models}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#b91c1c",
                                    fontWeight: 500,
                                  }}
                                >
                                  {item.colorDisplay}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#b91c1c",
                                    fontWeight: 600,
                                  }}
                                >
                                  {item.currentQuantity}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#4b5563",
                                  }}
                                >
                                  {item.minStockDisplay}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#111827",
                                    fontWeight: 600,
                                  }}
                                >
                                  ₹{item.sellingPrice.toFixed(2)}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#4b5563",
                                  }}
                                >
                                  {item.lastPurchaseDate}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#b91c1c",
                                    fontWeight: 600,
                                  }}
                                >
                                  {item.status}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case "batteries":
        return (
          <div className="admin-content">
            <h2>Batteries Management</h2>
            <div className="admin-cards">
              <div className="admin-card">
                <h3>Battery Varieties</h3>
                <p className="card-number">
                  {batteriesLoading ? "…" : totalBatteryVarieties}
                </p>
                <small>Unique battery types</small>
              </div>
              <div className="admin-card">
                <h3>Total Sets Available</h3>
                <p className="card-number">
                  {batteriesLoading ? "…" : totalBatterySetsAvailable}
                </p>
                <small>Total sets in stock</small>
              </div>
              <div className="admin-card">
                <h3>Total Value</h3>
                <p className="card-number">
                  ₹
                  {batteriesLoading
                    ? "…"
                    : totalBatteriesValue.toLocaleString("en-IN")}
                </p>
                <small title="Calculated from battery stock entries using per-battery cost derived from each entry’s purchase price and batteries-per-set.">
                  Inventory value (stock entries)
                </small>
              </div>
            </div>
            {batteriesError && (
              <div style={{ color: "#dc2626", margin: "0.75rem 0" }}>
                {batteriesError}
              </div>
            )}
            <div className="admin-actions" style={{ marginBottom: "1.5rem" }}>
              <button
                className="btn btn-primary"
                onClick={() => handleNavigateOutsideAdmin("/batteries")}
              >
                Add New Battery
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleNavigateOutsideAdmin("/batteries")}
              >
                View All Batteries
              </button>
              <button
                className="btn btn-info"
                onClick={() => setShowBatteryLowStockModal(true)}
                disabled={batteriesLoading}
              >
                Low Stock Report{" "}
                {!batteriesLoading && batteryLowStockCount > 0
                  ? `(${batteryLowStockCount})`
                  : ""}
              </button>
            </div>

            {/* Battery Low Stock Report Modal */}
            {showBatteryLowStockModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(15, 23, 42, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 50,
                }}
                onClick={() => setShowBatteryLowStockModal(false)}
              >
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "0.75rem",
                    maxWidth: "1000px",
                    width: "95%",
                    maxHeight: "80vh",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow:
                      "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: "1rem 1.5rem",
                      borderBottom: "1px solid #e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "1.125rem",
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        Low Stock Report
                      </h3>
                      <p
                        style={{
                          margin: "0.25rem 0 0 0",
                          fontSize: "0.875rem",
                          color: "#6b7280",
                        }}
                      >
                        Showing batteries where sets are below minimum stock level.
                      </p>
                    </div>
                    <button
                      className="btn"
                      style={{
                        backgroundColor: "#ef4444",
                        color: "white",
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.875rem",
                      }}
                      onClick={() => setShowBatteryLowStockModal(false)}
                    >
                      Close
                    </button>
                  </div>

                  <div style={{ padding: "1rem 1.5rem", overflow: "auto" }}>
                    {batteryLowStockItems.length === 0 ? (
                      <div
                        style={{
                          padding: "2rem",
                          textAlign: "center",
                          color: "#6b7280",
                          fontSize: "0.95rem",
                        }}
                      >
                        No batteries are currently below their minimum stock level.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "0.85rem",
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                backgroundColor: "#f9fafb",
                                borderBottom: "1px solid #e5e7eb",
                              }}
                            >
                              {[
                                "Battery Name",
                                "Type",
                                "Ampere",
                                "Supplier",
                                "Current Sets",
                                "Min Sets",
                                "Last Purchase Date",
                              ].map((header) => (
                                <th
                                  key={header}
                                  style={{
                                    padding: "0.75rem 0.75rem",
                                    textAlign: "left",
                                    fontWeight: 600,
                                    color: "#374151",
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    borderRight: "1px solid #e5e7eb",
                                  }}
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {batteryLowStockItems.map((item) => (
                              <tr
                                key={item.id}
                                style={{
                                  borderBottom: "1px solid #f3f4f6",
                                  backgroundColor: "white",
                                }}
                              >
                                <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                                  {item.name}
                                </td>
                                <td style={{ padding: "0.75rem" }}>
                                  {item.batteryType}
                                </td>
                                <td style={{ padding: "0.75rem" }}>
                                  {item.ampereValue}
                                </td>
                                <td style={{ padding: "0.75rem" }}>
                                  {item.supplierName}
                                </td>
                                <td
                                  style={{
                                    padding: "0.75rem",
                                    color: "#b91c1c",
                                    fontWeight: 600,
                                  }}
                                >
                                  {item.currentSets}
                                </td>
                                <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                                  {item.minSets}
                                </td>
                                <td style={{ padding: "0.75rem" }}>
                                  {item.lastPurchaseDate}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case "models": {
        console.log("Rendering models section, models data:", models);
        const groupedModels = getModelsGroupedByNameAndCompany();
        const modelsTotalValue = groupedModels.reduce(
          (acc, group) => acc + (group.totalValue || 0),
          0
        );
        const hasMissingPrice = groupedModels.some(
          (group) => group.hasMissingPrice
        );

        return (
          <div className="admin-content">
            <h2>Models Management</h2>
            <div className="admin-cards">
              <div className="admin-card">
                <h3>Total Models</h3>
                <p className="card-number">{groupedModels.length}</p>
                <small>All vehicle models</small>
              </div>
              <div className="admin-card">
                <h3>Total Quantity</h3>
                <p className="card-number">
                  {groupedModels.reduce(
                    (sum, group) => sum + (group.totalQuantity || 0),
                    0
                  )}
                </p>
                <small>All vehicles in stock</small>
              </div>
              <div className="admin-card">
                <h3>Total Value</h3>
                <p className="card-number">
                  ₹{modelsTotalValue.toLocaleString("en-IN")}
                </p>
                <small>
                  {hasMissingPrice
                    ? "⚠️ Some stock entries are missing purchase price. Enter prices for best accuracy."
                    : "Inventory value (all stock entries up to date)."}
                </small>
              </div>
            </div>

            {/* Search and Filter Section */}
            <div
              className="admin-search-section"
              style={{
                background: "white",
                padding: "1.5rem",
                borderRadius: "8px",
                marginBottom: "2rem",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <h3 style={{ margin: "0 0 1rem 0", color: "#333" }}>
                Search & Filter Models
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                  gap: "1rem",
                  alignItems: "end",
                }}
              >
                {/* Search Input */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                      color: "#495057",
                    }}
                  >
                    Search Models:
                  </label>
                  <input
                    type="text"
                    placeholder="Search by name, company, or colour..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>

                {/* Company Filter */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                      color: "#495057",
                    }}
                  >
                    Company:
                  </label>
                  <select
                    value={filterCompany}
                    onChange={(e) => setFilterCompany(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                    }}
                  >
                    <option value="all">All Companies</option>
                    {companies.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stock Filter */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                      color: "#495057",
                    }}
                  >
                    Stock Status:
                  </label>
                  <select
                    value={filterStock}
                    onChange={(e) => setFilterStock(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                    }}
                  >
                    <option value="all">All Stock</option>
                    <option value="instock">In Stock</option>
                    <option value="outofstock">Out of Stock</option>
                  </select>
                </div>

                {/* Sort Options */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                      color: "#495057",
                    }}
                  >
                    Sort By:
                  </label>
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split("-");
                      setSortBy(field);
                      setSortOrder(order);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                    }}
                  >
                    <option value="sellingPrice-asc">
                      Price (Low to High)
                    </option>
                    <option value="sellingPrice-desc">
                      Price (High to Low)
                    </option>
                  </select>
                </div>
              </div>

              {/* Results Summary */}
              <div
                style={{
                  marginTop: "1rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #dee2e6",
                }}
              >
                <span style={{ color: "#6c757d", fontSize: "0.9rem" }}>
                  Showing {groupedModels.length} model groups ({models.length}{" "}
                  total models)
                  {searchTerm && ` for "${searchTerm}"`}
                  {filterCompany !== "all" && ` in ${filterCompany}`}
                  {filterStock !== "all" &&
                    ` (${
                      filterStock === "instock" ? "in stock" : "out of stock"
                    })`}
                </span>
              </div>
            </div>

            {/* Models Table */}
            <div className="admin-table-container">
              <h3>Models Results (Grouped by Name & Company)</h3>
              {modelsLoading ? (
                <div style={{ padding: "2rem", textAlign: "center" }}>
                  <p>Loading models...</p>
                </div>
              ) : modelsError ? (
                <div
                  style={{
                    padding: "1rem",
                    color: "#dc3545",
                    backgroundColor: "#f8d7da",
                    borderRadius: "4px",
                    marginBottom: "1rem",
                  }}
                >
                  <strong>Error:</strong> {modelsError}
                  <button
                    className="btn btn-primary"
                    onClick={fetchModels}
                    style={{ marginLeft: "1rem" }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    background: "white",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div
                    style={{
                      padding: "1.5rem",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <h3
                      style={{
                        margin: "0",
                        color: "#111827",
                        fontSize: "1.125rem",
                        fontWeight: "600",
                      }}
                    >
                      Models Inventory
                    </h3>
                    <p
                      style={{
                        margin: "0.5rem 0 0 0",
                        color: "#6b7280",
                        fontSize: "0.875rem",
                      }}
                    >
                      Grouped by model name and company with color variants
                    </p>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.875rem",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "#f9fafb",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                              borderRight: "1px solid #e5e7eb",
                            }}
                            onClick={() => handleSort("modelName")}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#f3f4f6")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "#f9fafb")
                            }
                          >
                            Model Name{" "}
                            {sortBy === "modelName" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </th>
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                              borderRight: "1px solid #e5e7eb",
                            }}
                            onClick={() => handleSort("company")}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#f3f4f6")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "#f9fafb")
                            }
                          >
                            Company{" "}
                            {sortBy === "company" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </th>
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              borderRight: "1px solid #e5e7eb",
                              width: "15%",
                            }}
                          >
                            Colors
                          </th>
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                              borderRight: "1px solid #e5e7eb",
                            }}
                            onClick={() => handleSort("quantity")}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#f3f4f6")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "transparent")
                            }
                          >
                            Quantity{" "}
                            {sortBy === "quantity" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </th>
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                              borderRight: "1px solid #e5e7eb",
                            }}
                            onClick={() => handleSort("sellingPrice")}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#f3f4f6")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "#f9fafb")
                            }
                          >
                            Selling Price{" "}
                            {sortBy === "sellingPrice" &&
                              (sortOrder === "asc" ? "↑" : "↓")}
                          </th>
                          {/* Unit Price, Total Value, and Warranty columns removed as requested */}
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              borderRight: "1px solid #e5e7eb",
                            }}
                          >
                            Stock Status
                          </th>
                          <th
                            style={{
                              padding: "1rem 1.5rem",
                              textAlign: "left",
                              fontWeight: "600",
                              color: "#374151",
                              fontSize: "0.75rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              borderRight: "1px solid #e5e7eb",
                            }}
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedModels.length === 0 ? (
                          <tr>
                            <td
                              colSpan="7"
                              style={{
                                padding: "4rem 2rem",
                                textAlign: "center",
                                color: "#6b7280",
                                fontSize: "1rem",
                                backgroundColor: "#fafafa",
                              }}
                            >
                              <div
                                style={{
                                  marginBottom: "1rem",
                                  fontSize: "2rem",
                                }}
                              >
                                📦
                              </div>
                              <div
                                style={{
                                  marginBottom: "0.5rem",
                                  fontWeight: "600",
                                  fontSize: "1.125rem",
                                  color: "#374151",
                                }}
                              >
                                {searchTerm ||
                                filterCompany !== "all" ||
                                filterStock !== "all"
                                  ? "No models found matching your criteria"
                                  : "No models available"}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.875rem",
                                  color: "#9ca3af",
                                }}
                              >
                                {searchTerm ||
                                filterCompany !== "all" ||
                                filterStock !== "all"
                                  ? "Try adjusting your search or filters"
                                  : "Add your first model to get started"}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          groupedModels.map((group, index) => (
                            <tr
                              key={`${group.modelName}-${group.company}-${group.purchaseDate}-${group.purchasedInWarranty}`}
                              style={{
                                borderBottom: "1px solid #f3f4f6",
                                backgroundColor:
                                  index % 2 === 0 ? "#ffffff" : "#fafafa",
                                transition: "background-color 0.15s",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#f9fafb")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  index % 2 === 0 ? "#ffffff" : "#fafafa")
                              }
                            >
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  fontWeight: "600",
                                  color: "#111827",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                <div>{group.modelName || "N/A"}</div>
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  color: "#374151",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                {group.company || "N/A"}
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.35rem",
                                    alignItems: "flex-start",
                                    lineHeight: "1.2",
                                  }}
                                >
                                  {group.descriptionColorMap &&
                                  Object.keys(group.descriptionColorMap)
                                    .length > 0
                                    ? // Show colours grouped by description tags
                                      Object.entries(
                                        group.descriptionColorMap
                                      ).map(([descLabel, coloursByDesc]) => (
                                        <div
                                          key={descLabel}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.4rem",
                                            flexWrap: "wrap",
                                            width: "100%",
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontSize: "0.75rem",
                                              fontWeight: 600,
                                              color: "#374151",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {descLabel} -
                                          </span>
                                          <div
                                            style={{
                                              display: "flex",
                                              flexWrap: "wrap",
                                              gap: "0.25rem",
                                            }}
                                          >
                                            {Object.entries(
                                              coloursByDesc
                                            ).map(
                                              (
                                                [colourName, qty],
                                                colourIndex
                                              ) => (
                                                <div
                                                  key={`${descLabel}-${colourName}-${colourIndex}`}
                                                  style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.2rem",
                                                    backgroundColor: "#f8fafc",
                                                    padding: "0.25rem 0.35rem",
                                                    borderRadius: "999px",
                                                    border:
                                                      "1px solid #e2e8f0",
                                                    fontSize: "0.75rem",
                                                    lineHeight: "1",
                                                  }}
                                                  title={`${colourName || "N/A"}: ${
                                                    qty || 0
                                                  } units`}
                                                >
                                                  {colourName
                                                    ?.toLowerCase() ===
                                                  "white-black" ? (
                                                    <div
                                                      style={{
                                                        width: "14px",
                                                        height: "14px",
                                                        borderRadius: "50%",
                                                        border:
                                                          "1px solid #cbd5e1",
                                                        boxShadow:
                                                          "0 1px 2px rgba(0,0,0,0.1)",
                                                        flexShrink: 0,
                                                        position: "relative",
                                                        overflow: "hidden",
                                                      }}
                                                    >
                                                      <div
                                                        style={{
                                                          position: "absolute",
                                                          left: 0,
                                                          top: 0,
                                                          width: "50%",
                                                          height: "100%",
                                                          backgroundColor:
                                                            "#FFFFFF",
                                                        }}
                                                      />
                                                      <div
                                                        style={{
                                                          position: "absolute",
                                                          right: 0,
                                                          top: 0,
                                                          width: "50%",
                                                          height: "100%",
                                                          backgroundColor:
                                                            "#000000",
                                                        }}
                                                      />
                                                    </div>
                                                  ) : (
                                                    <div
                                                      style={{
                                                        width: "14px",
                                                        height: "14px",
                                                        borderRadius: "50%",
                                                        backgroundColor:
                                                          getColourDisplay(
                                                            colourName
                                                          ),
                                                        border:
                                                          colourName
                                                            ?.toLowerCase() ===
                                                          "white"
                                                            ? "1px solid #cbd5e1"
                                                            : "none",
                                                        boxShadow:
                                                          "0 1px 2px rgba(0,0,0,0.1)",
                                                        flexShrink: 0,
                                                      }}
                                                    />
                                                  )}
                                                  <span
                                                    style={{
                                                      fontSize: "0.75rem",
                                                      color: "#475569",
                                                      fontWeight: "500",
                                                    }}
                                                  >
                                                    {qty}
                                                  </span>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      ))
                                    : // Fallback: simple colour list when no descriptions available
                                      group.colours.map(
                                        (colourItem, colourIndex) => (
                                          <div
                                            key={colourIndex}
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "0.2rem",
                                              backgroundColor: "#f8fafc",
                                              padding: "0.3rem 0.4rem",
                                              borderRadius: "0.3rem",
                                              border: "1px solid #e2e8f0",
                                              transition: "all 0.15s",
                                              cursor: "default",
                                              fontSize: "0.8rem",
                                              lineHeight: "1",
                                              minWidth: "40px",
                                              justifyContent: "center",
                                            }}
                                            title={`${
                                              colourItem.colour || "N/A"
                                            }: ${colourItem.quantity} units`}
                                          >
                                            {colourItem.colour
                                              ?.toLowerCase() ===
                                            "white-black" ? (
                                              <div
                                                style={{
                                                  width: "16px",
                                                  height: "16px",
                                                  borderRadius: "50%",
                                                  border:
                                                    "1px solid #cbd5e1",
                                                  boxShadow:
                                                    "0 1px 2px rgba(0,0,0,0.1)",
                                                  flexShrink: 0,
                                                  position: "relative",
                                                  overflow: "hidden",
                                                }}
                                              >
                                                <div
                                                  style={{
                                                    position: "absolute",
                                                    left: 0,
                                                    top: 0,
                                                    width: "50%",
                                                    height: "100%",
                                                    backgroundColor:
                                                      "#FFFFFF",
                                                  }}
                                                />
                                                <div
                                                  style={{
                                                    position: "absolute",
                                                    right: 0,
                                                    top: 0,
                                                    width: "50%",
                                                    height: "100%",
                                                    backgroundColor:
                                                      "#000000",
                                                  }}
                                                />
                                              </div>
                                            ) : (
                                              <div
                                                style={{
                                                  width: "16px",
                                                  height: "16px",
                                                  borderRadius: "50%",
                                                  backgroundColor:
                                                    getColourDisplay(
                                                      colourItem.colour
                                                    ),
                                                  border:
                                                    colourItem.colour?.toLowerCase() ===
                                                    "white"
                                                      ? "1px solid #cbd5e1"
                                                      : "none",
                                                  boxShadow:
                                                    "0 1px 2px rgba(0,0,0,0.1)",
                                                  flexShrink: 0,
                                                }}
                                              />
                                            )}
                                            <span
                                              style={{
                                                fontSize: "0.75rem",
                                                color: "#475569",
                                                fontWeight: "500",
                                              }}
                                            >
                                              {colourItem.quantity}
                                            </span>
                                          </div>
                                        )
                                      )}
                                  <button
                                    onClick={() => {
                                      if (group.models.length > 0) {
                                        handleNavigateOutsideAdmin(
                                          `/models/add?modelId=${group.models[0]._id}&admin=true`
                                        );
                                      }
                                    }}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "0.2rem",
                                      backgroundColor: "#10b981",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "0.25rem",
                                      cursor: "pointer",
                                      fontSize: "0.7rem",
                                      fontWeight: "500",
                                      padding: "0.2rem 0.4rem",
                                      transition: "all 0.15s",
                                      minWidth: "40px",
                                      height: "28px",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.backgroundColor =
                                        "#059669";
                                      e.target.style.transform =
                                        "translateY(-1px)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.backgroundColor =
                                        "#10b981";
                                      e.target.style.transform =
                                        "translateY(0)";
                                    }}
                                    title="Add more colors"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                {group.totalQuantity || 0}
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                  color: "#374151",
                                }}
                              >
                                {group.sellingPrice != null &&
                                group.sellingPrice !== ""
                                  ? `₹${parseFloat(
                                      group.sellingPrice
                                    ).toLocaleString("en-IN", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                  : "—"}
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                <span
                                  style={{
                                    background:
                                      group.totalQuantity > 0
                                        ? "#10b981"
                                        : "#ef4444",
                                    color: "white",
                                    padding: "0.375rem 0.875rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.8125rem",
                                    fontWeight: "500",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.375rem",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: "4px",
                                      height: "4px",
                                      borderRadius: "50%",
                                      backgroundColor: "currentColor",
                                    }}
                                  />
                                  {group.totalQuantity > 0
                                    ? "In Stock"
                                    : "Out of Stock"}
                                </span>
                              </td>
                              <td
                                style={{
                                  padding: "1.25rem 1.5rem",
                                  verticalAlign: "middle",
                                  borderRight: "1px solid #e5e7eb",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "0.5rem",
                                    justifyContent: "center",
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      // Navigate to edit page for the first model in this group
                                      if (group.models.length > 0) {
                                        handleNavigateOutsideAdmin(
                                          `/models/edit/${group.models[0]._id}?admin=true`
                                        );
                                      }
                                    }}
                                    style={{
                                      padding: "0.25rem 0.5rem",
                                      fontSize: "0.7rem",
                                      backgroundColor: "#3b82f6",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "0.25rem",
                                      cursor: "pointer",
                                      fontWeight: "400",
                                      transition: "all 0.15s",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      minWidth: "24px",
                                      height: "24px",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.backgroundColor =
                                        "#2563eb";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.backgroundColor =
                                        "#3b82f6";
                                    }}
                                    title="Edit model"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (group.models.length === 0) return;

                                      const confirmDelete = window.confirm(
                                        `Are you sure you want to delete ${group.models.length} model(s) for ${group.modelName} - ${group.company}? This action cannot be undone.`
                                      );

                                      if (!confirmDelete) return;

                                      try {
                                        let deletedCount = 0;
                                        let lastError = "";
                                        for (const model of group.models) {
                                          const response = await fetch(
                                            `${API_BASE}/models/${model._id}`,
                                            {
                                              method: "DELETE",
                                            }
                                          );

                                          if (response.ok) {
                                            deletedCount++;
                                          } else {
                                            lastError = await getFetchErrorMessage(
                                              response,
                                              "Delete failed"
                                            );
                                          }
                                        }
                                        await fetchModels();
                                        if (lastError && deletedCount < group.models.length) {
                                          throw new Error(lastError);
                                        }

                                        alert(
                                          `Successfully deleted ${deletedCount} model(s) for ${group.modelName} - ${group.company}`
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Error deleting models:",
                                          error
                                        );
                                        alert(
                                          `Error deleting models: ${error.message}`
                                        );
                                      }
                                    }}
                                    style={{
                                      padding: "0.25rem 0.5rem",
                                      fontSize: "0.7rem",
                                      backgroundColor: "#ef4444",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "0.25rem",
                                      cursor: "pointer",
                                      fontWeight: "400",
                                      transition: "all 0.15s",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      minWidth: "24px",
                                      height: "24px",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.backgroundColor =
                                        "#dc2626";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.backgroundColor =
                                        "#ef4444";
                                    }}
                                    title="Delete model(s)"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Actions */}
            <div className="admin-actions">
              <button
                className="btn btn-primary"
                onClick={() => navigate("/models/add?admin=true")}
              >
                Add New Model
              </button>
            </div>
          </div>
        );
      }
      case "finance": {
        const billBucket =
          financeRangeMode === "day"
            ? financeTotals.bill.day
            : financeTotals.bill.month;
        const jobcardBucket =
          financeRangeMode === "day"
            ? financeTotals.jobcard.day
            : financeTotals.jobcard.month;
        const financePeriodLabel =
          financeRangeMode === "day"
            ? new Date(`${financeSelectedDate}T12:00:00`).toLocaleDateString(
                "en-IN",
                {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }
              )
            : new Date(`${financeSelectedMonth}-01T12:00:00`).toLocaleDateString(
                "en-IN",
                { month: "long", year: "numeric" }
              );
        const financeTriggerBtnStyle = {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          padding: "0.55rem 0.95rem",
          borderRadius: "10px",
          border: "1px solid #cbd5e1",
          background: "#fff",
          fontSize: "0.95rem",
          fontWeight: 500,
          color: "#0f172a",
          cursor: "pointer",
          minWidth: "156px",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
          fontFamily: "inherit",
          transition: "border-color 0.15s, box-shadow 0.15s",
        };
        const financePopoverStyle = {
          position: "absolute",
          top: "calc(100% + 8px)",
          left: 0,
          zIndex: 50,
          background: "#fff",
          borderRadius: "14px",
          boxShadow:
            "0 12px 40px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.06)",
          padding: "1rem",
          minWidth: "292px",
        };
        const calY = financeCalMonth.getFullYear();
        const calM = financeCalMonth.getMonth();
        const daysInCalMonth = new Date(calY, calM + 1, 0).getDate();
        const firstDowMon =
          (new Date(calY, calM, 1).getDay() + 6) % 7;
        const todayYmd = getTodayForInput();
        const financeDayCells = [];
        for (let i = 0; i < firstDowMon; i++) financeDayCells.push(null);
        for (let d = 1; d <= daysInCalMonth; d++) financeDayCells.push(d);

        return (
          <div className="admin-content">
            <h2>Finance Management</h2>

            {financeSubView !== null && (
              <div
                className="admin-actions"
                style={{
                  marginBottom: "1rem",
                  width: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => setFinanceSubView(null)}
                >
                  ← Back to finance
                </button>
              </div>
            )}

            {financeSubView !== null && (
              <div
                className="admin-actions"
                style={{
                  marginBottom: "1.5rem",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#666", fontSize: "0.9rem" }}>Period</span>
                <button
                  type="button"
                  className={
                    financeRangeMode === "day" ? "btn btn-primary" : "btn btn-secondary"
                  }
                  onClick={() => {
                    setShowFinanceDayPicker(false);
                    setShowFinanceMonthPicker(false);
                    setFinanceRangeMode("day");
                  }}
                >
                  Date
                </button>
                <button
                  type="button"
                  className={
                    financeRangeMode === "month" ? "btn btn-primary" : "btn btn-secondary"
                  }
                  onClick={() => {
                    setShowFinanceDayPicker(false);
                    setShowFinanceMonthPicker(false);
                    setFinanceRangeMode("month");
                  }}
                >
                  Month
                </button>
                {financeRangeMode === "day" ? (
                  <div
                    ref={financeDayPickerRef}
                    style={{ position: "relative", display: "inline-block" }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setFinanceCalMonth(ymdToLocalDate(financeSelectedDate));
                        setShowFinanceMonthPicker(false);
                        setShowFinanceDayPicker((o) => !o);
                      }}
                      aria-expanded={showFinanceDayPicker}
                      aria-haspopup="dialog"
                      aria-label="Select date, dd/mm/yyyy"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#3b82f6";
                        e.currentTarget.style.boxShadow =
                          "0 0 0 3px rgba(59, 130, 246, 0.15)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#cbd5e1";
                        e.currentTarget.style.boxShadow =
                          "0 1px 2px rgba(15, 23, 42, 0.06)";
                      }}
                      style={financeTriggerBtnStyle}
                    >
                      <span style={{ letterSpacing: "0.02em" }}>
                        {ymdToDdMmYyyy(financeSelectedDate)}
                      </span>
                      <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                        ▾
                      </span>
                    </button>
                    {showFinanceDayPicker && (
                      <div
                        style={financePopoverStyle}
                        role="dialog"
                        aria-label="Calendar"
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "0.65rem",
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            style={{
                              borderRadius: "8px",
                              padding: "0.25rem 0.55rem",
                              lineHeight: 1,
                            }}
                            onClick={() =>
                              setFinanceCalMonth(
                                new Date(calY, calM - 1, 1, 12, 0, 0)
                              )
                            }
                            aria-label="Previous month"
                          >
                            ‹
                          </button>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: "0.95rem",
                              color: "#1e293b",
                            }}
                          >
                            {financeCalMonth.toLocaleDateString("en-IN", {
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            style={{
                              borderRadius: "8px",
                              padding: "0.25rem 0.55rem",
                              lineHeight: 1,
                            }}
                            onClick={() =>
                              setFinanceCalMonth(
                                new Date(calY, calM + 1, 1, 12, 0, 0)
                              )
                            }
                            aria-label="Next month"
                          >
                            ›
                          </button>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(7, 1fr)",
                            gap: "4px",
                            textAlign: "center",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            color: "#64748b",
                            marginBottom: "6px",
                          }}
                        >
                          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(
                            (w) => (
                              <div key={w}>{w}</div>
                            )
                          )}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(7, 1fr)",
                            gap: "4px",
                          }}
                        >
                          {financeDayCells.map((dayNum, idx) => {
                            if (dayNum == null) {
                              return (
                                <div key={`e-${idx}`} aria-hidden="true" />
                              );
                            }
                            const ymd = dateToYmd(
                              new Date(calY, calM, dayNum, 12, 0, 0)
                            );
                            const isSelected = ymd === financeSelectedDate;
                            const isToday = ymd === todayYmd;
                            return (
                              <button
                                key={ymd}
                                type="button"
                                onClick={() => {
                                  setFinanceSelectedDate(ymd);
                                  setShowFinanceDayPicker(false);
                                }}
                                style={{
                                  height: "36px",
                                  borderRadius: "9px",
                                  border: isToday
                                    ? "2px solid #3b82f6"
                                    : "1px solid transparent",
                                  background: isSelected ? "#3b82f6" : "#f8fafc",
                                  color: isSelected ? "#fff" : "#334155",
                                  fontWeight: isSelected ? 600 : 500,
                                  fontSize: "0.875rem",
                                  cursor: "pointer",
                                  transition: "background 0.12s, color 0.12s",
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.background = "#e0f2fe";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.background = "#f8fafc";
                                  }
                                }}
                              >
                                {dayNum}
                              </button>
                            );
                          })}
                        </div>
                        <div
                          style={{
                            marginTop: "0.75rem",
                            paddingTop: "0.65rem",
                            borderTop: "1px solid #e2e8f0",
                            display: "flex",
                            justifyContent: "center",
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            style={{ borderRadius: "8px" }}
                            onClick={() => {
                              const t = getTodayForInput();
                              setFinanceSelectedDate(t);
                              setFinanceCalMonth(ymdToLocalDate(t));
                              setShowFinanceDayPicker(false);
                            }}
                          >
                            Today
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    ref={financeMonthPickerRef}
                    style={{ position: "relative", display: "inline-block" }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const [yy] = String(financeSelectedMonth).split("-");
                        setFinanceMonthPickYear(
                          parseInt(yy, 10) || new Date().getFullYear()
                        );
                        setShowFinanceDayPicker(false);
                        setShowFinanceMonthPicker((o) => !o);
                      }}
                      aria-expanded={showFinanceMonthPicker}
                      aria-haspopup="dialog"
                      aria-label="Select month"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#3b82f6";
                        e.currentTarget.style.boxShadow =
                          "0 0 0 3px rgba(59, 130, 246, 0.15)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#cbd5e1";
                        e.currentTarget.style.boxShadow =
                          "0 1px 2px rgba(15, 23, 42, 0.06)";
                      }}
                      style={financeTriggerBtnStyle}
                    >
                      <span style={{ letterSpacing: "0.02em" }}>
                        {yyyyMmToSlashDisplay(financeSelectedMonth)}
                      </span>
                      <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                        ▾
                      </span>
                    </button>
                    {showFinanceMonthPicker && (
                      <div
                        style={{
                          ...financePopoverStyle,
                          minWidth: "260px",
                        }}
                        role="dialog"
                        aria-label="Choose month"
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "0.75rem",
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            style={{
                              borderRadius: "8px",
                              padding: "0.25rem 0.55rem",
                              lineHeight: 1,
                            }}
                            onClick={() =>
                              setFinanceMonthPickYear((y) => y - 1)
                            }
                            aria-label="Previous year"
                          >
                            ‹
                          </button>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: "0.95rem",
                              color: "#1e293b",
                            }}
                          >
                            {financeMonthPickYear}
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            style={{
                              borderRadius: "8px",
                              padding: "0.25rem 0.55rem",
                              lineHeight: 1,
                            }}
                            onClick={() =>
                              setFinanceMonthPickYear((y) => y + 1)
                            }
                            aria-label="Next year"
                          >
                            ›
                          </button>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: "8px",
                          }}
                        >
                          {FINANCE_MONTH_SHORT.map((label, mi) => {
                            const m = String(mi + 1).padStart(2, "0");
                            const val = `${financeMonthPickYear}-${m}`;
                            const isSel = val === financeSelectedMonth;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => {
                                  setFinanceSelectedMonth(val);
                                  setShowFinanceMonthPicker(false);
                                }}
                                style={{
                                  padding: "0.5rem 0.35rem",
                                  borderRadius: "9px",
                                  border: isSel
                                    ? "2px solid #3b82f6"
                                    : "1px solid #e2e8f0",
                                  background: isSel ? "#eff6ff" : "#fff",
                                  color: isSel ? "#1d4ed8" : "#475569",
                                  fontWeight: isSel ? 600 : 500,
                                  fontSize: "0.8rem",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {financeSubView === null && (
              <div className="admin-finance-landing">
                <div className="admin-finance-tile-grid">
                  <button
                    type="button"
                    className="admin-finance-tile"
                    onClick={() => setFinanceSubView("jobcards")}
                  >
                    Jobcard
                  </button>
                  <button
                    type="button"
                    className="admin-finance-tile"
                    onClick={() => setFinanceSubView("bills")}
                  >
                    Bills
                  </button>
                </div>
              </div>
            )}

            {/* Bills Profit (full section) */}
              {financeSubView === "bills" && (
                <div
                  className="admin-card"
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    marginBottom: 0,
                  }}
                >
                <div
                  style={{
                    padding: "1rem 1.5rem",
                    borderBottom: "1px solid #e9ecef",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#333", fontSize: "1.05rem" }}>
                      Bills — profit breakdown
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                      {financePeriodLabel} · paid − model & accessory cost (+ old scooty trade-in when applicable) = profit
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.8rem", color: "#666" }}>Profit</div>
                    <div
                      className="card-number"
                      style={{
                        margin: 0,
                        fontSize: "1.65rem",
                        color:
                          (billBucket.profit || 0) >= 0 ? "#198754" : "#dc3545",
                      }}
                    >
                      ₹
                      {billsLoading
                        ? "…"
                        : (billBucket.profit || 0).toLocaleString("en-IN")}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.15rem" }}>
                      Customer paid (total) ₹
                      {billsLoading
                        ? "…"
                        : (billBucket.revenue || 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>

                <div style={{ padding: "1rem 1.5rem" }}>
                  {billsLoading ? (
                    <div style={{ color: "#6b7280" }}>Loading bills…</div>
                  ) : billBucket.details.length === 0 ? (
                    <div style={{ color: "#6b7280" }}>
                      No bills in this{" "}
                      {financeRangeMode === "day" ? "day" : "month"}.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      {billBucket.details.slice(0, 25).map((b) => {
                        const expanded =
                          financeExpandedBillId != null &&
                          String(financeExpandedBillId) === String(b.id);
                        return (
                          <div
                            key={b.id}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: "0.5rem",
                              overflow: "hidden",
                              background: "#fafafa",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setFinanceExpandedBillId((cur) =>
                                  cur != null && String(cur) === String(b.id)
                                    ? null
                                    : b.id
                                )
                              }
                              style={{
                                border: "none",
                                borderRadius: 0,
                                padding: "0.65rem 0.9rem",
                                background: expanded ? "#f1f5f9" : "#fafafa",
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "1rem",
                                width: "100%",
                                fontFamily: "inherit",
                                textAlign: "left",
                              }}
                              aria-expanded={expanded}
                              aria-label={`Bill ${b.billNo}, profit ₹${(b.profit || 0).toLocaleString("en-IN")}, ${expanded ? "collapse" : "expand"} details`}
                            >
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: "#111827",
                                  fontSize: "0.95rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    color: "#94a3b8",
                                    fontWeight: 800,
                                    transform: expanded
                                      ? "rotate(90deg)"
                                      : "rotate(0deg)",
                                    transition: "transform 0.15s ease",
                                    display: "inline-block",
                                  }}
                                  aria-hidden
                                >
                                  ▸
                                </span>
                                Bill {b.billNo}
                              </span>
                              <span
                                style={{
                                  fontSize: "1.05rem",
                                  fontWeight: 800,
                                  color: b.profit >= 0 ? "#16a34a" : "#dc2626",
                                  flexShrink: 0,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                ₹{(b.profit || 0).toLocaleString("en-IN")}
                              </span>
                            </button>
                            {expanded ? (
                              <div
                                style={{
                                  padding: "0.65rem 0.9rem 0.85rem",
                                  borderTop: "1px solid #e5e7eb",
                                  background: "#fff",
                                  fontSize: "0.84rem",
                                  color: "#374151",
                                  lineHeight: 1.45,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "0.85rem",
                                    color: "#64748b",
                                    marginBottom: "0.35rem",
                                  }}
                                >
                                  {b.customerName}{" "}
                                  <span style={{ color: "#cbd5e1" }}>·</span> {b.billDate}
                                </div>
                                <div>
                                  <span style={{ color: "#6b7280" }}>Customer paid</span>{" "}
                                  <span style={{ fontWeight: 700 }}>
                                    ₹{(b.revenue || 0).toLocaleString("en-IN")}
                                  </span>
                                  {(Number(b.netBillAmount) || 0) > 0 &&
                                  (Number(b.netBillAmount) || 0) !==
                                    (Number(b.revenue) || 0) ? (
                                    <span
                                      style={{
                                        display: "block",
                                        fontSize: "0.78rem",
                                        fontWeight: 500,
                                        color: "#94a3b8",
                                        marginTop: "0.15rem",
                                      }}
                                    >
                                      Net bill (incl. trade-in toward price) ₹
                                      {(Number(b.netBillAmount) || 0).toLocaleString("en-IN")}
                                    </span>
                                  ) : null}
                                </div>
                                <div style={{ marginTop: "0.45rem" }}>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      color: "#111827",
                                      fontSize: "0.8rem",
                                    }}
                                  >
                                    Model
                                  </div>
                                  <div style={{ paddingLeft: "0.45rem", color: "#4b5563" }}>
                                    <div>Name: {b.modelName || "—"}</div>
                                    {b.modelDescription ? (
                                      <div>Description: {b.modelDescription}</div>
                                    ) : null}
                                    {b.modelColor ? (
                                      <div>Colour: {b.modelColor}</div>
                                    ) : null}
                                    <div>Battery: {b.batteryQtyLine || "—"}</div>
                                  </div>
                                </div>
                                {b.oldScooty ? (
                                  <div style={{ marginTop: "0.45rem" }}>
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        color: "#111827",
                                        fontSize: "0.8rem",
                                      }}
                                    >
                                      Old scooty (trade-in)
                                    </div>
                                    <div
                                      style={{
                                        paddingLeft: "0.45rem",
                                        color: "#4b5563",
                                      }}
                                    >
                                      <div>
                                        Model: {b.oldScooty.modelLabel || "—"}
                                      </div>
                                      {b.oldScooty.pmcNo ? (
                                        <div>PMC: {b.oldScooty.pmcNo}</div>
                                      ) : null}
                                      <div>
                                        Purchase / trade-in value:{" "}
                                        <span style={{ fontWeight: 700 }}>
                                          ₹
                                          {(
                                            Number(b.oldScooty.purchasePrice) || 0
                                          ).toLocaleString("en-IN")}
                                        </span>
                                      </div>
                                      {b.oldScooty.specNotes ? (
                                        <div
                                          style={{
                                            marginTop: "0.2rem",
                                            fontSize: "0.8rem",
                                            color: "#64748b",
                                            lineHeight: 1.4,
                                          }}
                                        >
                                          {b.oldScooty.specNotes}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                                {Array.isArray(b.accessoryLines) &&
                                b.accessoryLines.length > 0 ? (
                                  <div style={{ marginTop: "0.45rem" }}>
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        color: "#111827",
                                        fontSize: "0.8rem",
                                      }}
                                    >
                                      Accessories
                                    </div>
                                    <div style={{ paddingLeft: "0.45rem", color: "#4b5563" }}>
                                      {b.accessoryLines.map((c, idx) => (
                                        <div key={`${b.id}-inline-a-${idx}`}>
                                          {c.label}{" "}
                                          <span style={{ color: "#6b7280" }}>
                                            (₹
                                            {(Number(c.cost) || 0).toLocaleString("en-IN")})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                                <div
                                  style={{
                                    marginTop: "0.65rem",
                                    paddingTop: "0.5rem",
                                    borderTop: "1px solid #e5e7eb",
                                    fontWeight: 600,
                                    color: "#111827",
                                    fontSize: "0.84rem",
                                  }}
                                >
                                  ₹{(b.revenue || 0).toLocaleString("en-IN")} − ₹
                                  {(b.totalCost || 0).toLocaleString("en-IN")}
                                  {(Number(b.tradeInCreditAmount) || 0) > 0 ? (
                                    <>
                                      {" "}
                                      + ₹
                                      {(Number(b.tradeInCreditAmount) || 0).toLocaleString(
                                        "en-IN"
                                      )}
                                    </>
                                  ) : null}{" "}
                                  ={" "}
                                  <span
                                    style={{
                                      color: b.profit >= 0 ? "#16a34a" : "#dc2626",
                                    }}
                                  >
                                    ₹{(b.profit || 0).toLocaleString("en-IN")}
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: 400,
                                      fontSize: "0.76rem",
                                      color: "#9ca3af",
                                      marginLeft: "0.35rem",
                                    }}
                                  >
                                    {(Number(b.tradeInCreditAmount) || 0) > 0
                                      ? "paid − actual cost + old scooty = profit"
                                      : "paid − actual cost = profit"}
                                  </span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {billBucket.details.length > 25 && (
                        <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                          Showing 25 of {billBucket.details.length} bills.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Jobcards Profit (full section) */}
              {financeSubView === "jobcards" && (
                <>
                <div
                  className="admin-card"
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    marginBottom: 0,
                  }}
                >
                <div
                  style={{
                    padding: "1rem 1.5rem",
                    borderBottom: "1px solid #e9ecef",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                  className="finance-jobcards-profit-header"
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#333", fontSize: "1.05rem" }}>
                      Jobcards — service & sales profit
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                      {financePeriodLabel} · finalized jobcards; service and spare-sales lines:
                      paid amount minus spare purchase cost
                    </div>
                  </div>
                  <div className="finance-profit-summary" style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.8rem", color: "#666" }}>Profit</div>
                    <div
                      className="card-number"
                      style={{
                        margin: 0,
                        fontSize: "1.65rem",
                        color:
                          (jobcardBucket.profit || 0) >= 0 ? "#198754" : "#dc3545",
                      }}
                    >
                      ₹
                      {jobcardsLoading
                        ? "…"
                        : (jobcardBucket.profit || 0).toLocaleString("en-IN")}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.15rem" }}>
                      Total paid (jobcards) ₹
                      {jobcardsLoading
                        ? "…"
                        : (jobcardBucket.paid || 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>

                <div style={{ padding: "1rem 1.5rem" }}>
                  {jobcardsLoading ? (
                    <div style={{ color: "#6b7280" }}>Loading jobcards…</div>
                  ) : jobcardBucket.details.length === 0 ? (
                    <div style={{ color: "#6b7280" }}>
                      No finalized jobcards in this{" "}
                      {financeRangeMode === "day" ? "day" : "month"}.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      {jobcardBucket.details
                        .slice(0, 25)
                        .map((j) => (
                          <button
                            key={j.id}
                            type="button"
                            onClick={() => setFinanceJobcardProfitModalJobcard(j)}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: "0.5rem",
                              padding: "0.65rem 0.9rem",
                              background: "#fafafa",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "1rem",
                              width: "100%",
                              fontFamily: "inherit",
                              textAlign: "left",
                            }}
                            aria-label={`${j.jobcardNumber}, profit ₹${(j.profit || 0).toLocaleString("en-IN")}, open breakdown`}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                color: "#111827",
                                fontSize: "0.95rem",
                              }}
                            >
                              {j.jobcardNumber}
                            </span>
                            <span
                              style={{
                                fontSize: "1.05rem",
                                fontWeight: 800,
                                color: j.profit >= 0 ? "#16a34a" : "#dc2626",
                                flexShrink: 0,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              ₹{(j.profit || 0).toLocaleString("en-IN")}
                            </span>
                          </button>
                        ))}
                      {jobcardBucket.details.length > 25 && (
                        <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                          Showing 25 of {jobcardBucket.details.length} jobcards.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {financeJobcardProfitModalJobcard &&
                (() => {
                  const j = financeJobcardProfitModalJobcard;
                  /** Align modal rows with jobcard parts: Service / Sales / Replacement */
                  const profitModalSectionForLine = (l) => {
                    const k = l?.kind;
                    if (k === "service") return "service";
                    if (k === "battery-replacement") return "replacement";
                    return "sales";
                  };
                  const profitModalSections = [
                    {
                      id: "service",
                      title: "Service",
                      lines: (j.lines || []).filter(
                        (l) => profitModalSectionForLine(l) === "service"
                      ),
                    },
                    {
                      id: "sales",
                      title: "Sales",
                      lines: (j.lines || []).filter(
                        (l) => profitModalSectionForLine(l) === "sales"
                      ),
                    },
                    {
                      id: "replacement",
                      title: "Replacement",
                      lines: (j.lines || []).filter(
                        (l) => profitModalSectionForLine(l) === "replacement"
                      ),
                    },
                  ];
                  return (
                    <div
                      style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(15, 23, 42, 0.45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 100,
                        padding: "1rem",
                      }}
                      onClick={() => setFinanceJobcardProfitModalJobcard(null)}
                    >
                      <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="finance-jobcard-profit-modal-title"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          backgroundColor: "#fff",
                          borderRadius: "0.75rem",
                          width: "min(720px, calc(100vw - 2rem))",
                          maxHeight: "min(90vh, 900px)",
                          overflowY: "auto",
                          overflowX: "hidden",
                          boxShadow:
                            "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
                          padding: "1rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "1rem",
                            marginBottom: "1rem",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "0.72rem",
                                color: "#64748b",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                              }}
                            >
                              Profit breakdown
                            </div>
                            <h2
                              id="finance-jobcard-profit-modal-title"
                              style={{
                                margin: "0.25rem 0 0",
                                fontSize: "1.15rem",
                                fontWeight: 700,
                                color: "#111827",
                              }}
                            >
                              {j.jobcardNumber}
                            </h2>
                            <div
                              style={{
                                fontSize: "0.85rem",
                                color: "#64748b",
                                marginTop: "0.2rem",
                              }}
                            >
                              {j.customerName}{" "}
                              <span style={{ color: "#cbd5e1" }}>·</span>{" "}
                              {formatFinanceJobcardDate(j.date)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFinanceJobcardProfitModalJobcard(null)}
                            style={{
                              background: "none",
                              border: "none",
                              fontSize: "1.5rem",
                              lineHeight: 1,
                              cursor: "pointer",
                              color: "#6b7280",
                              padding: "0.25rem",
                            }}
                            aria-label="Close"
                          >
                            ×
                          </button>
                        </div>
                        <div
                          style={{
                            marginTop: "0.35rem",
                            marginBottom: "0.75rem",
                            padding: "0.55rem 0.7rem",
                            background:
                              "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                            borderRadius: "0.5rem",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                              letterSpacing: "0.07em",
                              marginBottom: "0.4rem",
                            }}
                          >
                            Profit calculation
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.25rem 0.5rem",
                              fontSize: "0.8125rem",
                              color: "#334155",
                              lineHeight: 1.5,
                            }}
                          >
                            <span>
                              <span style={{ color: "#64748b" }}>Paid</span>{" "}
                              <strong style={{ color: "#0f172a" }}>
                                ₹{(j.paidAmount || 0).toLocaleString("en-IN")}
                              </strong>
                            </span>
                            <span style={{ color: "#94a3b8", fontWeight: 600 }}>−</span>
                            <span>
                              <span style={{ color: "#64748b" }}>
                                Purchase cost (FIFO)
                              </span>{" "}
                              <strong style={{ color: "#0f172a" }}>
                                ₹{(j.totalCost || 0).toLocaleString("en-IN")}
                              </strong>
                            </span>
                            {(j.customerScrapCreditTotal || 0) > 0 && (
                              <>
                                <span style={{ color: "#94a3b8", fontWeight: 600 }}>+</span>
                                <span>
                                  <span style={{ color: "#64748b" }}>
                                    Customer scrap credit
                                  </span>{" "}
                                  <strong style={{ color: "#0f172a" }}>
                                    ₹
                                    {(j.customerScrapCreditTotal || 0).toLocaleString("en-IN")}
                                  </strong>
                                </span>
                              </>
                            )}
                            {(j.oldBatteryScrapCreditTotal || 0) > 0 && (
                              <>
                                <span style={{ color: "#94a3b8", fontWeight: 600 }}>+</span>
                                <span>
                                  <span style={{ color: "#64748b" }}>
                                    Old battery scrap credit
                                  </span>{" "}
                                  <strong style={{ color: "#0f172a" }}>
                                    ₹
                                    {(j.oldBatteryScrapCreditTotal || 0).toLocaleString("en-IN")}
                                  </strong>
                                </span>
                              </>
                            )}
                            <span style={{ color: "#94a3b8", fontWeight: 600 }}>=</span>
                            <span>
                              <span style={{ color: "#64748b" }}>Profit</span>{" "}
                              <strong
                                style={{
                                  color: j.profit >= 0 ? "#15803d" : "#b91c1c",
                                }}
                              >
                                ₹{(j.profit || 0).toLocaleString("en-IN")}
                              </strong>
                            </span>
                          </div>
                          {(j.serviceThingSummaries.length > 0 ||
                            j.replacementThingSummaries.length > 0 ||
                            j.salesThingSummaries.length > 0) && (
                            <div
                              style={{
                                marginTop: "0.5rem",
                                paddingTop: "0.5rem",
                                borderTop: "1px solid #e2e8f0",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.35rem",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  color: "#64748b",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.07em",
                                }}
                              >
                                Things on this jobcard
                              </div>
                              {[
                                {
                                  key: "service",
                                  label: "Service",
                                  rows: j.serviceThingSummaries,
                                },
                                {
                                  key: "replacement",
                                  label: "Replacement",
                                  rows: j.replacementThingSummaries,
                                },
                                {
                                  key: "sales",
                                  label: "Sales",
                                  rows: j.salesThingSummaries,
                                },
                              ]
                                .filter((s) => s.rows.length > 0)
                                .map((section) => (
                                  <div
                                    key={section.key}
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      alignItems: "baseline",
                                      gap: "0.35rem 0.5rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "0.68rem",
                                        fontWeight: 700,
                                        color: "#94a3b8",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {section.label}
                                    </span>
                                    <div
                                      style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "0.3rem",
                                        minWidth: 0,
                                      }}
                                    >
                                      {section.rows.slice(0, 8).map((row, i) => (
                                        <span
                                          key={`${j.id}-modal-${section.key}-${i}`}
                                          title={`${row.name} · Qty ${row.quantity}`}
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "0.35rem",
                                            fontSize: "0.7rem",
                                            fontWeight: 600,
                                            color: "#334155",
                                            background: "#fff",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "999px",
                                            padding: "0.15rem 0.5rem",
                                            lineHeight: 1.35,
                                            maxWidth: "min(240px, 100%)",
                                            minWidth: 0,
                                          }}
                                        >
                                          <span
                                            style={{
                                              minWidth: 0,
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {row.name}
                                          </span>
                                          <span
                                            style={{
                                              fontSize: "0.65rem",
                                              fontWeight: 800,
                                              color: "#64748b",
                                              flexShrink: 0,
                                              fontVariantNumeric: "tabular-nums",
                                            }}
                                          >
                                            ×{row.quantity}
                                          </span>
                                        </span>
                                      ))}
                                      {section.rows.length > 8 && (
                                        <span
                                          style={{
                                            fontSize: "0.68rem",
                                            fontWeight: 600,
                                            color: "#64748b",
                                            background: "#f1f5f9",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "999px",
                                            padding: "0.15rem 0.45rem",
                                          }}
                                        >
                                          +{section.rows.length - 8} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                          {j.totalCost === 0 && j.lines.length === 0 && (
                            <div
                              style={{
                                fontSize: "0.72rem",
                                color: "#94a3b8",
                                marginTop: "0.35rem",
                                lineHeight: 1.4,
                              }}
                            >
                              No service, spare-sales, or billable battery lines with inventory
                              cost on this jobcard — purchase cost is ₹0; profit equals paid
                              amount.
                            </div>
                          )}
                        </div>
                        <div style={{ marginTop: "0.25rem" }}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "minmax(0, 1fr) 64px 92px 92px",
                              gap: "0.35rem 0.75rem",
                              fontSize: "0.9rem",
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                color: "#374151",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              Item
                            </div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                color: "#374151",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                textAlign: "right",
                              }}
                            >
                              Qty
                            </div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                color: "#374151",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                textAlign: "right",
                              }}
                            >
                              Unit Cost
                            </div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                color: "#374151",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                textAlign: "right",
                              }}
                            >
                              Cost
                            </div>

                            {j.lines.length === 0 ? (
                              <div style={{ gridColumn: "1 / -1", color: "#6b7280" }}>
                                No FIFO cost lines (service, spare sales, or batteries) in this
                                jobcard.
                              </div>
                            ) : (
                              profitModalSections
                                .filter((sec) => sec.lines.length > 0)
                                .map((sec, secIdx) => (
                                  <div
                                    key={`${j.id}-sec-${sec.id}`}
                                    style={{ display: "contents" }}
                                  >
                                    <div
                                      style={{
                                        gridColumn: "1 / -1",
                                        marginTop: secIdx === 0 ? 0 : "0.5rem",
                                        marginBottom: "0.15rem",
                                        padding: "0.35rem 0.5rem",
                                        background:
                                          sec.id === "service"
                                            ? "#eff6ff"
                                            : sec.id === "sales"
                                            ? "#f5f3ff"
                                            : "#ecfdf5",
                                        borderRadius: "0.35rem",
                                        border: `1px solid ${
                                          sec.id === "service"
                                            ? "#bfdbfe"
                                            : sec.id === "sales"
                                            ? "#ddd6fe"
                                            : "#a7f3d0"
                                        }`,
                                        fontSize: "0.7rem",
                                        fontWeight: 800,
                                        color: "#334155",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                      }}
                                    >
                                      {sec.title}
                                    </div>
                                    {sec.lines.map((l, idx) => (
                                      <div
                                        key={`${j.id}-modal-l-${sec.id}-${idx}`}
                                        style={{ display: "contents" }}
                                      >
                                        <div
                                          style={{
                                            color: "#111827",
                                            minWidth: 0,
                                            overflowWrap: "anywhere",
                                            wordBreak: "break-word",
                                          }}
                                        >
                                          {l.name}
                                          <span
                                            style={{
                                              marginLeft: "0.35rem",
                                              fontSize: "0.72rem",
                                              fontWeight: 600,
                                              color: "#64748b",
                                              textTransform: "capitalize",
                                            }}
                                          >
                                            ({l.kindDisplay || l.kind})
                                          </span>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                          {l.quantity}
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                          ₹{(l.unitCost || 0).toFixed(2)}
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                          ₹{(l.lineCost || 0).toFixed(2)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ))
                            )}

                            {Array.isArray(j.missingPurchaseCostLabels) &&
                              j.missingPurchaseCostLabels.length > 0 && (
                                <div
                                  style={{
                                    gridColumn: "1 / -1",
                                    marginTop: "0.25rem",
                                    padding: "0.5rem 0.65rem",
                                    background: "#fffbeb",
                                    border: "1px solid #fcd34d",
                                    borderRadius: "0.4rem",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: "0.68rem",
                                      fontWeight: 600,
                                      color: "#b45309",
                                      marginBottom: "0.4rem",
                                    }}
                                  >
                                    No purchase price in stock — cost taken as ₹0
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "0.35rem",
                                    }}
                                  >
                                    {j.missingPurchaseCostLabels.map((label, mi) => (
                                      <span
                                        key={`${j.id}-modal-miss-${mi}`}
                                        style={{
                                          fontSize: "0.82rem",
                                          fontWeight: 800,
                                          color: "#7c2d12",
                                          background: "#ffedd5",
                                          border: "1px solid #fb923c",
                                          borderRadius: "0.35rem",
                                          padding: "0.3rem 0.65rem",
                                          lineHeight: 1.25,
                                        }}
                                      >
                                        {label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                            <div
                              style={{
                                gridColumn: "1 / -1",
                                height: "1px",
                                background: "#e5e7eb",
                                margin: "0.35rem 0",
                              }}
                            />

                            <div
                              style={{
                                gridColumn: "1 / -1",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: "#64748b",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                marginTop: "0.15rem",
                              }}
                            >
                              Summary
                            </div>

                            <div style={{ fontWeight: 800, color: "#111827" }}>
                              Paid amount (jobcard)
                            </div>
                            <div />
                            <div />
                            <div style={{ textAlign: "right", fontWeight: 800 }}>
                              ₹{(j.paidAmount || 0).toLocaleString("en-IN")}
                            </div>

                            {j.lines.length > 0 && (
                              <>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    color: "#475569",
                                    fontSize: "0.88rem",
                                    gridColumn: "1 / -1",
                                    marginTop: "0.15rem",
                                  }}
                                >
                                  Purchase cost (FIFO)
                                </div>
                                {(j.fifoCostServiceSection || 0) > 0 && (
                                  <>
                                    <div
                                      style={{
                                        color: "#64748b",
                                        fontSize: "0.85rem",
                                        paddingLeft: "0.35rem",
                                      }}
                                    >
                                      · Service
                                    </div>
                                    <div />
                                    <div />
                                    <div
                                      style={{
                                        textAlign: "right",
                                        fontSize: "0.85rem",
                                        color: "#334155",
                                      }}
                                    >
                                      ₹
                                      {(j.fifoCostServiceSection || 0).toLocaleString("en-IN")}
                                    </div>
                                  </>
                                )}
                                {(j.fifoCostSalesSection || 0) > 0 && (
                                  <>
                                    <div
                                      style={{
                                        color: "#64748b",
                                        fontSize: "0.85rem",
                                        paddingLeft: "0.35rem",
                                      }}
                                    >
                                      · Sales
                                    </div>
                                    <div />
                                    <div />
                                    <div
                                      style={{
                                        textAlign: "right",
                                        fontSize: "0.85rem",
                                        color: "#334155",
                                      }}
                                    >
                                      ₹
                                      {(j.fifoCostSalesSection || 0).toLocaleString("en-IN")}
                                    </div>
                                  </>
                                )}
                                {(j.fifoCostReplacementSection || 0) > 0 && (
                                  <>
                                    <div
                                      style={{
                                        color: "#64748b",
                                        fontSize: "0.85rem",
                                        paddingLeft: "0.35rem",
                                      }}
                                    >
                                      · Replacement
                                    </div>
                                    <div />
                                    <div />
                                    <div
                                      style={{
                                        textAlign: "right",
                                        fontSize: "0.85rem",
                                        color: "#334155",
                                      }}
                                    >
                                      ₹
                                      {(j.fifoCostReplacementSection || 0).toLocaleString(
                                        "en-IN"
                                      )}
                                    </div>
                                  </>
                                )}
                              </>
                            )}

                            <div style={{ fontWeight: 800, color: "#111827" }}>
                              Total purchase cost (FIFO)
                            </div>
                            <div />
                            <div />
                            <div style={{ textAlign: "right", fontWeight: 800 }}>
                              −₹{(j.totalCost || 0).toLocaleString("en-IN")}
                            </div>

                            {(j.customerScrapCreditTotal || 0) > 0 && (
                              <>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    color: "#475569",
                                    fontSize: "0.88rem",
                                  }}
                                >
                                  Customer scrap credit (new battery sales)
                                </div>
                                <div />
                                <div />
                                <div
                                  style={{
                                    textAlign: "right",
                                    fontWeight: 600,
                                    color: "#15803d",
                                  }}
                                >
                                  +₹
                                  {(j.customerScrapCreditTotal || 0).toLocaleString("en-IN")}
                                </div>
                              </>
                            )}

                            {(j.oldBatteryScrapCreditTotal || 0) > 0 && (
                              <>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    color: "#475569",
                                    fontSize: "0.88rem",
                                  }}
                                >
                                  Old battery scrap credit
                                </div>
                                <div />
                                <div />
                                <div
                                  style={{
                                    textAlign: "right",
                                    fontWeight: 600,
                                    color: "#15803d",
                                  }}
                                >
                                  +₹
                                  {(j.oldBatteryScrapCreditTotal || 0).toLocaleString("en-IN")}
                                </div>
                              </>
                            )}

                            <div style={{ fontWeight: 900, color: "#111827" }}>
                              Profit
                            </div>
                            <div />
                            <div />
                            <div
                              style={{
                                textAlign: "right",
                                fontWeight: 900,
                                color: j.profit >= 0 ? "#16a34a" : "#dc2626",
                              }}
                            >
                              ₹{(j.profit || 0).toLocaleString("en-IN")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                </>
              )}
            {(billsError ||
              jobcardsError ||
              chargersError ||
              sparesError ||
              modelsError ||
              batteriesError) && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#fef2f2",
                  color: "#b91c1c",
                  fontSize: "0.875rem",
                }}
              >
                {[
                  billsError,
                  jobcardsError,
                  chargersError,
                  sparesError,
                  modelsError,
                  batteriesError,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            )}
          </div>
        );
      }
      default:
        return (
          <div className="admin-content">Select a section from the sidebar</div>
        );
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-left">
            <button
              type="button"
              className="admin-menu-btn"
              aria-label="Open menu"
              title="Menu"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              ☰
            </button>
            <h1>Admin Dashboard</h1>
            <p>Dhawan E-Bikes Management System</p>
          </div>
          <div className="admin-header-right">
            <button
              className="btn btn-logout"
              onClick={handleLogout}
              title="Logout"
            >
              Logout
            </button>
            <button
              className="btn btn-back-home"
              onClick={() => handleNavigateOutsideAdmin("/")}
              title="Back to Home"
            >
              Home
            </button>
          </div>
        </div>
      </header>

      <div className="admin-layout">
        {/* Left Sidebar */}
        <div
          className={`admin-sidebar-backdrop ${
            isMobileSidebarOpen ? "open" : ""
          }`}
          onClick={() => setIsMobileSidebarOpen(false)}
        />
        <aside
          className={`admin-sidebar ${isMobileSidebarOpen ? "open" : ""}`}
          aria-label="Admin navigation"
        >
          <div className="sidebar-header">
            <h3>Management</h3>
            <button
              type="button"
              className="admin-sidebar-close"
              aria-label="Close menu"
              title="Close"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              ×
            </button>
          </div>
          <nav className="sidebar-nav">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`sidebar-item ${
                    activeSection === item.id ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveSection(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  style={{ borderLeftColor: item.color }}
                >
                  <Icon
                    className="sidebar-icon"
                    style={{ color: item.color }}
                  />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Working Area */}
        <main className="admin-main">{renderContent()}</main>
      </div>

      <style jsx>{`
        .admin-dashboard {
          min-height: 100vh;
          background: #f8f9fa;
        }

        .admin-header {
          background: white;
          border-bottom: 1px solid #dee2e6;
          padding: 1rem 0;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .admin-header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .admin-header-left h1 {
          margin: 0;
          color: #333;
          font-size: 1.5rem;
        }

        .admin-header-left p {
          margin: 0;
          color: #666;
          font-size: 0.9rem;
        }

        .admin-header-right {
          display: flex;
          gap: 0.5rem;
        }

        .admin-layout {
          display: flex;
          width: 100%;
          min-height: calc(100vh - 80px);
        }

        .admin-menu-btn {
          display: none;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #111827;
          cursor: pointer;
          font-size: 1.25rem;
          line-height: 1;
        }

        .admin-sidebar {
          width: 250px;
          background: white;
          border-right: 1px solid #dee2e6;
          box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
        }

        .sidebar-header {
          padding: 1.5rem 1rem;
          border-bottom: 1px solid #dee2e6;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-header h3 {
          margin: 0;
          color: #333;
          font-size: 1.1rem;
        }

        .admin-sidebar-close {
          display: none;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #111827;
          cursor: pointer;
          font-size: 1.25rem;
          line-height: 1;
        }

        .admin-sidebar-backdrop {
          display: none;
        }

        .sidebar-nav {
          padding: 1rem 0;
        }

        .sidebar-item {
          width: 100%;
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s;
          border-left: 3px solid transparent;
          gap: 0.75rem;
        }

        .sidebar-item:hover {
          background: #f8f9fa;
        }

        .sidebar-item.active {
          background: #f8f9fa;
          font-weight: 600;
        }

        .sidebar-icon {
          font-size: 1.1rem;
        }

        .admin-main {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
          max-height: calc(100vh - 80px);
        }

        /* Mobile: turn sidebar into a drawer */
        @media (max-width: 768px) {
          .admin-header-content {
            padding: 0 1rem;
          }

          .admin-header-left {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            min-width: 0;
          }

          .admin-header-left h1 {
            font-size: 1.2rem;
          }

          .admin-header-left p {
            display: none;
          }

          .admin-menu-btn {
            display: inline-flex;
          }

          .admin-layout {
            display: block;
            min-height: auto;
          }

          .admin-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            width: min(78vw, 280px);
            transform: translateX(-110%);
            transition: transform 0.25s ease;
            z-index: 10020;
          }

          .admin-sidebar.open {
            transform: translateX(0);
          }

          .admin-sidebar-close {
            display: inline-flex;
          }

          .admin-sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.45);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
            z-index: 10010;
          }

          .admin-sidebar-backdrop.open {
            opacity: 1;
            pointer-events: auto;
          }

          .admin-main {
            padding: 1rem;
            max-height: none;
            overflow: visible;
          }

          /* Finance: keep total profit aligned left on mobile */
          .finance-jobcards-profit-header {
            flex-direction: row;
            align-items: flex-start;
          }

          .finance-profit-summary {
            width: auto;
            margin-left: auto;
            text-align: right !important;
          }
        }

        .admin-content h2 {
          margin: 0 0 1.5rem 0;
          color: #333;
          font-size: 1.5rem;
        }

        .admin-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .admin-card {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          border-left: 4px solid #007bff;
        }

        .admin-card h3 {
          margin: 0 0 0.5rem 0;
          color: #666;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .card-number {
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          font-weight: bold;
          color: #333;
        }

        .admin-card small {
          color: #999;
          font-size: 0.8rem;
        }

        .admin-actions {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover {
          background: #0056b3;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover {
          background: #545b62;
        }

        .btn-info {
          background: #17a2b8;
          color: white;
        }

        .btn-info:hover {
          background: #138496;
        }

        .btn-success {
          background: #28a745;
          color: white;
        }

        .btn-success:hover {
          background: #218838;
        }

        .btn-logout {
          background: #dc3545;
          color: white;
        }

        .btn-logout:hover {
          background: #c82333;
        }

        .btn-back-home {
          background: #28a745;
          color: white;
        }

        .btn-back-home:hover {
          background: #218838;
        }
      `}</style>
    </div>
  );
}
