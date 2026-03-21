import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SparePartsSearch from "../../components/SparePartsSearch";
import DatePicker from "../../components/DatePicker";

// Helper function to check if a value is a valid MongoDB ObjectId
const isValidObjectId = (id) => {
  if (!id) return false;
  // If it's already an ObjectId object, it's valid
  if (id.toString && typeof id.toString === "function") {
    const idStr = id.toString();
    return /^[0-9a-fA-F]{24}$/.test(idStr);
  }
  // If it's a string, check if it's 24 hex characters
  if (typeof id === "string") {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
  return false;
};

/** Voltages used for old-charger inventory entries (matches Old chargers page). */
const OLD_CHARGER_SALE_VOLTAGES = ["48V", "60V", "72V"];

function buildOldChargerVoltageStatsFromEntries(entries) {
  const voltages = ["48V", "60V", "72V", "Other"];
  const stats = {};
  voltages.forEach((v) => {
    stats[v] = { total: 0, working: 0, notWorking: 0 };
  });
  for (const charger of entries) {
    let v = charger.voltage;
    if (!v || !stats[v]) v = "Other";
    stats[v].total += 1;
    if (charger.status === "working") stats[v].working += 1;
  }
  voltages.forEach((v) => {
    stats[v].notWorking = stats[v].total - stats[v].working;
  });
  return stats;
}

/** Same merge as OldChargers.jsx: use saved summary unless all zero, then use entries. */
function mergeOldChargerStockStats(entries, summaryData) {
  const computed = buildOldChargerVoltageStatsFromEntries(entries);
  const volts = ["48V", "60V", "72V", "Other"];
  const allZero = volts.every(
    (v) =>
      (summaryData[v]?.total ?? 0) === 0 &&
      (summaryData[v]?.working ?? 0) === 0 &&
      (summaryData[v]?.notWorking ?? 0) === 0
  );
  if (allZero) return computed;
  return {
    "48V": summaryData["48V"] || { total: 0, working: 0, notWorking: 0 },
    "60V": summaryData["60V"] || { total: 0, working: 0, notWorking: 0 },
    "72V": summaryData["72V"] || { total: 0, working: 0, notWorking: 0 },
    Other: summaryData.Other || { total: 0, working: 0, notWorking: 0 },
  };
}

export default function NewJobcard() {
  const navigate = useNavigate();
  const location = useLocation();
  const editJobcard = location.state?.editJobcard || null;
  const isEditMode = Boolean(editJobcard && editJobcard._id);

  // Active tab for adding parts (can be service, replacement, or sales)
  const [activeTab, setActiveTab] = useState(null); // null, "service", "replacement", or "sales"

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  // Form state
  const [formData, setFormData] = useState({
    customerName: "",
    place: "",
    mobile: "",
    charger: "no",
    date: today, // Default to today's date
    warrantyType: "none",
    warrantyDate: "",
    ebikeDetails: "",
    mechanic: "",
    billNo: "",
    details: [], // Changed to array for tags
  });

  const [detailInput, setDetailInput] = useState(""); // Input field for adding details

  // Store parts by type
  const [selectedParts, setSelectedParts] = useState({
    service: [],
    replacement: [],
    sales: [],
  });
  const [showSearch, setShowSearch] = useState(false);
  const [showCustomSpare, setShowCustomSpare] = useState(false);
  const [customSpareData, setCustomSpareData] = useState({
    name: "",
    price: "",
    quantity: "1", // keep as string so user can freely type / backspace
    color: "",
  });
  const [validationError, setValidationError] = useState("");
  const errorRef = useRef(null);

  // Replacement item type state (battery, charger, controller, motor)
  const [selectedReplacementType, setSelectedReplacementType] = useState(null);

  // Sales item type state (battery, charger, oldScooty, spare)
  const [selectedSalesType, setSelectedSalesType] = useState(null);

  // Battery and Charger states
  const [batteries, setBatteries] = useState([]);
  const [chargers, setChargers] = useState([]);
  const [selectedBattery, setSelectedBattery] = useState(null);
  const [selectedCharger, setSelectedCharger] = useState(null);
  const [batteryQuantity, setBatteryQuantity] = useState("1");
  const [replacementBatteryType, setReplacementBatteryType] = useState(""); // "lead" | "lithium"
  const [chargerQuantity, setChargerQuantity] = useState("1");
  const [replacementChargerBatteryType, setReplacementChargerBatteryType] =
    useState(""); // "lead" | "lithium"
  const [batteryReplacementFromCompany, setBatteryReplacementFromCompany] =
    useState(false);
  const [chargerReplacementFromCompany, setChargerReplacementFromCompany] =
    useState(false);
  const [oldChargerName, setOldChargerName] = useState("");
  const [oldChargerVoltage, setOldChargerVoltage] = useState("");
  const [oldChargerVoltageOption, setOldChargerVoltageOption] = useState(""); // "48V" | "60V" | "72V" | "other"
  const [oldChargerVoltageOther, setOldChargerVoltageOther] = useState("");
  const [loadingBatteries, setLoadingBatteries] = useState(false);
  const [loadingChargers, setLoadingChargers] = useState(false);

  // Sales states
  const [salesBattery, setSalesBattery] = useState(null);
  const [salesCharger, setSalesCharger] = useState(null);
  const [salesBatteryQuantity, setSalesBatteryQuantity] = useState("1");
  const [salesChargerQuantity, setSalesChargerQuantity] = useState("1");
  const [salesChargerWarrantyStatus, setSalesChargerWarrantyStatus] =
    useState("noWarranty");
  const [salesChargerOldChargerAvailable, setSalesChargerOldChargerAvailable] =
    useState(false);
  const [salesChargerOldChargerVoltage, setSalesChargerOldChargerVoltage] =
    useState("");
  const [
    salesChargerOldChargerVoltageOption,
    setSalesChargerOldChargerVoltageOption,
  ] = useState(""); // "48V" | "60V" | "72V" | "other"
  const [
    salesChargerOldChargerVoltageOther,
    setSalesChargerOldChargerVoltageOther,
  ] = useState("");
  const [salesChargerOldChargerWorking, setSalesChargerOldChargerWorking] =
    useState("working");
  const [salesBatteryScrapAvailable, setSalesBatteryScrapAvailable] =
    useState(false);
  const [salesBatteryScrapQuantity, setSalesBatteryScrapQuantity] =
    useState("1");
  const [salesBatteryScrapPrice, setSalesBatteryScrapPrice] = useState("800");
  const [salesBatteryWarrantyStatus, setSalesBatteryWarrantyStatus] =
    useState("noWarranty");
  const [salesBatteryOldNew, setSalesBatteryOldNew] = useState(null); // null | "old" | "new" - first step choice
  const [salesChargerOldNew, setSalesChargerOldNew] = useState(null); // null | "old" | "new"
  const [salesChargerBatteryType, setSalesChargerBatteryType] = useState(""); // "" | "lead" | "lithium"
  const [salesOldBatteryName, setSalesOldBatteryName] = useState("");
  const [salesOldBatteryPrice, setSalesOldBatteryPrice] = useState("");
  const [salesOldBatteryQuantity, setSalesOldBatteryQuantity] = useState("1");
  const [salesOldChargerName, setSalesOldChargerName] = useState("");
  const [salesOldChargerPrice, setSalesOldChargerPrice] = useState("");
  const [salesOldChargerType, setSalesOldChargerType] = useState(""); // "lead" | "lithium"
  const [salesOldChargerVoltage, setSalesOldChargerVoltage] = useState("");
  const [salesOldChargerQuantity, setSalesOldChargerQuantity] = useState("1");
  const [
    salesOldChargerOldChargerAvailable,
    setSalesOldChargerOldChargerAvailable,
  ] = useState(false);
  const [
    salesOldChargerOldChargerVoltage,
    setSalesOldChargerOldChargerVoltage,
  ] = useState("");
  const [
    salesOldChargerOldChargerVoltageOption,
    setSalesOldChargerOldChargerVoltageOption,
  ] = useState(""); // "48V" | "60V" | "72V" | "other"
  const [
    salesOldChargerOldChargerVoltageOther,
    setSalesOldChargerOldChargerVoltageOther,
  ] = useState("");
  const [
    salesOldChargerOldChargerWorking,
    setSalesOldChargerOldChargerWorking,
  ] = useState("working"); // "working" | "notWorking"
  /** Per-voltage stock for old charger sales (working count from summary or entries). */
  const [oldChargerStockStats, setOldChargerStockStats] = useState(null);
  const [oldScootyData, setOldScootyData] = useState({
    pmcNo: "",
    name: "",
    price: "",
    quantity: "1",
    batteryChemistry: "lead", // "lead" | "lithium"
    batteryVoltage: "48", // "48" | "60" | "72"
    batteryType: "oldBattery", // "oldBattery" | "newBattery"
    chargerType: "oldCharger",
    chargerChemistry: "lead", // "lead" | "lithium"
    chargerVoltage: "48", // "48" | "60" | "72" — 48V = 4 battery, 60V = 5, 72V = 6
    warrantyStatus: "withoutWarranty", // battery warranty when newBattery
    chargerWarrantyStatus: "noWarranty",
    sparesUsed: [], // [{ spareId, name, quantity, color? }] - spares put in to get it ready
  });
  const [oldScootyPmcLookupLoading, setOldScootyPmcLookupLoading] =
    useState(false);
  const [oldScootyPmcLookupError, setOldScootyPmcLookupError] = useState("");
  const [oldScootySpareName, setOldScootySpareName] = useState("");
  const [oldScootySpareQty, setOldScootySpareQty] = useState("1");
  const [oldScootySpareColor, setOldScootySpareColor] = useState("");
  const [allSparesForOldScooty, setAllSparesForOldScooty] = useState([]);
  const [oldScootySpareSuggestions, setOldScootySpareSuggestions] = useState(
    []
  );
  const [showOldScootySpareSuggestions, setShowOldScootySpareSuggestions] =
    useState(false);
  const [oldScootySpareSelectedIndex, setOldScootySpareSelectedIndex] =
    useState(-1);
  const [selectedSpareForOldScooty, setSelectedSpareForOldScooty] =
    useState(null); // selected spare from dropdown (for spareId)
  const oldScootySpareSuggestionsRef = useRef(null);
  const oldScootySpareInputRef = useRef(null);
  const [oldScootySelectedBattery, setOldScootySelectedBattery] =
    useState(null);
  const [oldScootySelectedCharger, setOldScootySelectedCharger] =
    useState(null);
  const [oldScootyBatteries, setOldScootyBatteries] = useState([]);
  const [oldScootyChargers, setOldScootyChargers] = useState([]);
  const [oldScootyLoadingBatteries, setOldScootyLoadingBatteries] =
    useState(false);
  const [oldScootyLoadingChargers, setOldScootyLoadingChargers] =
    useState(false);

  // Battery search states
  const [batterySearchTerm, setBatterySearchTerm] = useState("");
  const [batterySearchResults, setBatterySearchResults] = useState([]);
  const [showBatterySuggestions, setShowBatterySuggestions] = useState(false);
  const [selectedBatteryIndex, setSelectedBatteryIndex] = useState(-1);
  const batterySearchRef = useRef(null);
  const batteryInputRef = useRef(null);

  // Controller and Motor states
  const [controllerData, setControllerData] = useState({
    name: "",
    price: "",
    quantity: "1",
  });
  const [motorData, setMotorData] = useState({
    name: "",
    price: "",
    quantity: "1",
  });
  // Controller / Motor spare search (replacement tab) - suggestions from spare stock
  const [allSparesForControllerMotor, setAllSparesForControllerMotor] =
    useState([]);
  const [controllerSuggestions, setControllerSuggestions] = useState([]);
  const [controllerSelectedIndex, setControllerSelectedIndex] = useState(-1);
  const [selectedControllerSpare, setSelectedControllerSpare] = useState(null);
  const [motorSuggestions, setMotorSuggestions] = useState([]);
  const [motorSelectedIndex, setMotorSelectedIndex] = useState(-1);
  const [selectedMotorSpare, setSelectedMotorSpare] = useState(null);

  // Prefill form/parts when opened from Pending Jobcards edit action
  useEffect(() => {
    if (!isEditMode || !editJobcard) return;

    setFormData((prev) => ({
      ...prev,
      customerName: editJobcard.customerName || "",
      place: editJobcard.place || "",
      mobile: editJobcard.mobile || "",
      charger: editJobcard.charger === "yes" ? "yes" : "no",
      date: editJobcard.date || today,
      warrantyType: editJobcard.warrantyType || "none",
      warrantyDate: editJobcard.warrantyDate || "",
      ebikeDetails: editJobcard.ebikeDetails || "",
      mechanic: editJobcard.mechanic || "",
      billNo: editJobcard.billNo || "",
      details: Array.isArray(editJobcard.details) ? editJobcard.details : [],
    }));

    setDetailInput("");

    const grouped = { service: [], replacement: [], sales: [] };
    const rawParts = Array.isArray(editJobcard.parts) ? editJobcard.parts : [];

    rawParts.forEach((part, index) => {
      const mappedType =
        part?.partType === "replacement" || part?.partType === "sales"
          ? part.partType
          : "service";

      const resolvedId = part?.isCustom
        ? `custom-${part?._id || index}`
        : typeof part?.spareId === "object" && part?.spareId !== null
        ? part.spareId._id || part.spareId.id || `part-${index}`
        : part?.spareId || `part-${index}`;

      grouped[mappedType].push({
        id: resolvedId,
        name: part?.spareName || "Part",
        price: Number(part?.price || 0),
        selectedQuantity: Number(part?.quantity || 1),
        quantity: Number(part?.quantity || 1),
        inventoryQuantity: Number(part?.quantity || 1),
        selectedColor: part?.selectedColor || null,
        hasColors: Boolean(part?.selectedColor),
        colorQuantity: part?.selectedColor
          ? [
              {
                color: part.selectedColor,
                quantity: Number(part?.quantity || 1),
              },
            ]
          : [],
        availableColors: part?.selectedColor ? [part.selectedColor] : [],
        isCustom: Boolean(part?.isCustom),
        partType: mappedType,
        // Sales-related fields (so Selected Parts shows total price for sales battery)
        salesType: part?.salesType ?? null,
        scrapAvailable: part?.scrapAvailable ?? false,
        scrapQuantity: Number(part?.scrapQuantity || 0),
        scrapPricePerUnit: Number(part?.scrapPricePerUnit || 0),
        batteryOldNew: part?.batteryOldNew ?? null,
        chargerOldNew: part?.chargerOldNew ?? null,
        ampereValue: part?.ampereValue ?? null,
        warrantyStatus: part?.warrantyStatus ?? null,
        // Replacement-related fields
        replacementType: part?.replacementType ?? null,
        replacementFromCompany: part?.replacementFromCompany ?? false,
        batteryType: part?.batteryType ?? null,
        voltage: part?.voltage ?? null,
        oldChargerName: part?.oldChargerName ?? null,
        oldChargerVoltage: part?.oldChargerVoltage ?? null,
        oldChargerAvailable: part?.oldChargerAvailable ?? false,
        oldChargerWorking: part?.oldChargerWorking ?? null,
        // Backend stores price as net per unit (after scrap); don't deduct scrap again in getPartTotal
        priceAlreadyNet: true,
      });
    });

    setSelectedParts(grouped);
    setActiveTab(editJobcard.jobcardType || "service");
    setShowSearch(false);
    setShowCustomSpare(false);
    setSelectedReplacementType(null);
    setSelectedSalesType(null);
  }, [isEditMode, editJobcard, today]);

  // Fetch spare stock for controller/motor suggestions (once)
  useEffect(() => {
    const fetchSparesForControllerMotor = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/spares");
        if (!response.ok) throw new Error("Failed to fetch spares");
        const data = await response.json();
        setAllSparesForControllerMotor(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching spares for controller/motor:", err);
        setAllSparesForControllerMotor([]);
      }
    };

    fetchSparesForControllerMotor();
  }, []);

  // Set warranty date to "NA" when service tab is active and warranty type is "none"
  useEffect(() => {
    if (
      activeTab === "service" &&
      formData.warrantyType === "none" &&
      formData.warrantyDate === ""
    ) {
      setFormData((prev) => ({
        ...prev,
        warrantyDate: "NA",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // If warranty type is changed to "none" (No Warranty)
    if (name === "warrantyType" && value === "none") {
      const replacementHasParts =
        selectedParts.replacement && selectedParts.replacement.length > 0;
      if (replacementHasParts) {
        const confirmed = window.confirm(
          "Replacement section has items. Switching to No Warranty will remove all replacement items from the jobcard. Do you want to continue?"
        );
        if (!confirmed) {
          // Cancel: don't change warranty type (form stays as before, so warranty type is reverted)
          return;
        }
        // OK: clear all replacement entries
        setSelectedParts((prev) => ({
          ...prev,
          replacement: [],
        }));
      }
      setFormData((prev) => ({
        ...prev,
        warrantyType: value,
        warrantyDate: activeTab === "service" ? "NA" : prev.warrantyDate,
      }));
      // Replacement section is disabled when no warranty; switch away from replacement tab if active
      if (activeTab === "replacement") {
        setActiveTab(null);
      }
      return;
    }

    // If warranty type is changed from "none" to something else, clear the "NA" value
    if (
      name === "warrantyType" &&
      value !== "none" &&
      formData.warrantyDate === "NA"
    ) {
      setFormData((prev) => ({
        ...prev,
        warrantyType: value,
        warrantyDate: "",
      }));
      return;
    }

    // Validate mobile number - only allow digits and limit to 10 digits
    if (name === "mobile") {
      const digitsOnly = value.replace(/\D/g, ""); // Remove non-digits
      if (digitsOnly.length <= 10) {
        setFormData((prev) => ({
          ...prev,
          [name]: digitsOnly,
        }));
      }
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNumberInputWheel = (e) => {
    const target = e.target;
    if (target && target.tagName === "INPUT" && target.type === "number") {
      target.blur();
    }
  };

  // Check if mobile number is valid (exactly 10 digits)
  const isMobileValid =
    formData.mobile.trim().length === 10 &&
    /^\d{10}$/.test(formData.mobile.trim());

  // Color mapping function
  const getColorHex = (colorName) => {
    const colorMap = {
      black: "#000000",
      blue: "#0000FF",
      white: "#FFFFFF",
      "white-black": "linear-gradient(45deg, #FFFFFF 50%, #000000 50%)",
      peacock: "#006994",
      green: "#006400",
      cherry: "#8B0000",
      red: "#FF0000",
      grey: "#808080",
      gray: "#808080",
      silver: "#C0C0C0",
      yellow: "#FFFF00",
      orange: "#FFA500",
      purple: "#800080",
      pink: "#FFC0CB",
      brown: "#A52A2A",
    };
    return colorMap[colorName?.toLowerCase()] || "#CCCCCC";
  };

  const handlePartSelect = (part) => {
    const hasColors =
      part.hasColors || (part.colorQuantity && part.colorQuantity.length > 0);

    // Aggregate colors and their quantities from all stock entries
    // This ensures unique colors with total quantities across all entries
    let aggregatedColorQuantity = [];
    if (hasColors && part.colorQuantity && Array.isArray(part.colorQuantity)) {
      const colorMap = new Map();

      // Sum quantities for each unique color (case-insensitive)
      part.colorQuantity.forEach((cq) => {
        if (cq.color) {
          const normalizedColor = String(cq.color).toLowerCase().trim();
          const quantity = parseInt(cq.quantity || 0);

          if (colorMap.has(normalizedColor)) {
            // Add to existing quantity
            const existing = colorMap.get(normalizedColor);
            existing.quantity += quantity;
          } else {
            // Create new entry with original color name (preserve casing)
            colorMap.set(normalizedColor, {
              color: cq.color, // Keep original color name
              quantity: quantity,
            });
          }
        }
      });

      // Convert map to array
      aggregatedColorQuantity = Array.from(colorMap.values());
    }

    const availableColors =
      aggregatedColorQuantity.length > 0
        ? aggregatedColorQuantity.map((cq) => cq.color).filter(Boolean)
        : [];

    // Get initial color quantity if color tracking is enabled
    const initialColor = availableColors.length > 0 ? availableColors[0] : null;
    const initialColorQuantity =
      hasColors && initialColor && aggregatedColorQuantity.length > 0
        ? aggregatedColorQuantity.find((cq) => cq.color === initialColor)
            ?.quantity || 0
        : null;

    // Add part to the active tab's parts list (only if a tab is active)
    if (activeTab) {
      const partData = {
        ...part,
        selectedQuantity: 1,
        inventoryQuantity:
          hasColors && initialColorQuantity !== null
            ? initialColorQuantity
            : part.quantity,
        hasColors: hasColors,
        availableColors: availableColors,
        selectedColor: initialColor,
        colorQuantity: aggregatedColorQuantity, // Store aggregated colorQuantity array
        partType: activeTab, // Tag the part with its type
      };

      // If it's sales tab and spare type is selected, add salesType
      if (activeTab === "sales" && selectedSalesType === "spare") {
        partData.salesType = "spare";
      }

      setSelectedParts((prev) => ({
        ...prev,
        [activeTab]: [partData, ...(prev[activeTab] || [])],
      }));
    }
    // Don't close the search - keep it open so user can add more parts
    // setShowSearch(false);
  };

  // Helper function to get max quantity for a part (color-specific if color is selected)
  const getMaxQuantity = (part) => {
    // Custom spares added directly to a jobcard should not be limited by stock
    if (part.isCustom) {
      return Number.MAX_SAFE_INTEGER;
    }
    if (
      part.hasColors &&
      part.selectedColor &&
      part.colorQuantity &&
      Array.isArray(part.colorQuantity)
    ) {
      // Find color entry (case-insensitive match)
      const colorEntry = part.colorQuantity.find(
        (cq) =>
          String(cq.color).toLowerCase().trim() ===
          String(part.selectedColor).toLowerCase().trim()
      );
      if (colorEntry && colorEntry.quantity !== undefined) {
        return colorEntry.quantity;
      }
    }
    return part.inventoryQuantity || part.quantity || 999;
  };

  // Total for a part (battery sales with scrap: gross - scrap deduction)
  // When part is loaded from saved jobcard, price is already net per unit — do not deduct scrap again.
  const getPartTotal = (part) => {
    const qty = part.selectedQuantity || 1;
    if (part.priceAlreadyNet) {
      return part.price * qty;
    }
    const gross = part.price * qty;
    const hasScrapDeduction =
      part.salesType === "battery" &&
      part.scrapAvailable &&
      part.scrapQuantity > 0 &&
      (part.scrapPricePerUnit ?? 0) > 0;
    const deduction = hasScrapDeduction
      ? part.scrapQuantity * (part.scrapPricePerUnit ?? 0)
      : 0;
    return gross - deduction;
  };

  const handleColorChange = (partId, color, partType) => {
    setSelectedParts((prev) => ({
      ...prev,
      [partType]: prev[partType].map((part) => {
        if (part.id === partId) {
          // If color tracking is enabled, update inventoryQuantity based on selected color
          let newInventoryQuantity = part.quantity;
          if (
            part.hasColors &&
            color &&
            part.colorQuantity &&
            Array.isArray(part.colorQuantity)
          ) {
            // Find color entry (case-insensitive match)
            const colorEntry = part.colorQuantity.find(
              (cq) =>
                String(cq.color).toLowerCase().trim() ===
                String(color).toLowerCase().trim()
            );
            if (colorEntry && colorEntry.quantity !== undefined) {
              newInventoryQuantity = colorEntry.quantity;
            }
          }
          return {
            ...part,
            selectedColor: color,
            inventoryQuantity: newInventoryQuantity,
            // Reset selected quantity to 1 when color changes
            selectedQuantity: 1,
          };
        }
        return part;
      }),
    }));
  };

  const removePart = (partId, partType) => {
    setSelectedParts((prev) => ({
      ...prev,
      [partType]: prev[partType].filter((part) => part.id !== partId),
    }));
  };

  const increaseQuantity = (partId, partType) => {
    setSelectedParts((prev) => ({
      ...prev,
      [partType]: prev[partType].map((part) => {
        if (part.id === partId) {
          const maxQuantity = getMaxQuantity(part);
          const currentSelectedQty = part.selectedQuantity || 1;
          if (currentSelectedQty < maxQuantity) {
            return { ...part, selectedQuantity: currentSelectedQty + 1 };
          }
        }
        return part;
      }),
    }));
  };

  const decreaseQuantity = (partId, partType) => {
    setSelectedParts((prev) => ({
      ...prev,
      [partType]: prev[partType].map((part) => {
        if (part.id === partId) {
          const currentSelectedQty = part.selectedQuantity || 1;
          if (currentSelectedQty > 1) {
            return { ...part, selectedQuantity: currentSelectedQty - 1 };
          }
        }
        return part;
      }),
    }));
  };

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showCustomSpare) setShowCustomSpare(false);
    if (selectedSalesType && selectedSalesType !== "spare")
      setSelectedSalesType(null);
  };

  const toggleCustomSpare = () => {
    setShowCustomSpare(!showCustomSpare);
    if (showSearch) setShowSearch(false);
    if (selectedReplacementType) setSelectedReplacementType(null);
    if (selectedSalesType && selectedSalesType !== "spare")
      setSelectedSalesType(null);
  };

  // Fetch batteries
  const fetchBatteries = async () => {
    setLoadingBatteries(true);
    try {
      const response = await fetch("http://localhost:5000/api/batteries");
      const data = await response.json();
      if (response.ok) {
        const batteriesList = Array.isArray(data) ? data : data.data || [];
        setBatteries(batteriesList);
      }
    } catch (error) {
      console.error("Error fetching batteries:", error);
    } finally {
      setLoadingBatteries(false);
    }
  };

  // Old charger inventory (for sales): only offer voltages with working stock (same logic as Old chargers page)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      try {
        const [entriesRes, summaryRes] = await Promise.all([
          fetch("http://localhost:5000/api/old-chargers", { headers }),
          fetch("http://localhost:5000/api/old-chargers/summary", { headers }),
        ]);
        const entriesJson = entriesRes.ok ? await entriesRes.json() : [];
        const entries = Array.isArray(entriesJson) ? entriesJson : [];
        let summaryData = {};
        if (summaryRes.ok) {
          try {
            summaryData = await summaryRes.json();
          } catch {
            summaryData = {};
          }
        }
        const stats = mergeOldChargerStockStats(entries, summaryData);
        if (!cancelled) setOldChargerStockStats(stats);
      } catch (e) {
        console.error("Error loading old charger stock for sales:", e);
        if (!cancelled)
          setOldChargerStockStats(mergeOldChargerStockStats([], {}));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const oldChargerSaleVoltageOptions = useMemo(() => {
    if (!oldChargerStockStats) return [];
    return OLD_CHARGER_SALE_VOLTAGES.filter(
      (v) => (oldChargerStockStats[v]?.working ?? 0) > 0
    );
  }, [oldChargerStockStats]);

  /** Working units in Old chargers stock for the selected voltage (old charger sale). */
  const oldChargerWorkingInStock = useMemo(() => {
    if (!salesOldChargerVoltage || !oldChargerStockStats) return 0;
    return oldChargerStockStats[salesOldChargerVoltage]?.working ?? 0;
  }, [salesOldChargerVoltage, oldChargerStockStats]);

  const oldChargerSaleAddDisabled = useMemo(() => {
    const q = parseInt(salesOldChargerQuantity, 10) || 0;
    const tradeInBlocked =
      salesOldChargerOldChargerAvailable &&
      !salesOldChargerOldChargerVoltage.trim();
    return (
      !salesOldChargerType ||
      !salesOldChargerVoltage ||
      oldChargerSaleVoltageOptions.length === 0 ||
      q < 1 ||
      (oldChargerWorkingInStock > 0 && q > oldChargerWorkingInStock) ||
      tradeInBlocked
    );
  }, [
    salesOldChargerType,
    salesOldChargerVoltage,
    salesOldChargerQuantity,
    oldChargerSaleVoltageOptions.length,
    oldChargerWorkingInStock,
    salesOldChargerOldChargerAvailable,
    salesOldChargerOldChargerVoltage,
  ]);

  useEffect(() => {
    if (!oldChargerStockStats || !salesOldChargerVoltage) return;
    const working = oldChargerStockStats[salesOldChargerVoltage]?.working ?? 0;
    if (
      OLD_CHARGER_SALE_VOLTAGES.includes(salesOldChargerVoltage) &&
      working <= 0
    ) {
      setSalesOldChargerVoltage("");
    }
  }, [oldChargerStockStats, salesOldChargerVoltage]);

  // Search batteries by name
  useEffect(() => {
    if (batterySearchTerm.trim() === "") {
      setBatterySearchResults([]);
      setShowBatterySuggestions(false);
      return;
    }

    const filtered = batteries.filter((battery) =>
      battery.name?.toLowerCase().includes(batterySearchTerm.toLowerCase())
    );

    setBatterySearchResults(filtered.slice(0, 10)); // Limit to 10 results
    setShowBatterySuggestions(filtered.length > 0);
    setSelectedBatteryIndex(-1);
  }, [batterySearchTerm, batteries]);

  // Handle click outside battery search
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        batterySearchRef.current &&
        !batterySearchRef.current.contains(event.target)
      ) {
        setShowBatterySuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation for battery search
  const handleBatteryKeyDown = (e) => {
    if (!showBatterySuggestions || batterySearchResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedBatteryIndex((prev) =>
        prev < batterySearchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedBatteryIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedBatteryIndex >= 0) {
      e.preventDefault();
      handleBatterySelect(batterySearchResults[selectedBatteryIndex]);
    }
  };

  // Handle battery selection from search
  const handleBatterySelect = (battery) => {
    setSelectedBattery(battery);
    setBatterySearchTerm(battery.name);
    setShowBatterySuggestions(false);
    setBatterySearchResults([]);
    setSelectedBatteryIndex(-1);
  };

  // Fetch chargers
  const fetchChargers = async () => {
    setLoadingChargers(true);
    try {
      const response = await fetch("http://localhost:5000/api/chargers");
      const data = await response.json();
      if (response.ok) {
        setChargers(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching chargers:", error);
    } finally {
      setLoadingChargers(false);
    }
  };

  // Handle replacement type selection
  const handleReplacementTypeClick = (type) => {
    setSelectedReplacementType(type);
    setShowSearch(false);
    setShowCustomSpare(false);

    if (type === "battery") {
      fetchBatteries();
      setSelectedBattery(null);
    } else if (type === "charger") {
      fetchChargers();
    }
  };

  const handleSalesTypeClick = (type) => {
    setSelectedSalesType(type);
    setSelectedReplacementType(null);
    // Reset Battery/Charger sub-forms so they show Old/New choice again when reopened
    setSalesBatteryOldNew(null);
    setSalesChargerOldNew(null);

    // Only close search/custom spare if switching away from spare
    if (type !== "spare") {
      setShowSearch(false);
      setShowCustomSpare(false);
    }

    if (type === "battery") {
      fetchBatteries();
      setSalesBattery(null);
    } else if (type === "charger") {
      fetchChargers();
      setSalesCharger(null);
    }
  };

  // Handle adding battery to jobcard
  const handleAddBattery = () => {
    if (!replacementBatteryType) {
      alert("Please select battery type (Lead or Lithium)");
      return;
    }

    if (!selectedBattery) {
      alert("Please select a battery from stock");
      return;
    }
    const qty = parseInt(batteryQuantity) || 1;
    if (qty <= 0) {
      alert("Quantity must be at least 1");
      return;
    }

    // Extract ampereValue, handling empty strings and null/undefined
    const ampereValue =
      selectedBattery.ampereValue &&
      typeof selectedBattery.ampereValue === "string" &&
      selectedBattery.ampereValue.trim() !== ""
        ? selectedBattery.ampereValue.trim()
        : selectedBattery.ampereValue && selectedBattery.ampereValue !== ""
        ? String(selectedBattery.ampereValue)
        : null;

    // Calculate price per individual battery
    // sellingPrice is for a battery set, so divide by batteriesPerSet to get price per battery
    const batteriesPerSet = selectedBattery.batteriesPerSet || 1;
    const sellingPricePerSet = selectedBattery.sellingPrice || 0;
    const pricePerBattery =
      batteriesPerSet > 0
        ? sellingPricePerSet / batteriesPerSet
        : sellingPricePerSet;

    const batteryPart = {
      id: selectedBattery._id,
      name: selectedBattery.name,
      price: pricePerBattery, // Price per individual battery
      selectedQuantity: qty, // Quantity is number of individual batteries
      hasColors: false,
      isCustom: false,
      partType: "replacement",
      replacementType: "battery",
      batteryType: replacementBatteryType,
      ampereValue: ampereValue,
      replacementFromCompany: batteryReplacementFromCompany,
    };

    setSelectedParts((prev) => ({
      ...prev,
      replacement: [batteryPart, ...(prev.replacement || [])],
    }));

    // Reset form
    setSelectedBattery(null);
    setBatteryQuantity("1");
    setReplacementBatteryType("");
    setBatteryReplacementFromCompany(false);
    setSelectedReplacementType(null);
  };

  // Handle adding charger to jobcard
  const handleAddCharger = () => {
    if (!replacementChargerBatteryType) {
      alert("Please select battery type (Lead or Lithium)");
      return;
    }

    if (!selectedCharger) {
      alert("Please select a charger from stock");
      return;
    }
    if (!oldChargerName.trim()) {
      alert("Please enter the old charger name");
      return;
    }
    if (!oldChargerVoltage.trim()) {
      alert("Please enter the old charger voltage");
      return;
    }
    const qty = parseInt(chargerQuantity) || 1;
    if (qty <= 0) {
      alert("Quantity must be at least 1");
      return;
    }

    const chargerPart = {
      id: selectedCharger._id,
      name: selectedCharger.name,
      price: selectedCharger.sellingPrice || 0,
      selectedQuantity: qty,
      hasColors: false,
      isCustom: false,
      partType: "replacement",
      replacementType: "charger",
      batteryType: replacementChargerBatteryType,
      voltage: selectedCharger.voltage || null,
      replacementFromCompany: chargerReplacementFromCompany,
      oldChargerName: oldChargerName.trim() || null,
      oldChargerVoltage: oldChargerVoltage.trim() || null,
    };

    setSelectedParts((prev) => ({
      ...prev,
      replacement: [chargerPart, ...(prev.replacement || [])],
    }));

    // Reset form
    setSelectedCharger(null);
    setChargerQuantity("1");
    setReplacementChargerBatteryType("");
    setChargerReplacementFromCompany(false);
    setOldChargerName("");
    setOldChargerVoltage("");
    setSelectedReplacementType(null);
  };

  // Handle adding controller to jobcard
  const handleAddController = () => {
    const name = controllerData.name.trim();
    if (!name) {
      alert("Please enter controller name (search from stock)");
      return;
    }
    if (!controllerData.price || parseFloat(controllerData.price) <= 0) {
      alert("Please enter a valid price");
      return;
    }
    const qty = parseInt(controllerData.quantity) || 1;
    if (qty <= 0) {
      alert("Quantity must be at least 1");
      return;
    }

    const controllerPart = {
      id: selectedControllerSpare?._id || `controller-${Date.now()}`,
      spareId: selectedControllerSpare?._id || null,
      name,
      price: parseFloat(controllerData.price),
      selectedQuantity: qty,
      hasColors: false,
      isCustom: !selectedControllerSpare,
      partType: "replacement",
      replacementType: "controller",
    };

    setSelectedParts((prev) => ({
      ...prev,
      replacement: [controllerPart, ...(prev.replacement || [])],
    }));

    // Reset form
    setControllerData({ name: "", price: "", quantity: "1" });
    setSelectedControllerSpare(null);
    setControllerSuggestions([]);
    setShowControllerSuggestions(false);
    setSelectedReplacementType(null);
  };

  // Handle adding motor to jobcard
  const handleAddMotor = () => {
    const name = motorData.name.trim();
    if (!name) {
      alert("Please enter motor name (search from stock)");
      return;
    }
    if (!motorData.price || parseFloat(motorData.price) <= 0) {
      alert("Please enter a valid price");
      return;
    }
    const qty = parseInt(motorData.quantity) || 1;
    if (qty <= 0) {
      alert("Quantity must be at least 1");
      return;
    }

    const motorPart = {
      id: selectedMotorSpare?._id || `motor-${Date.now()}`,
      spareId: selectedMotorSpare?._id || null,
      name,
      price: parseFloat(motorData.price),
      selectedQuantity: qty,
      hasColors: false,
      isCustom: !selectedMotorSpare,
      partType: "replacement",
      replacementType: "motor",
    };

    setSelectedParts((prev) => ({
      ...prev,
      replacement: [motorPart, ...(prev.replacement || [])],
    }));

    // Reset form
    setMotorData({ name: "", price: "", quantity: "1" });
    setSelectedMotorSpare(null);
    setMotorSuggestions([]);
    setShowMotorSuggestions(false);
    setSelectedReplacementType(null);
  };

  // Handle controller name change with suggestions from spare stock
  const handleControllerNameChange = (value) => {
    const name = value;
    setControllerData((prev) => ({
      ...prev,
      name,
    }));

    const term = name.trim().toLowerCase();
    if (!term) {
      setControllerSuggestions([]);
      setSelectedControllerSpare(null);
      setControllerSelectedIndex(-1);
      return;
    }

    const matches = (allSparesForControllerMotor || []).filter((spare) =>
      (spare.name || "").toLowerCase().includes(term)
    );
    const sliced = matches.slice(0, 5);
    setControllerSuggestions(sliced);
    setControllerSelectedIndex(sliced.length > 0 ? 0 : -1);
  };

  const handleSelectControllerSuggestion = (spare) => {
    setSelectedControllerSpare(spare);
    setControllerData((prev) => ({
      ...prev,
      name: spare.name || prev.name,
      price:
        spare.sellingPrice != null
          ? String(spare.sellingPrice)
          : prev.price,
    }));
    setControllerSuggestions([]);
    setControllerSelectedIndex(-1);
  };

  const handleControllerKeyDown = (e) => {
    if (!controllerSuggestions.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setControllerSelectedIndex((prev) => {
        if (prev === -1 || prev === controllerSuggestions.length - 1) {
          return 0; // wrap to first
        }
        return prev + 1;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setControllerSelectedIndex((prev) => {
        if (prev <= 0) {
          return controllerSuggestions.length - 1; // wrap to last
        }
        return prev - 1;
      });
    } else if (e.key === "Enter") {
      if (controllerSelectedIndex >= 0 &&
          controllerSelectedIndex < controllerSuggestions.length) {
        e.preventDefault();
        handleSelectControllerSuggestion(
          controllerSuggestions[controllerSelectedIndex]
        );
      }
    } else if (e.key === "Escape") {
      setControllerSuggestions([]);
      setControllerSelectedIndex(-1);
    }
  };

  // Handle motor name change with suggestions from spare stock
  const handleMotorNameChange = (value) => {
    const name = value;
    setMotorData((prev) => ({
      ...prev,
      name,
    }));

    const term = name.trim().toLowerCase();
    if (!term) {
      setMotorSuggestions([]);
      setSelectedMotorSpare(null);
      setMotorSelectedIndex(-1);
      return;
    }

    const matches = (allSparesForControllerMotor || []).filter((spare) =>
      (spare.name || "").toLowerCase().includes(term)
    );
    const sliced = matches.slice(0, 5);
    setMotorSuggestions(sliced);
    setMotorSelectedIndex(sliced.length > 0 ? 0 : -1);
  };

  const handleSelectMotorSuggestion = (spare) => {
    setSelectedMotorSpare(spare);
    setMotorData((prev) => ({
      ...prev,
      name: spare.name || prev.name,
      price:
        spare.sellingPrice != null
          ? String(spare.sellingPrice)
          : prev.price,
    }));
    setMotorSuggestions([]);
    setMotorSelectedIndex(-1);
  };

  const handleMotorKeyDown = (e) => {
    if (!motorSuggestions.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMotorSelectedIndex((prev) => {
        if (prev === -1 || prev === motorSuggestions.length - 1) {
          return 0; // wrap to first
        }
        return prev + 1;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMotorSelectedIndex((prev) => {
        if (prev <= 0) {
          return motorSuggestions.length - 1; // wrap to last
        }
        return prev - 1;
      });
    } else if (e.key === "Enter") {
      if (motorSelectedIndex >= 0 &&
          motorSelectedIndex < motorSuggestions.length) {
        e.preventDefault();
        handleSelectMotorSuggestion(motorSuggestions[motorSelectedIndex]);
      }
    } else if (e.key === "Escape") {
      setMotorSuggestions([]);
      setMotorSelectedIndex(-1);
    }
  };

  // Handle adding sales battery
  const handleAddSalesBattery = () => {
    if (!salesBattery) {
      alert("Please select a battery");
      return;
    }
    const qty = parseInt(salesBatteryQuantity) || 1;
    if (qty <= 0) {
      alert("Quantity must be at least 1");
      return;
    }

    // Price per battery = sellingPrice / batteriesPerSet
    const pricePerBattery =
      salesBattery.sellingPrice && salesBattery.batteriesPerSet
        ? salesBattery.sellingPrice / salesBattery.batteriesPerSet
        : salesBattery.sellingPrice || 0;

    const batteryPart = {
      id: salesBattery._id,
      name: salesBattery.name,
      price: pricePerBattery,
      selectedQuantity: qty,
      hasColors: false,
      isCustom: false,
      partType: "sales",
      salesType: "battery",
      batteryOldNew: "new",
      ampereValue: salesBattery.ampereValue || null,
      scrapAvailable: salesBatteryScrapAvailable,
      scrapQuantity: salesBatteryScrapAvailable
        ? parseInt(salesBatteryScrapQuantity, 10) || 1
        : 0,
      scrapPricePerUnit: salesBatteryScrapAvailable
        ? parseFloat(salesBatteryScrapPrice) || 0
        : 0,
      warrantyStatus: salesBatteryWarrantyStatus,
    };

    setSelectedParts((prev) => ({
      ...prev,
      sales: [batteryPart, ...(prev.sales || [])],
    }));

    // Reset form
    setSalesBattery(null);
    setSalesBatteryQuantity("1");
    setSalesBatteryScrapAvailable(false);
    setSalesBatteryScrapQuantity("1");
    setSalesBatteryScrapPrice("800");
    setSalesBatteryWarrantyStatus("noWarranty");
    setSalesBatteryOldNew(null);
    setSelectedSalesType(null);
  };

  const handleAddSalesOldBattery = () => {
    const qty = parseInt(salesOldBatteryQuantity, 10) || 1;
    if (qty <= 0) {
      alert("Quantity must be at least 1");
      return;
    }
    const enteredTotalPrice = parseFloat(salesOldBatteryPrice);
    if (isNaN(enteredTotalPrice) || enteredTotalPrice < 0) {
      alert("Please enter a valid total price");
      return;
    }
    // Old battery price input is total for entered quantity.
    const unitPrice = qty > 0 ? enteredTotalPrice / qty : 0;
    const part = {
      id: `old-battery-${Date.now()}`,
      name: "Old Battery",
      price: unitPrice,
      selectedQuantity: qty,
      hasColors: false,
      isCustom: true,
      partType: "sales",
      salesType: "battery",
      batteryOldNew: "old",
      scrapAvailable: salesBatteryScrapAvailable,
      scrapQuantity: salesBatteryScrapAvailable
        ? parseInt(salesBatteryScrapQuantity, 10) || 1
        : 0,
      // Old battery scrap tracks quantity only; no per-scrap deduction price.
      scrapPricePerUnit: 0,
    };
    setSelectedParts((prev) => ({
      ...prev,
      sales: [part, ...(prev.sales || [])],
    }));
    setSalesOldBatteryPrice("");
    setSalesOldBatteryQuantity("1");
    setSalesBatteryScrapAvailable(false);
    setSalesBatteryScrapQuantity("1");
    setSalesBatteryScrapPrice("800");
    setSalesBatteryOldNew(null);
    setSelectedSalesType(null);
  };

  // Handle adding sales charger
  const getSalesChargerPrice = (warrantyStatus, fallbackPrice = 0) => {
    if (warrantyStatus === "noWarranty") return 1100;
    if (warrantyStatus === "6months") return 1600;
    return fallbackPrice; // keep existing behavior for any other warranty option
  };

  const handleAddSalesCharger = () => {
    if (!salesCharger) {
      alert("Please select a charger");
      return;
    }
    if (
      salesChargerOldChargerAvailable &&
      !salesChargerOldChargerVoltage.trim()
    ) {
      alert("Please enter the old charger voltage");
      return;
    }
    const qty = parseInt(salesChargerQuantity) || 1;
    if (qty <= 0) {
      alert("Quantity must be at least 1");
      return;
    }

    const chargerPart = {
      id: salesCharger._id,
      name: salesCharger.name,
      price: getSalesChargerPrice(
        salesChargerWarrantyStatus,
        salesCharger.sellingPrice || 0
      ),
      selectedQuantity: qty,
      hasColors: false,
      isCustom: false,
      partType: "sales",
      salesType: "charger",
      chargerOldNew: "new",
      batteryType: salesCharger.batteryType || null,
      voltage: salesCharger.voltage || null,
      warrantyStatus: salesChargerWarrantyStatus,
      oldChargerAvailable: salesChargerOldChargerAvailable,
      oldChargerVoltage: salesChargerOldChargerAvailable
        ? salesChargerOldChargerVoltage.trim() || null
        : null,
      oldChargerWorking: salesChargerOldChargerAvailable
        ? salesChargerOldChargerWorking
        : null,
    };

    setSelectedParts((prev) => ({
      ...prev,
      sales: [chargerPart, ...(prev.sales || [])],
    }));

    // Reset form
    setSalesCharger(null);
    setSalesChargerQuantity("1");
    setSalesChargerWarrantyStatus("noWarranty");
    setSalesChargerOldChargerAvailable(false);
    setSalesChargerOldChargerVoltage("");
    setSalesChargerOldChargerWorking("working");
    setSalesChargerOldNew(null);
    setSelectedSalesType(null);
  };

  const handleAddSalesOldCharger = () => {
    if (!salesOldChargerType) {
      alert("Please select charger type (Lead or Lithium)");
      return;
    }
    const voltage = salesOldChargerVoltage.trim();
    if (!voltage) {
      alert("Please select charger voltage");
      return;
    }
    if (!OLD_CHARGER_SALE_VOLTAGES.includes(voltage)) {
      alert("Voltage must be 48V, 60V, or 72V");
      return;
    }
    const workingAvail = oldChargerStockStats?.[voltage]?.working ?? 0;
    if (workingAvail <= 0) {
      alert(
        "No working stock for this voltage. Add or mark working units in Old chargers."
      );
      return;
    }
    if (
      salesOldChargerOldChargerAvailable &&
      !salesOldChargerOldChargerVoltage.trim()
    ) {
      alert("Please enter the old charger voltage (available charger)");
      return;
    }
    const qty = parseInt(salesOldChargerQuantity, 10) || 1;
    if (qty <= 0) {
      alert("Quantity must be at least 1");
      return;
    }
    if (qty > workingAvail) {
      alert(
        `Quantity cannot exceed working stock for ${voltage}. In stock: ${workingAvail}.`
      );
      return;
    }
    const price = parseFloat(salesOldChargerPrice);
    if (isNaN(price) || price < 0) {
      alert("Please enter a valid price");
      return;
    }
    const part = {
      id: `old-charger-${Date.now()}`,
      name: "Old Charger",
      price,
      selectedQuantity: qty,
      hasColors: false,
      isCustom: true,
      partType: "sales",
      salesType: "charger",
      chargerOldNew: "old",
      batteryType: salesOldChargerType,
      voltage: voltage || null,
      oldChargerAvailable: salesOldChargerOldChargerAvailable,
      oldChargerVoltage: salesOldChargerOldChargerAvailable
        ? salesOldChargerOldChargerVoltage.trim() || null
        : null,
      oldChargerWorking: salesOldChargerOldChargerAvailable
        ? salesOldChargerOldChargerWorking
        : null,
    };
    setSelectedParts((prev) => ({
      ...prev,
      sales: [part, ...(prev.sales || [])],
    }));
    setSalesOldChargerPrice("");
    setSalesOldChargerType("");
    setSalesOldChargerVoltage("");
    setSalesOldChargerQuantity("1");
    setSalesOldChargerOldChargerAvailable(false);
    setSalesOldChargerOldChargerVoltage("");
    setSalesOldChargerOldChargerVoltageOption("");
    setSalesOldChargerOldChargerVoltageOther("");
    setSalesOldChargerOldChargerWorking("working");
    setSalesChargerOldNew(null);
    setSelectedSalesType(null);
  };

  // Look up old scooty by PMC No. from models section
  const handleOldScootyPmcLookup = async () => {
    const raw = (oldScootyData.pmcNo || "").trim();
    if (!raw) {
      setOldScootyPmcLookupError("Enter PMC No. to fetch details");
      return;
    }
    const normalizedInput = raw.replace(/^PMC-?/i, "").trim();
    if (!normalizedInput) {
      setOldScootyPmcLookupError("Enter a valid PMC No.");
      return;
    }
    setOldScootyPmcLookupError("");
    setOldScootyPmcLookupLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/old-scooties");
      if (!res.ok) throw new Error("Failed to fetch old scooties");
      const list = await res.json();
      const match = (Array.isArray(list) ? list : []).find((item) => {
        const stored = (item.pmcNo || "").trim();
        const normalizedStored = stored.replace(/^PMC-?/i, "").trim();
        return (
          normalizedStored &&
          normalizedStored.toLowerCase() === normalizedInput.toLowerCase()
        );
      });
      if (!match) {
        setOldScootyPmcLookupError("No old scooty found with this PMC No.");
        return;
      }
      // Load spares used to get ready from the old scooty in models (if present)
      const loadedSpares =
        Array.isArray(match.sparesUsed) && match.sparesUsed.length > 0
          ? match.sparesUsed.map((s) => ({
              spareId:
                s.spareId != null
                  ? s.spareId._id
                    ? String(s.spareId._id)
                    : String(s.spareId)
                  : null,
              name: (s.name || "").trim(),
              quantity:
                typeof s.quantity === "number"
                  ? s.quantity
                  : parseInt(s.quantity, 10) || 1,
              color: (s.color && String(s.color).trim()) || "",
            }))
          : [];
      setOldScootyData((prev) => ({
        ...prev,
        name: match.name || prev.name,
        sparesUsed: loadedSpares,
      }));
    } catch (err) {
      console.error("PMC lookup error:", err);
      setOldScootyPmcLookupError(err.message || "Failed to fetch details");
    } finally {
      setOldScootyPmcLookupLoading(false);
    }
  };

  // Handle adding old scooty
  const handleAddOldScooty = () => {
    if (!oldScootyData.name.trim()) {
      alert("Please enter old scooty name");
      return;
    }
    if (!oldScootyData.price || parseFloat(oldScootyData.price) <= 0) {
      alert("Please enter a valid price");
      return;
    }
    if (
      oldScootyData.batteryType === "newBattery" &&
      !oldScootySelectedBattery
    ) {
      alert("Please select a battery from the list");
      return;
    }
    if (
      oldScootyData.chargerType === "newCharger" &&
      !oldScootySelectedCharger
    ) {
      alert("Please select a charger from the list");
      return;
    }
    const oldScootyPart = {
      id: `oldScooty-${Date.now()}`,
      pmcNo: (oldScootyData.pmcNo || "").trim(),
      name: oldScootyData.name.trim(),
      price: parseFloat(oldScootyData.price),
      selectedQuantity: 1,
      hasColors: false,
      isCustom: true,
      partType: "sales",
      salesType: "oldScooty",
      batteryChemistry: oldScootyData.batteryChemistry,
      batteryVoltage: oldScootyData.batteryVoltage,
      batteryType: oldScootyData.batteryType,
      batteryName:
        oldScootyData.batteryType === "newBattery" && oldScootySelectedBattery
          ? oldScootySelectedBattery.name
          : null,
      warrantyStatus:
        oldScootyData.batteryType === "newBattery"
          ? oldScootyData.warrantyStatus
          : null,
      chargerType: oldScootyData.chargerType,
      chargerName:
        oldScootyData.chargerType === "newCharger" && oldScootySelectedCharger
          ? oldScootySelectedCharger.name
          : null,
      chargerChemistry: oldScootyData.chargerChemistry,
      chargerVoltage: oldScootyData.chargerVoltage,
      chargerWarrantyStatus:
        oldScootyData.chargerType === "newCharger"
          ? oldScootyData.chargerWarrantyStatus
          : null,
      sparesUsed: (oldScootyData.sparesUsed || []).map((s) => ({
        spareId: s.spareId || null,
        name: (s.name || "").trim(),
        quantity:
          typeof s.quantity === "number"
            ? s.quantity
            : parseInt(s.quantity, 10) || 1,
        color: s.color ? String(s.color).trim() : "",
      })),
    };

    setSelectedParts((prev) => ({
      ...prev,
      sales: [oldScootyPart, ...(prev.sales || [])],
    }));

    // Reset form
    setOldScootyData({
      pmcNo: "",
      name: "",
      price: "",
      quantity: "1",
      batteryChemistry: "lead",
      batteryVoltage: "48",
      batteryType: "oldBattery",
      chargerType: "oldCharger",
      chargerChemistry: "lead",
      chargerVoltage: "48",
      warrantyStatus: "withoutWarranty",
      chargerWarrantyStatus: "noWarranty",
      sparesUsed: [],
    });
    setOldScootySpareName("");
    setOldScootySpareQty("1");
    setOldScootySpareColor("");
    setOldScootyPmcLookupError("");
    setOldScootySelectedBattery(null);
    setOldScootySelectedCharger(null);
    setSelectedSalesType(null);
  };

  // Fetch spares when old scooty form is open (for spare name suggestions)
  useEffect(() => {
    if (activeTab !== "sales" || selectedSalesType !== "oldScooty") return;
    const fetchSpares = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/spares");
        if (!response.ok) throw new Error("Failed to fetch spares");
        const data = await response.json();
        setAllSparesForOldScooty(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching spares for old scooty:", err);
        setAllSparesForOldScooty([]);
      }
    };
    fetchSpares();
  }, [activeTab, selectedSalesType]);

  // Fetch batteries and chargers when old scooty form is open (for new battery/charger selection)
  useEffect(() => {
    if (activeTab !== "sales" || selectedSalesType !== "oldScooty") return;
    const loadBatteries = async () => {
      setOldScootyLoadingBatteries(true);
      try {
        const res = await fetch("http://localhost:5000/api/batteries");
        const data = await res.json();
        if (res.ok)
          setOldScootyBatteries(Array.isArray(data) ? data : data.data || []);
      } catch (err) {
        console.error("Error fetching batteries for old scooty:", err);
        setOldScootyBatteries([]);
      } finally {
        setOldScootyLoadingBatteries(false);
      }
    };
    const loadChargers = async () => {
      setOldScootyLoadingChargers(true);
      try {
        const res = await fetch("http://localhost:5000/api/chargers");
        const data = await res.json();
        if (res.ok)
          setOldScootyChargers(Array.isArray(data) ? data : data.data || []);
      } catch (err) {
        console.error("Error fetching chargers for old scooty:", err);
        setOldScootyChargers([]);
      } finally {
        setOldScootyLoadingChargers(false);
      }
    };
    loadBatteries();
    loadChargers();
  }, [activeTab, selectedSalesType]);

  // Filter spare suggestions when user types in spare name
  useEffect(() => {
    const term = oldScootySpareName.trim().toLowerCase();
    if (!term) {
      setOldScootySpareSuggestions([]);
      setShowOldScootySpareSuggestions(false);
      return;
    }
    const filtered = allSparesForOldScooty.filter(
      (s) =>
        s.name?.toLowerCase().includes(term) ||
        s.supplierName?.toLowerCase().includes(term)
    );
    const sliced = filtered.slice(0, 3);
    setOldScootySpareSuggestions(sliced);
    // Don't show suggestions when input exactly matches any suggestion (user just selected it)
    const exactMatch = sliced.some(
      (s) => s.name?.trim().toLowerCase() === term
    );
    setShowOldScootySpareSuggestions(sliced.length > 0 && !exactMatch);
    setOldScootySpareSelectedIndex(-1);
  }, [oldScootySpareName, allSparesForOldScooty]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        oldScootySpareSuggestionsRef.current &&
        !oldScootySpareSuggestionsRef.current.contains(e.target)
      ) {
        setShowOldScootySpareSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddOldScootySpare = () => {
    const name = oldScootySpareName.trim();
    if (!name) return;
    const qty = parseInt(oldScootySpareQty, 10) || 1;
    if (qty <= 0) return;
    const spareId = selectedSpareForOldScooty?._id || null;
    const hasColors =
      selectedSpareForOldScooty?.hasColors &&
      (selectedSpareForOldScooty?.colorQuantity?.length || 0) > 0;
    const color = hasColors ? oldScootySpareColor || "" : "";
    setOldScootyData((prev) => ({
      ...prev,
      sparesUsed: [
        ...(prev.sparesUsed || []),
        { spareId, name, quantity: qty, color },
      ],
    }));
    setOldScootySpareName("");
    setOldScootySpareQty("1");
    setOldScootySpareColor("");
    setSelectedSpareForOldScooty(null);
  };

  const selectOldScootySpareSuggestion = (spare) => {
    setOldScootySpareName(spare.name || "");
    setSelectedSpareForOldScooty(spare);
    const firstColor =
      spare?.hasColors && spare?.colorQuantity?.length
        ? spare.colorQuantity[0]?.color || ""
        : "";
    setOldScootySpareColor(firstColor);
    setShowOldScootySpareSuggestions(false);
    setOldScootySpareSuggestions([]);
    setOldScootySpareSelectedIndex(-1);
  };

  const handleRemoveOldScootySpare = (index) => {
    setOldScootyData((prev) => ({
      ...prev,
      sparesUsed: (prev.sparesUsed || []).filter((_, i) => i !== index),
    }));
  };

  const handleAddCustomSpare = () => {
    if (!customSpareData.name.trim()) {
      alert("Please enter a spare part name");
      return;
    }
    if (!customSpareData.price || parseFloat(customSpareData.price) <= 0) {
      alert("Please enter a valid price");
      return;
    }

    const qtyNumber = parseInt(customSpareData.quantity, 10);
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      alert("Please enter a valid quantity (minimum 1)");
      return;
    }

    const customPart = {
      id: `custom-${Date.now()}`, // Unique ID for custom parts
      name: customSpareData.name.trim(),
      price: parseFloat(customSpareData.price),
      selectedQuantity: qtyNumber,
      hasColors: false,
      selectedColor: customSpareData.color.trim() || null,
      isCustom: true, // Flag to identify custom parts
      partType: activeTab, // Tag the part with its type
    };

    // If it's sales tab and spare type is selected, add salesType
    if (activeTab === "sales" && selectedSalesType === "spare") {
      customPart.salesType = "spare";
    }

    if (activeTab) {
      setSelectedParts((prev) => ({
        ...prev,
        [activeTab]: [customPart, ...(prev[activeTab] || [])],
      }));
    }

    // Reset form
    setCustomSpareData({
      name: "",
      price: "",
      quantity: "1",
      color: "",
    });
    setShowCustomSpare(false);
  };

  const calculateTotal = () => {
    // Total excludes replacement parts (only service + sales count toward jobcard total)
    const partsForTotal = [...selectedParts.service, ...selectedParts.sales];
    return partsForTotal
      .reduce((sum, part) => sum + getPartTotal(part), 0)
      .toFixed(2);
  };

  const handleDetailKeyPress = (e) => {
    if (e.key === "Enter" && detailInput.trim() !== "") {
      e.preventDefault();
      setFormData((prev) => ({
        ...prev,
        details: [...prev.details, detailInput.trim()],
      }));
      setDetailInput("");
    }
  };

  const removeDetail = (index) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    // Validate customer name is required
    if (!formData.customerName || formData.customerName.trim() === "") {
      setValidationError("Customer Name is required");
      // Scroll to error message after state update
      setTimeout(() => {
        if (errorRef.current) {
          errorRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);
      return;
    }

    // Clear any previous validation errors
    setValidationError("");

    // Combine all parts from all types
    const allParts = [
      ...selectedParts.service,
      ...selectedParts.replacement,
      ...selectedParts.sales,
    ];

    // Build jobcardType: if more than one type in parts, separate with comma (e.g. "service, replacement")
    const typesPresent = new Set();
    if (selectedParts.service?.length > 0) typesPresent.add("service");
    if (selectedParts.replacement?.length > 0) typesPresent.add("replacement");
    if (selectedParts.sales?.length > 0) typesPresent.add("sales");
    const jobcardTypeStr =
      Array.from(typesPresent).sort().join(", ") || "service";

    // Primary type for part fallback (service > replacement > sales)
    const primaryType = typesPresent.has("service")
      ? "service"
      : typesPresent.has("replacement")
      ? "replacement"
      : "sales";

    try {
      // Prepare form data with N/A for empty fields (except customer name)
      const submitData = {
        jobcardType: jobcardTypeStr,
        customerName: formData.customerName.trim(),
        place: formData.place.trim() || "N/A",
        mobile: formData.mobile.trim() || "N/A",
        charger: formData.charger || "no",
        date: formData.date || today,
        warrantyType: formData.warrantyType || "none",
        warrantyDate:
          formData.warrantyDate.trim() ||
          (formData.warrantyType === "none" ? "NA" : "N/A"),
        ebikeDetails: formData.ebikeDetails?.trim() || "",
        mechanic: formData.mechanic?.trim() || "",
        billNo: formData.billNo?.trim() || "",
        details: formData.details.length > 0 ? formData.details : [],
        parts: allParts.map((part) => {
          const qty = part.selectedQuantity || 1;
          const total = getPartTotal(part);
          const effectivePrice = qty > 0 ? total / qty : part.price;
          // Only use part.id as spareId if it's a valid ObjectId, otherwise use null
          // Also check if id starts with 'part-' which indicates a temporary ID
          let spareId = null;
          if (!part.isCustom && part.id) {
            // Check if it's a valid ObjectId (24 hex characters)
            if (isValidObjectId(part.id)) {
              spareId = part.id;
            } else if (
              typeof part.id === "string" &&
              part.id.startsWith("part-")
            ) {
              // Temporary IDs like 'part-0' should be null
              spareId = null;
            } else {
              spareId = null;
            }
          }

          const basePart = {
            spareId: spareId,
            spareName: part.name,
            quantity: qty,
            price: effectivePrice,
            selectedColor: part.selectedColor || null,
            isCustom: part.isCustom || false,
            partType: part.partType || primaryType,
            // Persist compatible models from spare so they can be shown in pending/all jobcards and print
            models: Array.isArray(part.models) ? part.models : [],
          };

          // Add sales-related fields if they exist and have values
          if (part.salesType) basePart.salesType = part.salesType;
          if (part.scrapAvailable !== undefined && part.scrapAvailable !== null)
            basePart.scrapAvailable = part.scrapAvailable;
          if (part.scrapQuantity !== undefined && part.scrapQuantity !== null)
            basePart.scrapQuantity = part.scrapQuantity;
          if (
            part.scrapPricePerUnit !== undefined &&
            part.scrapPricePerUnit !== null
          )
            basePart.scrapPricePerUnit = part.scrapPricePerUnit;
          if (part.batteryOldNew) basePart.batteryOldNew = part.batteryOldNew;
          if (part.chargerOldNew) basePart.chargerOldNew = part.chargerOldNew;
          if (part.ampereValue) basePart.ampereValue = part.ampereValue;
          if (part.warrantyStatus)
            basePart.warrantyStatus = part.warrantyStatus;

          // Add replacement-related fields if they exist and have values
          if (part.replacementType)
            basePart.replacementType = part.replacementType;
          if (
            part.replacementFromCompany !== undefined &&
            part.replacementFromCompany !== null
          )
            basePart.replacementFromCompany = part.replacementFromCompany;
          if (part.batteryType) basePart.batteryType = part.batteryType;
          if (part.voltage) basePart.voltage = part.voltage;
          if (part.oldChargerName)
            basePart.oldChargerName = part.oldChargerName;
          if (part.oldChargerVoltage)
            basePart.oldChargerVoltage = part.oldChargerVoltage;
          if (part.oldChargerWorking)
            basePart.oldChargerWorking = part.oldChargerWorking;
          if (
            part.oldChargerAvailable !== undefined &&
            part.oldChargerAvailable !== null
          )
            basePart.oldChargerAvailable = part.oldChargerAvailable;

          return basePart;
        }),
        status: "pending", // Always save as pending
      };

      const endpoint = isEditMode
        ? `http://localhost:5000/api/jobcards/${editJobcard._id}`
        : "http://localhost:5000/api/jobcards";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message ||
            (isEditMode ? "Failed to update jobcard" : "Failed to save jobcard")
        );
      }

      const savedJobcard = await response.json();

      // Handle battery scrap entries for batteries replaced (not from company)
      const batteryReplacements = selectedParts.replacement.filter(
        (part) =>
          part.replacementType === "battery" && !part.replacementFromCompany
      );

      if (!isEditMode && batteryReplacements.length > 0) {
        // Group batteries by date (use jobcard date)
        const jobcardDate = formData.date || today;

        // Calculate total quantity of batteries replaced (not from company)
        const totalScrapQuantity = batteryReplacements.reduce(
          (sum, part) => sum + (part.selectedQuantity || 1),
          0
        );

        if (totalScrapQuantity > 0) {
          try {
            // Create or update scrap entry for this date
            const scrapResponse = await fetch(
              "http://localhost:5000/api/battery-scraps/upsert",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  quantity: totalScrapQuantity,
                  entryDate: jobcardDate,
                }),
              }
            );

            if (!scrapResponse.ok) {
              console.error(
                "Failed to update scrap entries, but jobcard was saved"
              );
            }
          } catch (scrapError) {
            console.error("Error updating scrap entries:", scrapError);
            // Don't fail the jobcard save if scrap update fails
          }
        }
      }

      alert(
        isEditMode
          ? "Jobcard updated successfully!"
          : "Jobcard saved successfully! It has been added to Pending Jobcards."
      );

      // Redirect to Pending Jobcards; pass ID so the jobcard can be scrolled into view
      const jobcardId = isEditMode ? editJobcard._id : savedJobcard?._id;
      navigate(
        "/jobcards/pending",
        jobcardId ? { state: { editedJobcardId: jobcardId } } : {}
      );

      if (!isEditMode) {
        // Reset form for new-jobcard flow only
        setFormData({
          customerName: "",
          place: "",
          mobile: "",
          charger: "no",
          date: today,
          ebikeDetails: "",
          mechanic: "",
          billNo: "",
          warrantyType: "none",
          warrantyDate: "",
          details: [],
        });
        setDetailInput("");
        setSelectedParts({
          service: [],
          replacement: [],
          sales: [],
        });
        setShowSearch(false);
        setShowCustomSpare(false);
        setCustomSpareData({
          name: "",
          price: "",
          quantity: "1",
          color: "",
        });
        setActiveTab(null);
      }
    } catch (error) {
      console.error(
        isEditMode ? "Error updating jobcard:" : "Error saving jobcard:",
        error
      );
      alert(
        `Error ${isEditMode ? "updating" : "saving"} jobcard: ${error.message}`
      );
    }
  };

  const handleTypeClick = (type) => {
    // Replacement is disabled when warranty type is "No Warranty"
    if (type === "replacement" && formData.warrantyType === "none") return;
    // When clicking a type button, set it as the active tab
    setActiveTab(type);
    // Close search and custom spare forms when switching tabs
    setShowSearch(false);
    setShowCustomSpare(false);
    setSelectedReplacementType(null);
  };

  // Check if a type has parts (to show green with tick)
  const hasParts = (type) => {
    return selectedParts[type] && selectedParts[type].length > 0;
  };

  // Helper function to check if a replacement type has parts added
  const hasReplacementType = (replacementType) => {
    return (
      selectedParts.replacement &&
      selectedParts.replacement.some(
        (part) => part.replacementType === replacementType
      )
    );
  };

  const hasSalesType = (salesType) => {
    return (
      selectedParts.sales &&
      selectedParts.sales.some((part) => part.salesType === salesType)
    );
  };

  const totalPartsCount =
    (selectedParts.service?.length || 0) +
    (selectedParts.replacement?.length || 0) +
    (selectedParts.sales?.length || 0);
  const hasAnyParts = totalPartsCount > 0;

  return (
    <div className="jobcard-container" onWheelCapture={handleNumberInputWheel}>
      <div
        style={{
          marginBottom: "1.5rem",
        }}
      >
        <h2>
          {isEditMode
            ? `Edit Jobcard${
                editJobcard?.jobcardNumber
                  ? ` - ${editJobcard.jobcardNumber}`
                  : ""
              }`
            : "New Jobcard"}
        </h2>
      </div>

      <div className="jobcard-form">
        {/* Customer Information */}
        <div className="form-section">
          <h3>Customer Information</h3>
          {validationError && (
            <div
              ref={errorRef}
              style={{
                padding: "0.75rem",
                marginBottom: "1rem",
                backgroundColor: "#fee2e2",
                border: "1px solid #fecaca",
                borderRadius: "0.375rem",
                color: "#dc2626",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              {validationError}
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>
                Customer Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={(e) => {
                  handleInputChange(e);
                  // Clear validation error when user starts typing
                  if (validationError) {
                    setValidationError("");
                  }
                }}
                placeholder="Enter customer name"
                required
                style={{
                  borderColor:
                    validationError && !formData.customerName.trim()
                      ? "#ef4444"
                      : undefined,
                }}
              />
            </div>

            <div className="form-group">
              <label>Place</label>
              <input
                type="text"
                name="place"
                value={formData.place}
                onChange={handleInputChange}
                placeholder="Enter place"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                Mobile Number
                {isMobileValid && (
                  <span
                    style={{ color: "#10b981", fontSize: "1rem" }}
                    title="Valid 10-digit mobile number"
                  >
                    ✓
                  </span>
                )}
              </label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleInputChange}
                placeholder="Enter 10-digit mobile number"
                maxLength={10}
              />
              {formData.mobile.trim().length > 0 && !isMobileValid && (
                <p
                  style={{
                    margin: "0.25rem 0 0 0",
                    fontSize: "0.75rem",
                    color: "#ef4444",
                  }}
                >
                  Mobile number must be exactly 10 digits
                </p>
              )}
            </div>
            <div className="form-group">
              <label>Charger</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1.5rem",
                  marginTop: "0.5rem",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                  }}
                >
                  <input
                    type="radio"
                    name="charger"
                    value="yes"
                    checked={formData.charger === "yes"}
                    onChange={handleInputChange}
                  />
                  Yes
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                  }}
                >
                  <input
                    type="radio"
                    name="charger"
                    value="no"
                    checked={formData.charger === "no"}
                    onChange={handleInputChange}
                  />
                  No
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Jobcard Details */}
        <div className="form-section">
          <h3>Jobcard Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <DatePicker
                value={formData.date}
                onChange={(date) => {
                  setFormData((prev) => ({
                    ...prev,
                    date: date,
                  }));
                }}
                placeholder="dd/mm/yyyy"
              />
            </div>

            <div className="form-group">
              <label>E-Bike Details</label>
              <input
                type="text"
                name="ebikeDetails"
                value={formData.ebikeDetails}
                onChange={handleInputChange}
                placeholder="Enter E-Bike details"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Warranty Type</label>
              <select
                name="warrantyType"
                value={formData.warrantyType}
                onChange={handleInputChange}
              >
                <option value="none">No Warranty</option>
                <option value="full">Full Warranty</option>
                <option value="battery">Battery Only</option>
                <option value="charger">Charger Only</option>
              </select>
            </div>
            <div className="form-group">
              <label>Warranty Date/Code</label>
              <input
                type="text"
                name="warrantyDate"
                value={formData.warrantyDate}
                onChange={handleInputChange}
                placeholder="Enter warranty date/code"
                readOnly={formData.warrantyType === "none"}
                disabled={formData.warrantyType === "none"}
                style={{
                  backgroundColor:
                    formData.warrantyType === "none" ? "#f3f4f6" : "white",
                  cursor:
                    formData.warrantyType === "none" ? "not-allowed" : "text",
                }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Bill No.</label>
              <input
                type="text"
                name="billNo"
                value={formData.billNo}
                onChange={handleInputChange}
                placeholder="Enter bill no."
              />
            </div>
            <div className="form-group">
              <label>Mechanic</label>
              <input
                type="text"
                name="mechanic"
                value={formData.mechanic}
                onChange={handleInputChange}
                placeholder="Enter mechanic name"
              />
            </div>
          </div>
        </div>

        {/* Work Details Section */}
        <div className="form-section">
          <h3>Work Details</h3>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Work Details</label>
              <input
                type="text"
                value={detailInput}
                onChange={(e) => setDetailInput(e.target.value)}
                onKeyPress={handleDetailKeyPress}
                placeholder="Enter work detail and press Enter to add..."
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  fontSize: "0.875rem",
                  marginBottom: "0.75rem",
                }}
              />
              {formData.details.length > 0 && (
                <div
                  style={{
                    padding: "0.75rem",
                    backgroundColor: "#f9fafb",
                    borderRadius: "0.375rem",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                    }}
                  >
                    {formData.details.map((detail, index) => (
                      <li
                        key={index}
                        style={{
                          padding: "0.5rem 0",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "0.5rem",
                          borderBottom:
                            index < formData.details.length - 1
                              ? "1px solid #e5e7eb"
                              : "none",
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <span
                            style={{
                              color: "#6b7280",
                              fontWeight: 500,
                              minWidth: "1.5rem",
                            }}
                          >
                            {index + 1})
                          </span>
                          <span>{detail}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDetail(index)}
                          style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.75rem",
                            backgroundColor: "#ef4444",
                            color: "white",
                            border: "none",
                            borderRadius: "0.25rem",
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = "#dc2626";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = "#ef4444";
                          }}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Jobcard Type Selection */}
        <div className="form-section">
          <h3>Add Items to Jobcard</h3>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Click on a category to add items</label>
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleTypeClick("service")}
                  onMouseEnter={(e) => {
                    if (activeTab !== "service") {
                      if (hasParts("service")) {
                        e.target.style.backgroundColor = "#a7f3d0";
                        e.target.style.borderColor = "#059669";
                      } else {
                        e.target.style.backgroundColor = "#f3f4f6";
                        e.target.style.borderColor = "#9ca3af";
                      }
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== "service") {
                      if (hasParts("service")) {
                        e.target.style.backgroundColor = "#d1fae5";
                        e.target.style.borderColor = "#10b981";
                      } else {
                        e.target.style.backgroundColor = "#ffffff";
                        e.target.style.borderColor = "#d1d5db";
                      }
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "1rem 1.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    borderRadius: "0.5rem",
                    border:
                      activeTab === "service"
                        ? "2px solid #3b82f6"
                        : hasParts("service")
                        ? "2px solid #10b981"
                        : "2px solid #d1d5db",
                    backgroundColor:
                      activeTab === "service"
                        ? "#eff6ff"
                        : hasParts("service")
                        ? "#d1fae5"
                        : "#ffffff",
                    color:
                      activeTab === "service"
                        ? "#3b82f6"
                        : hasParts("service")
                        ? "#065f46"
                        : "#374151",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    textTransform: "capitalize",
                    position: "relative",
                  }}
                >
                  🔧 Service {hasParts("service") && "✓"}
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeClick("replacement")}
                  disabled={formData.warrantyType === "none"}
                  onMouseEnter={(e) => {
                    if (formData.warrantyType === "none") return;
                    if (activeTab !== "replacement") {
                      if (hasParts("replacement")) {
                        e.target.style.backgroundColor = "#a7f3d0";
                        e.target.style.borderColor = "#059669";
                      } else {
                        e.target.style.backgroundColor = "#f3f4f6";
                        e.target.style.borderColor = "#9ca3af";
                      }
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (formData.warrantyType === "none") return;
                    if (activeTab !== "replacement") {
                      if (hasParts("replacement")) {
                        e.target.style.backgroundColor = "#d1fae5";
                        e.target.style.borderColor = "#10b981";
                      } else {
                        e.target.style.backgroundColor = "#ffffff";
                        e.target.style.borderColor = "#d1d5db";
                      }
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "1rem 1.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    borderRadius: "0.5rem",
                    border:
                      formData.warrantyType === "none"
                        ? "2px solid #e5e7eb"
                        : activeTab === "replacement"
                        ? "2px solid #3b82f6"
                        : hasParts("replacement")
                        ? "2px solid #10b981"
                        : "2px solid #d1d5db",
                    backgroundColor:
                      formData.warrantyType === "none"
                        ? "#f3f4f6"
                        : activeTab === "replacement"
                        ? "#eff6ff"
                        : hasParts("replacement")
                        ? "#d1fae5"
                        : "#ffffff",
                    color:
                      formData.warrantyType === "none"
                        ? "#9ca3af"
                        : activeTab === "replacement"
                        ? "#3b82f6"
                        : hasParts("replacement")
                        ? "#065f46"
                        : "#374151",
                    cursor:
                      formData.warrantyType === "none"
                        ? "not-allowed"
                        : "pointer",
                    transition: "all 0.2s ease",
                    textTransform: "capitalize",
                    opacity: formData.warrantyType === "none" ? 0.7 : 1,
                  }}
                  title={
                    formData.warrantyType === "none"
                      ? "Replacement is not available when warranty type is No Warranty"
                      : ""
                  }
                >
                  🔄 Replacement {hasParts("replacement") && "✓"}
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeClick("sales")}
                  onMouseEnter={(e) => {
                    if (activeTab !== "sales") {
                      if (hasParts("sales")) {
                        e.target.style.backgroundColor = "#a7f3d0";
                        e.target.style.borderColor = "#059669";
                      } else {
                        e.target.style.backgroundColor = "#f3f4f6";
                        e.target.style.borderColor = "#9ca3af";
                      }
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== "sales") {
                      if (hasParts("sales")) {
                        e.target.style.backgroundColor = "#d1fae5";
                        e.target.style.borderColor = "#10b981";
                      } else {
                        e.target.style.backgroundColor = "#ffffff";
                        e.target.style.borderColor = "#d1d5db";
                      }
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "1rem 1.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    borderRadius: "0.5rem",
                    border:
                      activeTab === "sales"
                        ? "2px solid #3b82f6"
                        : hasParts("sales")
                        ? "2px solid #10b981"
                        : "2px solid #d1d5db",
                    backgroundColor:
                      activeTab === "sales"
                        ? "#eff6ff"
                        : hasParts("sales")
                        ? "#d1fae5"
                        : "#ffffff",
                    color:
                      activeTab === "sales"
                        ? "#3b82f6"
                        : hasParts("sales")
                        ? "#065f46"
                        : "#374151",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    textTransform: "capitalize",
                  }}
                >
                  💰 Sales {hasParts("sales") && "✓"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab appears when a category is clicked */}
        {activeTab && (
          <div className="form-section" style={{ marginTop: "1.5rem" }}>
            {/* Tab Header */}
            <div
              style={{
                padding: "1rem 1.5rem",
                backgroundColor: "#f9fafb",
                borderRadius: "0.5rem 0.5rem 0 0",
                border: "1px solid #e5e7eb",
                borderBottom: "none",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {activeTab === "service" && "Service"}
                {activeTab === "replacement" && "Replacement"}
                {activeTab === "sales" && "Sales"}
                {selectedParts[activeTab] &&
                  selectedParts[activeTab].length > 0 && (
                    <span
                      style={{
                        marginLeft: "0.5rem",
                        color: "#10b981",
                        fontSize: "0.875rem",
                        fontWeight: "normal",
                      }}
                    >
                      ({selectedParts[activeTab].length}{" "}
                      {selectedParts[activeTab].length === 1 ? "item" : "items"}
                      )
                    </span>
                  )}
              </h3>
            </div>

            {/* Tab Content */}
            <div
              style={{
                padding: "1.5rem",
                backgroundColor: "#ffffff",
                borderRadius: "0 0 0.5rem 0.5rem",
                border: "1px solid #e5e7eb",
                borderTop: "none",
              }}
            >
              {/* Replacement-specific buttons */}
              {activeTab === "replacement" && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "0.75rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleReplacementTypeClick("battery")}
                      style={{
                        padding: "0.75rem 1rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        backgroundColor:
                          selectedReplacementType === "battery"
                            ? "#3b82f6"
                            : hasReplacementType("battery")
                            ? "#d1fae5"
                            : "#ffffff",
                        color:
                          selectedReplacementType === "battery"
                            ? "#ffffff"
                            : hasReplacementType("battery")
                            ? "#065f46"
                            : "#374151",
                        border: `2px solid ${
                          selectedReplacementType === "battery"
                            ? "#3b82f6"
                            : hasReplacementType("battery")
                            ? "#10b981"
                            : "#d1d5db"
                        }`,
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      🔋 Battery {hasReplacementType("battery") && "✓"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReplacementTypeClick("charger")}
                      style={{
                        padding: "0.75rem 1rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        backgroundColor:
                          selectedReplacementType === "charger"
                            ? "#3b82f6"
                            : hasReplacementType("charger")
                            ? "#d1fae5"
                            : "#ffffff",
                        color:
                          selectedReplacementType === "charger"
                            ? "#ffffff"
                            : hasReplacementType("charger")
                            ? "#065f46"
                            : "#374151",
                        border: `2px solid ${
                          selectedReplacementType === "charger"
                            ? "#3b82f6"
                            : hasReplacementType("charger")
                            ? "#10b981"
                            : "#d1d5db"
                        }`,
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      ⚡ Charger {hasReplacementType("charger") && "✓"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReplacementTypeClick("controller")}
                      style={{
                        padding: "0.75rem 1rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        backgroundColor:
                          selectedReplacementType === "controller"
                            ? "#3b82f6"
                            : hasReplacementType("controller")
                            ? "#d1fae5"
                            : "#ffffff",
                        color:
                          selectedReplacementType === "controller"
                            ? "#ffffff"
                            : hasReplacementType("controller")
                            ? "#065f46"
                            : "#374151",
                        border: `2px solid ${
                          selectedReplacementType === "controller"
                            ? "#3b82f6"
                            : hasReplacementType("controller")
                            ? "#10b981"
                            : "#d1d5db"
                        }`,
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      🎛️ Controller {hasReplacementType("controller") && "✓"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReplacementTypeClick("motor")}
                      style={{
                        padding: "0.75rem 1rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        backgroundColor:
                          selectedReplacementType === "motor"
                            ? "#3b82f6"
                            : hasReplacementType("motor")
                            ? "#d1fae5"
                            : "#ffffff",
                        color:
                          selectedReplacementType === "motor"
                            ? "#ffffff"
                            : hasReplacementType("motor")
                            ? "#065f46"
                            : "#374151",
                        border: `2px solid ${
                          selectedReplacementType === "motor"
                            ? "#3b82f6"
                            : hasReplacementType("motor")
                            ? "#10b981"
                            : "#d1d5db"
                        }`,
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      ⚙️ Motor {hasReplacementType("motor") && "✓"}
                    </button>
                  </div>
                </div>
              )}

              {/* Sales-specific buttons */}
              {activeTab === "sales" && (
              <div style={{ marginBottom: "1.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginBottom: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                    <button
                      type="button"
                      onClick={() => handleSalesTypeClick("battery")}
                      style={{
                        minWidth: "140px",
                        padding: "0.85rem 1.5rem",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        backgroundColor:
                          selectedSalesType === "battery"
                            ? "#2563eb"
                            : hasSalesType("battery")
                            ? "#e0f2fe"
                            : "#ffffff",
                        color:
                          selectedSalesType === "battery"
                            ? "#ffffff"
                            : hasSalesType("battery")
                            ? "#1e3a8a"
                            : "#111827",
                        borderRadius: "9999px",
                        border:
                          selectedSalesType === "battery"
                            ? "2px solid #2563eb"
                            : "1px solid #d1d5db",
                        boxShadow:
                          selectedSalesType === "battery"
                            ? "0 2px 6px rgba(37,99,235,0.35)"
                            : "0 1px 3px rgba(15,23,42,0.12)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <span>🔋</span>
                      <span>Battery {hasSalesType("battery") && "✓"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSalesTypeClick("charger")}
                      style={{
                        minWidth: "140px",
                        padding: "0.85rem 1.5rem",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        backgroundColor:
                          selectedSalesType === "charger"
                            ? "#2563eb"
                            : hasSalesType("charger")
                            ? "#e0f2fe"
                            : "#ffffff",
                        color:
                          selectedSalesType === "charger"
                            ? "#ffffff"
                            : hasSalesType("charger")
                            ? "#1e3a8a"
                            : "#111827",
                        borderRadius: "9999px",
                        border:
                          selectedSalesType === "charger"
                            ? "2px solid #2563eb"
                            : "1px solid #d1d5db",
                        boxShadow:
                          selectedSalesType === "charger"
                            ? "0 2px 6px rgba(37,99,235,0.35)"
                            : "0 1px 3px rgba(15,23,42,0.12)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <span>⚡</span>
                      <span>Charger {hasSalesType("charger") && "✓"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSalesTypeClick("oldScooty")}
                      style={{
                        minWidth: "140px",
                        padding: "0.85rem 1.5rem",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        backgroundColor:
                          selectedSalesType === "oldScooty"
                            ? "#2563eb"
                            : hasSalesType("oldScooty")
                            ? "#e0f2fe"
                            : "#ffffff",
                        color:
                          selectedSalesType === "oldScooty"
                            ? "#ffffff"
                            : hasSalesType("oldScooty")
                            ? "#1e3a8a"
                            : "#111827",
                        borderRadius: "9999px",
                        border:
                          selectedSalesType === "oldScooty"
                            ? "2px solid #2563eb"
                            : "1px solid #d1d5db",
                        boxShadow:
                          selectedSalesType === "oldScooty"
                            ? "0 2px 6px rgba(37,99,235,0.35)"
                            : "0 1px 3px rgba(15,23,42,0.12)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <span>🛵</span>
                      <span>Old Scooty {hasSalesType("oldScooty") && "✓"}</span>
                    </button>
                    {/* Spare sales button removed as per latest requirement */}
                  </div>
                </div>
              )}

              {/* Add Parts Buttons (only show for service) */}
              {activeTab === "service" && (
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <button
                    type="button"
                    className="add-part-btn"
                    onClick={toggleSearch}
                  >
                    {showSearch ? "Cancel" : "+ Add Spare Part"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleCustomSpare}
                    style={{
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      backgroundColor: showCustomSpare ? "#6b7280" : "#3b82f6",
                      color: "white",
                      border: "none",
                      borderRadius: "0.375rem",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {showCustomSpare ? "Cancel" : "+ Add Custom Spare"}
                  </button>
                </div>
              )}

              {/* Battery Form */}
              {activeTab === "replacement" &&
                selectedReplacementType === "battery" && (
                  <div
                    style={{
                      padding: "1.5rem",
                      marginBottom: "1rem",
                      backgroundColor: "#f9fafb",
                      borderRadius: "0.5rem",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <h4
                      style={{
                        marginBottom: "1rem",
                        fontSize: "1rem",
                        fontWeight: 600,
                      }}
                    >
                      Add Battery
                    </h4>
                    {loadingBatteries ? (
                      <div style={{ textAlign: "center", padding: "2rem" }}>
                        Loading batteries...
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "1.25rem",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.5rem",
                              fontSize: "0.875rem",
                              fontWeight: 500,
                            }}
                          >
                            Battery Type{" "}
                            <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.75rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setReplacementBatteryType("lead");
                                setSelectedBattery(null);
                              }}
                              style={{
                                padding: "0.4rem 0.9rem",
                                borderRadius: "9999px",
                                border:
                                  replacementBatteryType === "lead"
                                    ? "2px solid #3b82f6"
                                    : "1px solid #d1d5db",
                                backgroundColor:
                                  replacementBatteryType === "lead"
                                    ? "#eff6ff"
                                    : "#ffffff",
                                fontSize: "0.85rem",
                                fontWeight: 500,
                                cursor: "pointer",
                                color:
                                  replacementBatteryType === "lead"
                                    ? "#1d4ed8"
                                    : "#374151",
                              }}
                            >
                              Lead
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReplacementBatteryType("lithium");
                                setSelectedBattery(null);
                              }}
                              style={{
                                padding: "0.4rem 0.9rem",
                                borderRadius: "9999px",
                                border:
                                  replacementBatteryType === "lithium"
                                    ? "2px solid #3b82f6"
                                    : "1px solid #d1d5db",
                                backgroundColor:
                                  replacementBatteryType === "lithium"
                                    ? "#eff6ff"
                                    : "#ffffff",
                                fontSize: "0.85rem",
                                fontWeight: 500,
                                cursor: "pointer",
                                color:
                                  replacementBatteryType === "lithium"
                                    ? "#1d4ed8"
                                    : "#374151",
                              }}
                            >
                              Lithium
                            </button>
                          </div>
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontSize: "0.875rem",
                              fontWeight: 500,
                            }}
                          >
                            Select Battery{" "}
                            <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <select
                            disabled={!replacementBatteryType}
                            value={selectedBattery?._id || ""}
                            onChange={(e) => {
                              const list = replacementBatteryType
                                ? batteries.filter(
                                    (b) =>
                                      b.batteryType ===
                                      replacementBatteryType
                                  )
                                : batteries;
                              const battery = list.find(
                                (b) => b._id === e.target.value
                              );
                              setSelectedBattery(battery || null);
                            }}
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #d1d5db",
                              fontSize: "0.875rem",
                              backgroundColor: "white",
                              cursor: "pointer",
                            }}
                          >
                            <option value="">
                              {replacementBatteryType
                                ? "Select a battery from stock"
                                : "Select battery type first"}
                            </option>
                            {(replacementBatteryType
                              ? batteries.filter(
                                  (battery) =>
                                    battery.batteryType ===
                                    replacementBatteryType
                                )
                              : []
                            ).map((battery) => (
                              <option key={battery._id} value={battery._id}>
                                {battery.name}{" "}
                                {battery.ampereValue
                                  ? `(${battery.ampereValue} A)`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        {selectedBattery && (
                          <>
                            <div>
                              <label
                                style={{
                                  display: "block",
                                  marginBottom: "0.25rem",
                                  fontSize: "0.875rem",
                                  fontWeight: 500,
                                }}
                              >
                                Quantity
                              </label>
                              <input
                                type="number"
                                value={batteryQuantity}
                                onChange={(e) =>
                                  setBatteryQuantity(e.target.value)
                                }
                                placeholder="1"
                                min="1"
                                onWheel={(e) => e.target.blur()}
                                style={{
                                  width: "100%",
                                  padding: "0.5rem",
                                  borderRadius: "0.375rem",
                                  border: "1px solid #d1d5db",
                                  fontSize: "0.875rem",
                                }}
                              />
                            </div>
                            <div>
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  fontSize: "0.875rem",
                                  fontWeight: 500,
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={batteryReplacementFromCompany}
                                  onChange={(e) =>
                                    setBatteryReplacementFromCompany(
                                      e.target.checked
                                    )
                                  }
                                  style={{
                                    width: "1rem",
                                    height: "1rem",
                                    cursor: "pointer",
                                  }}
                                />
                                Replacement from company
                              </label>
                            </div>
                          </>
                        )}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "0.5rem",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReplacementType(null);
                              setSelectedBattery(null);
                              setBatteryReplacementFromCompany(false);
                            }}
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.875rem",
                              backgroundColor: "#6b7280",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddBattery}
                            disabled={!selectedBattery}
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.875rem",
                              backgroundColor: selectedBattery
                                ? "#10b981"
                                : "#9ca3af",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: selectedBattery
                                ? "pointer"
                                : "not-allowed",
                              fontWeight: 500,
                            }}
                          >
                            Add to Jobcard
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* Charger Form */}
              {activeTab === "replacement" &&
                selectedReplacementType === "charger" && (
                  <div
                    style={{
                      padding: "1.5rem",
                      marginBottom: "1rem",
                      backgroundColor: "#f9fafb",
                      borderRadius: "0.5rem",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <h4
                      style={{
                        marginBottom: "1rem",
                        fontSize: "1rem",
                        fontWeight: 600,
                      }}
                    >
                      Add Charger
                    </h4>
                    {loadingChargers ? (
                      <div style={{ textAlign: "center", padding: "2rem" }}>
                        Loading chargers...
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "1.25rem",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.5rem",
                              fontSize: "0.875rem",
                              fontWeight: 500,
                            }}
                          >
                            Battery Type{" "}
                            <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.75rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setReplacementChargerBatteryType("lead");
                                setSelectedCharger(null);
                              }}
                              style={{
                                padding: "0.4rem 0.9rem",
                                borderRadius: "9999px",
                                border:
                                  replacementChargerBatteryType === "lead"
                                    ? "2px solid #3b82f6"
                                    : "1px solid #d1d5db",
                                backgroundColor:
                                  replacementChargerBatteryType === "lead"
                                    ? "#eff6ff"
                                    : "#ffffff",
                                fontSize: "0.85rem",
                                fontWeight: 500,
                                cursor: "pointer",
                                color:
                                  replacementChargerBatteryType === "lead"
                                    ? "#1d4ed8"
                                    : "#374151",
                              }}
                            >
                              Lead
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReplacementChargerBatteryType("lithium");
                                setSelectedCharger(null);
                              }}
                              style={{
                                padding: "0.4rem 0.9rem",
                                borderRadius: "9999px",
                                border:
                                  replacementChargerBatteryType === "lithium"
                                    ? "2px solid #3b82f6"
                                    : "1px solid #d1d5db",
                                backgroundColor:
                                  replacementChargerBatteryType === "lithium"
                                    ? "#eff6ff"
                                    : "#ffffff",
                                fontSize: "0.85rem",
                                fontWeight: 500,
                                cursor: "pointer",
                                color:
                                  replacementChargerBatteryType === "lithium"
                                    ? "#1d4ed8"
                                    : "#374151",
                              }}
                            >
                              Lithium
                            </button>
                          </div>
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontSize: "0.875rem",
                              fontWeight: 500,
                            }}
                          >
                            Select Charger{" "}
                            <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <select
                            disabled={!replacementChargerBatteryType}
                            value={selectedCharger?._id || ""}
                            onChange={(e) => {
                              const list = replacementChargerBatteryType
                                ? chargers.filter(
                                    (c) =>
                                      c.batteryType ===
                                      replacementChargerBatteryType
                                  )
                                : chargers;
                              const charger = list.find(
                                (c) => c._id === e.target.value
                              );
                              setSelectedCharger(charger || null);
                            }}
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #d1d5db",
                              fontSize: "0.875rem",
                            }}
                          >
                            <option value="">
                              {replacementChargerBatteryType
                                ? "Select a charger from stock"
                                : "Select battery type first"}
                            </option>
                            {(replacementChargerBatteryType
                              ? chargers.filter(
                                  (charger) =>
                                    charger.batteryType ===
                                    replacementChargerBatteryType
                                )
                              : []
                            ).map((charger) => (
                              <option key={charger._id} value={charger._id}>
                                {charger.name}{" "}
                                {charger.voltage ? `(${charger.voltage})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        {selectedCharger && (
                          <>
                            <div>
                              <label
                                style={{
                                  display: "block",
                                  marginBottom: "0.25rem",
                                  fontSize: "0.875rem",
                                  fontWeight: 500,
                                }}
                              >
                                Quantity
                              </label>
                              <input
                                type="number"
                                value={chargerQuantity}
                                onChange={(e) =>
                                  setChargerQuantity(e.target.value)
                                }
                                placeholder="1"
                                min="1"
                                onWheel={(e) => e.target.blur()}
                                style={{
                                  width: "100%",
                                  padding: "0.5rem",
                                  borderRadius: "0.375rem",
                                  border: "1px solid #d1d5db",
                                  fontSize: "0.875rem",
                                }}
                              />
                            </div>
                            <div>
                              <label
                                style={{
                                  display: "block",
                                  marginBottom: "0.25rem",
                                  fontSize: "0.875rem",
                                  fontWeight: 500,
                                }}
                              >
                                Old Charger Name{" "}
                                <span style={{ color: "#ef4444" }}>*</span>
                              </label>
                              <input
                                type="text"
                                value={oldChargerName}
                                onChange={(e) =>
                                  setOldChargerName(e.target.value)
                                }
                                placeholder="Enter old charger name"
                                style={{
                                  width: "100%",
                                  padding: "0.5rem",
                                  borderRadius: "0.375rem",
                                  border: "1px solid #d1d5db",
                                  fontSize: "0.875rem",
                                }}
                              />
                            </div>
                            <div>
                              <label
                                style={{
                                  display: "block",
                                  marginBottom: "0.25rem",
                                  fontSize: "0.875rem",
                                  fontWeight: 500,
                                }}
                              >
                                Old Charger Voltage{" "}
                                <span style={{ color: "#ef4444" }}>*</span>
                              </label>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.35rem",
                                  fontSize: "0.875rem",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "0.75rem",
                                  }}
                                >
                                  {["48V", "60V", "72V"].map((v) => (
                                    <label
                                      key={v}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.4rem",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <input
                                        type="radio"
                                        name="oldChargerVoltage"
                                        value={v}
                                        checked={oldChargerVoltageOption === v}
                                        onChange={(e) => {
                                          setOldChargerVoltageOption(
                                            e.target.value
                                          );
                                          setOldChargerVoltage(e.target.value);
                                        }}
                                        style={{
                                          width: "0.9rem",
                                          height: "0.9rem",
                                        }}
                                      />
                                      {v}
                                    </label>
                                  ))}
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.4rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name="oldChargerVoltage"
                                      value="other"
                                      checked={
                                        oldChargerVoltageOption === "other"
                                      }
                                      onChange={(e) => {
                                        setOldChargerVoltageOption(
                                          e.target.value
                                        );
                                        setOldChargerVoltage(
                                          oldChargerVoltageOther.trim()
                                        );
                                      }}
                                      style={{
                                        width: "0.9rem",
                                        height: "0.9rem",
                                      }}
                                    />
                                    Other
                                  </label>
                                </div>
                                {oldChargerVoltageOption === "other" && (
                                  <input
                                    type="text"
                                    value={oldChargerVoltageOther}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setOldChargerVoltageOther(value);
                                      setOldChargerVoltage(value);
                                    }}
                                    placeholder="Enter custom voltage"
                                    style={{
                                      width: "100%",
                                      padding: "0.5rem",
                                      borderRadius: "0.375rem",
                                      border: "1px solid #d1d5db",
                                      fontSize: "0.875rem",
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                            <div>
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  fontSize: "0.875rem",
                                  fontWeight: 500,
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={chargerReplacementFromCompany}
                                  onChange={(e) =>
                                    setChargerReplacementFromCompany(
                                      e.target.checked
                                    )
                                  }
                                  style={{
                                    width: "1rem",
                                    height: "1rem",
                                    cursor: "pointer",
                                  }}
                                />
                                Replacement from company
                              </label>
                            </div>
                          </>
                        )}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "0.5rem",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReplacementType(null);
                              setSelectedCharger(null);
                              setReplacementChargerBatteryType("");
                              setChargerReplacementFromCompany(false);
                              setOldChargerName("");
                              setOldChargerVoltage("");
                            }}
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.875rem",
                              backgroundColor: "#6b7280",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddCharger}
                            disabled={
                              !selectedCharger ||
                              !oldChargerName.trim() ||
                              !oldChargerVoltage.trim()
                            }
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.875rem",
                              backgroundColor:
                                selectedCharger &&
                                oldChargerName.trim() &&
                                oldChargerVoltage.trim()
                                  ? "#10b981"
                                  : "#9ca3af",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor:
                                selectedCharger &&
                                oldChargerName.trim() &&
                                oldChargerVoltage.trim()
                                  ? "pointer"
                                  : "not-allowed",
                              fontWeight: 500,
                            }}
                          >
                            Add to Jobcard
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* Controller Form */}
              {activeTab === "replacement" &&
                selectedReplacementType === "controller" && (
                  <div
                    style={{
                      padding: "1.5rem",
                      marginBottom: "1rem",
                      backgroundColor: "#f9fafb",
                      borderRadius: "0.5rem",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <h4
                      style={{
                        marginBottom: "1rem",
                        fontSize: "1rem",
                        fontWeight: 600,
                      }}
                    >
                      Add Controller
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Controller Name{" "}
                          <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={controllerData.name}
                          onChange={(e) =>
                            handleControllerNameChange(e.target.value)
                          }
                          onKeyDown={handleControllerKeyDown}
                          placeholder="Enter controller name"
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.875rem",
                          }}
                        />
                        {controllerSuggestions.length > 0 && (
                          <div
                            style={{
                              marginTop: "0.25rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #e5e7eb",
                              backgroundColor: "#ffffff",
                              maxHeight: "180px",
                              overflowY: "auto",
                              boxShadow:
                                "0 10px 15px -3px rgba(15,23,42,0.1), 0 4px 6px -4px rgba(15,23,42,0.1)",
                              zIndex: 20,
                            }}
                          >
                            {controllerSuggestions.map((spare, index) => (
                              <div
                                key={spare._id}
                                onClick={() =>
                                  handleSelectControllerSuggestion(spare)
                                }
                                style={{
                                  padding: "0.4rem 0.6rem",
                                  cursor: "pointer",
                                  fontSize: "0.85rem",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.1rem",
                                  backgroundColor:
                                    index === controllerSelectedIndex
                                      ? "#eff6ff"
                                      : "#ffffff",
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 500,
                                    color: "#111827",
                                  }}
                                >
                                  {spare.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#6b7280",
                                  }}
                                >
                                  {spare.supplierName
                                    ? `Supplier: ${spare.supplierName}`
                                    : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontSize: "0.875rem",
                              fontWeight: 500,
                            }}
                          >
                            Price (₹){" "}
                            <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <input
                            type="number"
                            value={controllerData.price}
                            onChange={(e) =>
                              setControllerData((prev) => ({
                                ...prev,
                                price: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #d1d5db",
                              fontSize: "0.875rem",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontSize: "0.875rem",
                              fontWeight: 500,
                            }}
                          >
                            Quantity
                          </label>
                          <input
                            type="number"
                            value={controllerData.quantity}
                            onChange={(e) =>
                              setControllerData((prev) => ({
                                ...prev,
                                quantity: e.target.value,
                              }))
                            }
                            placeholder="1"
                            min="1"
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #d1d5db",
                              fontSize: "0.875rem",
                            }}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "0.5rem",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedReplacementType(null)}
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            backgroundColor: "#6b7280",
                            color: "white",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddController}
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            backgroundColor: "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                        >
                          Add to Jobcard
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {/* Motor Form */}
              {activeTab === "replacement" &&
                selectedReplacementType === "motor" && (
                  <div
                    style={{
                      padding: "1.5rem",
                      marginBottom: "1rem",
                      backgroundColor: "#f9fafb",
                      borderRadius: "0.5rem",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <h4
                      style={{
                        marginBottom: "1rem",
                        fontSize: "1rem",
                        fontWeight: 600,
                      }}
                    >
                      Add Motor
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Motor Name <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={motorData.name}
                          onChange={(e) => handleMotorNameChange(e.target.value)}
                          onKeyDown={handleMotorKeyDown}
                          placeholder="Enter motor name"
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.875rem",
                          }}
                        />
                        {motorSuggestions.length > 0 && (
                          <div
                            style={{
                              marginTop: "0.25rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #e5e7eb",
                              backgroundColor: "#ffffff",
                              maxHeight: "180px",
                              overflowY: "auto",
                              boxShadow:
                                "0 10px 15px -3px rgba(15,23,42,0.1), 0 4px 6px -4px rgba(15,23,42,0.1)",
                              zIndex: 20,
                            }}
                          >
                            {motorSuggestions.map((spare, index) => (
                              <div
                                key={spare._id}
                                onClick={() =>
                                  handleSelectMotorSuggestion(spare)
                                }
                              style={{
                                padding: "0.4rem 0.6rem",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.1rem",
                                backgroundColor:
                                  index === motorSelectedIndex
                                    ? "#eff6ff"
                                    : "#ffffff",
                              }}
                              >
                                <span
                                  style={{
                                    fontWeight: 500,
                                    color: "#111827",
                                  }}
                                >
                                  {spare.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#6b7280",
                                  }}
                                >
                                  {spare.supplierName
                                    ? `Supplier: ${spare.supplierName}`
                                    : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontSize: "0.875rem",
                              fontWeight: 500,
                            }}
                          >
                            Price (₹){" "}
                            <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <input
                            type="number"
                            value={motorData.price}
                            onChange={(e) =>
                              setMotorData((prev) => ({
                                ...prev,
                                price: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #d1d5db",
                              fontSize: "0.875rem",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontSize: "0.875rem",
                              fontWeight: 500,
                            }}
                          >
                            Quantity
                          </label>
                          <input
                            type="number"
                            value={motorData.quantity}
                            onChange={(e) =>
                              setMotorData((prev) => ({
                                ...prev,
                                quantity: e.target.value,
                              }))
                            }
                            placeholder="1"
                            min="1"
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #d1d5db",
                              fontSize: "0.875rem",
                            }}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "0.5rem",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedReplacementType(null)}
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            backgroundColor: "#6b7280",
                            color: "white",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddMotor}
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            backgroundColor: "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                        >
                          Add to Jobcard
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {/* Sales Battery Form */}
              {activeTab === "sales" && selectedSalesType === "battery" && (
                <div
                  style={{
                    padding: "1.5rem",
                    marginBottom: "1rem",
                    backgroundColor: "#f9fafb",
                    borderRadius: "0.5rem",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h4
                    style={{
                      marginBottom: "1rem",
                      fontSize: "1rem",
                      fontWeight: 600,
                    }}
                  >
                    Add Battery for Sale
                  </h4>
                  {salesBatteryOldNew === null ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                        }}
                      >
                        Battery type
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSalesBatteryOldNew("old")}
                          style={{
                            padding: "0.75rem 1.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            backgroundColor: "#f1f5f9",
                            color: "#334155",
                            border: "2px solid #94a3b8",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                          }}
                        >
                          Old Battery
                        </button>
                        <button
                          type="button"
                          onClick={() => setSalesBatteryOldNew("new")}
                          style={{
                            padding: "0.75rem 1.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            backgroundColor: "#f1f5f9",
                            color: "#334155",
                            border: "2px solid #94a3b8",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                          }}
                        >
                          New Battery
                        </button>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "0.5rem",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSalesBatteryOldNew(null);
                            setSelectedSalesType(null);
                          }}
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            backgroundColor: "#6b7280",
                            color: "white",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : salesBatteryOldNew === "old" ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Quantity <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="number"
                          value={salesOldBatteryQuantity}
                          onChange={(e) =>
                            setSalesOldBatteryQuantity(e.target.value)
                          }
                          placeholder="1"
                          min="1"
                          onWheel={(e) => e.target.blur()}
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.875rem",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Total Price (₹){" "}
                          <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="number"
                          value={salesOldBatteryPrice}
                          onChange={(e) =>
                            setSalesOldBatteryPrice(e.target.value)
                          }
                          placeholder="0"
                          min="0"
                          step="0.01"
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.875rem",
                          }}
                        />
                        <p
                          style={{
                            margin: "0.25rem 0 0 0",
                            fontSize: "0.75rem",
                            color: "#6b7280",
                          }}
                        >
                          Enter total price for all batteries in this quantity.
                        </p>
                      </div>
                      <div>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={salesBatteryScrapAvailable}
                            onChange={(e) =>
                              setSalesBatteryScrapAvailable(e.target.checked)
                            }
                            style={{
                              width: "1rem",
                              height: "1rem",
                              cursor: "pointer",
                            }}
                          />
                          Scrap Available
                        </label>
                      </div>
                      {salesBatteryScrapAvailable && (
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontSize: "0.875rem",
                              fontWeight: 500,
                            }}
                          >
                            Quantity of scrap
                          </label>
                          <input
                            type="number"
                            value={salesBatteryScrapQuantity}
                            onChange={(e) =>
                              setSalesBatteryScrapQuantity(e.target.value)
                            }
                            placeholder="1"
                            min="1"
                            onWheel={(e) => e.target.blur()}
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #d1d5db",
                              fontSize: "0.875rem",
                            }}
                          />
                        </div>
                      )}
                      <div
                        style={{
                          marginTop: "1.5rem",
                          paddingTop: "1rem",
                          borderTop: "1px solid #e5e7eb",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "0.75rem",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSalesBatteryOldNew(null)}
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            backgroundColor: "#3b82f6",
                            color: "white",
                            border: "2px solid #2563eb",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            fontWeight: 600,
                            boxShadow: "0 1px 3px rgba(59, 130, 246, 0.4)",
                          }}
                        >
                          Back
                        </button>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSalesType(null);
                              setSalesBatteryOldNew(null);
                              setSalesOldBatteryPrice("");
                              setSalesOldBatteryQuantity("1");
                              setSalesBatteryScrapAvailable(false);
                              setSalesBatteryScrapQuantity("1");
                              setSalesBatteryScrapPrice("800");
                            }}
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.875rem",
                              backgroundColor: "#6b7280",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddSalesOldBattery}
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.875rem",
                              backgroundColor: "#10b981",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Add to Jobcard
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : loadingBatteries ? (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                      Loading batteries...
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#374151",
                          marginBottom: "0.25rem",
                        }}
                      >
                        New Battery
                      </span>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Select Battery{" "}
                          <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <select
                          value={salesBattery?._id || ""}
                          onChange={(e) => {
                            const battery = batteries.find(
                              (b) => b._id === e.target.value
                            );
                            setSalesBattery(battery || null);
                          }}
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.875rem",
                          }}
                        >
                          <option value="">Select a battery</option>
                          {batteries.map((battery) => (
                            <option key={battery._id} value={battery._id}>
                              {battery.name}{" "}
                              {battery.ampereValue
                                ? `(${battery.ampereValue} A)`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      {salesBattery && (
                        <>
                          <div>
                            <label
                              style={{
                                display: "block",
                                marginBottom: "0.25rem",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}
                            >
                              Quantity
                            </label>
                            <input
                              type="number"
                              value={salesBatteryQuantity}
                              onChange={(e) => {
                                const nextValue = e.target.value;
                                setSalesBatteryQuantity(nextValue);
                                // Keep scrap quantity in sync with new battery quantity by default
                                setSalesBatteryScrapQuantity(nextValue);
                              }}
                              placeholder="1"
                              min="1"
                              onWheel={(e) => e.target.blur()}
                              style={{
                                width: "100%",
                                padding: "0.5rem",
                                borderRadius: "0.375rem",
                                border: "1px solid #d1d5db",
                                fontSize: "0.875rem",
                              }}
                            />
                          </div>
                          <div>
                            <label
                              style={{
                                display: "block",
                                marginBottom: "0.25rem",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}
                            >
                              Sell in warranty
                            </label>
                            <select
                              value={salesBatteryWarrantyStatus}
                              onChange={(e) =>
                                setSalesBatteryWarrantyStatus(e.target.value)
                              }
                              style={{
                                width: "100%",
                                padding: "0.5rem",
                                borderRadius: "0.375rem",
                                border: "1px solid #d1d5db",
                                fontSize: "0.875rem",
                              }}
                            >
                              <option value="warranty">Warranty</option>
                              <option value="noWarranty">No Warranty</option>
                            </select>
                          </div>
                          <div>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={salesBatteryScrapAvailable}
                                onChange={(e) =>
                                  setSalesBatteryScrapAvailable(
                                    e.target.checked
                                  )
                                }
                                style={{
                                  width: "1rem",
                                  height: "1rem",
                                  cursor: "pointer",
                                }}
                              />
                              Scrap Available
                            </label>
                          </div>
                          {salesBatteryScrapAvailable && (
                            <div>
                              <label
                                style={{
                                  display: "block",
                                  marginBottom: "0.25rem",
                                  fontSize: "0.875rem",
                                  fontWeight: 500,
                                }}
                              >
                                Quantity of scrap
                              </label>
                              <input
                                type="number"
                                value={salesBatteryScrapQuantity}
                                onChange={(e) =>
                                  setSalesBatteryScrapQuantity(e.target.value)
                                }
                                placeholder="1"
                                min="1"
                                onWheel={(e) => e.target.blur()}
                                style={{
                                  width: "100%",
                                  padding: "0.5rem",
                                  borderRadius: "0.375rem",
                                  border: "1px solid #d1d5db",
                                  fontSize: "0.875rem",
                                }}
                              />
                            </div>
                          )}
                          {salesBatteryScrapAvailable && (
                            <div>
                              <label
                                style={{
                                  display: "block",
                                  marginBottom: "0.25rem",
                                  fontSize: "0.875rem",
                                  fontWeight: 500,
                                }}
                              >
                                Price per scrap (₹) to be deducted
                              </label>
                              <input
                                type="number"
                                value={salesBatteryScrapPrice}
                                onChange={(e) =>
                                  setSalesBatteryScrapPrice(e.target.value)
                                }
                                placeholder="0"
                                min="0"
                                step="0.01"
                                onWheel={(e) => e.target.blur()}
                                style={{
                                  width: "100%",
                                  padding: "0.5rem",
                                  borderRadius: "0.375rem",
                                  border: "1px solid #d1d5db",
                                  fontSize: "0.875rem",
                                }}
                              />
                            </div>
                          )}
                        </>
                      )}
                      <div
                        style={{
                          marginTop: "1.5rem",
                          paddingTop: "1rem",
                          borderTop: "1px solid #e5e7eb",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "0.75rem",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSalesBatteryOldNew(null)}
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            backgroundColor: "#3b82f6",
                            color: "white",
                            border: "2px solid #2563eb",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            fontWeight: 600,
                            boxShadow: "0 1px 3px rgba(59, 130, 246, 0.4)",
                          }}
                        >
                          Back
                        </button>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSalesType(null);
                              setSalesBattery(null);
                              setSalesBatteryQuantity("1");
                              setSalesBatteryScrapAvailable(false);
                              setSalesBatteryScrapQuantity("1");
                              setSalesBatteryScrapPrice("800");
                              setSalesBatteryWarrantyStatus("noWarranty");
                              setSalesBatteryOldNew(null);
                            }}
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.875rem",
                              backgroundColor: "#6b7280",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddSalesBattery}
                            disabled={!salesBattery}
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.875rem",
                              backgroundColor: salesBattery
                                ? "#10b981"
                                : "#9ca3af",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: salesBattery ? "pointer" : "not-allowed",
                              fontWeight: 500,
                            }}
                          >
                            Add to Jobcard
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sales Charger Form */}
              {activeTab === "sales" && selectedSalesType === "charger" && (
                <div
                  style={{
                    padding: "1.5rem",
                    marginBottom: "1rem",
                    backgroundColor: "#f9fafb",
                    borderRadius: "0.5rem",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h4
                    style={{
                      marginBottom: "1rem",
                      fontSize: "1rem",
                      fontWeight: 600,
                    }}
                  >
                    Add Charger for Sale
                  </h4>
                  {salesChargerOldNew === null ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                        }}
                      >
                        Charger type
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSalesChargerOldNew("old")}
                          style={{
                            padding: "0.75rem 1.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            backgroundColor: "#f1f5f9",
                            color: "#334155",
                            border: "2px solid #94a3b8",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                          }}
                        >
                          Old Charger
                        </button>
                        <button
                          type="button"
                          onClick={() => setSalesChargerOldNew("new")}
                          style={{
                            padding: "0.75rem 1.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            backgroundColor: "#f1f5f9",
                            color: "#334155",
                            border: "2px solid #94a3b8",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                          }}
                        >
                          New Charger
                        </button>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "0.5rem",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSalesChargerOldNew(null);
                            setSelectedSalesType(null);
                          }}
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            backgroundColor: "#6b7280",
                            color: "white",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : salesChargerOldNew === "old" ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.35rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Charger Type{" "}
                          <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.75rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              cursor: "pointer",
                              fontSize: "0.875rem",
                            }}
                          >
                            <input
                              type="radio"
                              name="salesOldChargerType"
                              value="lead"
                              checked={salesOldChargerType === "lead"}
                              onChange={(e) => {
                                setSalesOldChargerType(e.target.value);
                                setSalesOldChargerVoltage("");
                              }}
                              style={{ width: "0.9rem", height: "0.9rem" }}
                            />
                            Lead
                          </label>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              cursor: "pointer",
                              fontSize: "0.875rem",
                            }}
                          >
                            <input
                              type="radio"
                              name="salesOldChargerType"
                              value="lithium"
                              checked={salesOldChargerType === "lithium"}
                              onChange={(e) => {
                                setSalesOldChargerType(e.target.value);
                                setSalesOldChargerVoltage("");
                              }}
                              style={{ width: "0.9rem", height: "0.9rem" }}
                            />
                            Lithium
                          </label>
                        </div>
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Voltage <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        {!salesOldChargerType ? (
                          <select
                            disabled
                            value=""
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #d1d5db",
                              fontSize: "0.875rem",
                              backgroundColor: "#f3f4f6",
                              color: "#6b7280",
                            }}
                          >
                            <option value="">Select charger type first</option>
                          </select>
                        ) : oldChargerStockStats === null ? (
                          <select
                            disabled
                            value=""
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #d1d5db",
                              fontSize: "0.875rem",
                              backgroundColor: "#f3f4f6",
                              color: "#6b7280",
                            }}
                          >
                            <option value="">Loading stock…</option>
                          </select>
                        ) : oldChargerSaleVoltageOptions.length === 0 ? (
                          <>
                            <select
                              disabled
                              value=""
                              style={{
                                width: "100%",
                                padding: "0.5rem",
                                borderRadius: "0.375rem",
                                border: "1px solid #d1d5db",
                                fontSize: "0.875rem",
                                backgroundColor: "#f3f4f6",
                                color: "#6b7280",
                              }}
                            >
                              <option value="">
                                No working old chargers in stock
                              </option>
                            </select>
                            <p
                              style={{
                                fontSize: "0.75rem",
                                color: "#6b7280",
                                marginTop: "0.35rem",
                                marginBottom: 0,
                                lineHeight: 1.4,
                              }}
                            >
                              Only voltages with at least one{" "}
                              <strong>working</strong> unit in{" "}
                              <strong>Old chargers</strong> appear here.
                            </p>
                          </>
                        ) : (
                          <select
                            value={salesOldChargerVoltage}
                            onChange={(e) =>
                              setSalesOldChargerVoltage(e.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #d1d5db",
                              fontSize: "0.875rem",
                              backgroundColor: "white",
                            }}
                          >
                            <option value="">Select voltage</option>
                            {oldChargerSaleVoltageOptions.map((v) => (
                              <option key={v} value={v}>
                                {v} ({oldChargerStockStats[v].working} working)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Quantity <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="number"
                          value={salesOldChargerQuantity}
                          onChange={(e) =>
                            setSalesOldChargerQuantity(e.target.value)
                          }
                          onBlur={() => {
                            if (
                              !salesOldChargerVoltage ||
                              oldChargerWorkingInStock <= 0
                            )
                              return;
                            const q =
                              parseInt(salesOldChargerQuantity, 10) || 1;
                            if (q > oldChargerWorkingInStock) {
                              setSalesOldChargerQuantity(
                                String(oldChargerWorkingInStock)
                              );
                            }
                          }}
                          placeholder="1"
                          min={1}
                          max={
                            salesOldChargerVoltage && oldChargerWorkingInStock > 0
                              ? oldChargerWorkingInStock
                              : undefined
                          }
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.875rem",
                          }}
                        />
                        {salesOldChargerVoltage &&
                          oldChargerWorkingInStock > 0 && (
                            <p
                              style={{
                                fontSize: "0.75rem",
                                color: "#64748b",
                                marginTop: "0.3rem",
                                marginBottom: 0,
                              }}
                            >
                              Working in stock for{" "}
                              <strong>{salesOldChargerVoltage}</strong>:{" "}
                              <strong>{oldChargerWorkingInStock}</strong> (max
                              you can sell on this jobcard)
                            </p>
                          )}
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Price (₹) <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="number"
                          value={salesOldChargerPrice}
                          onChange={(e) =>
                            setSalesOldChargerPrice(e.target.value)
                          }
                          placeholder="0"
                          min="0"
                          step="0.01"
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.875rem",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #e5e7eb",
                            backgroundColor: "#f9fafb",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={salesOldChargerOldChargerAvailable}
                            onChange={(e) =>
                              setSalesOldChargerOldChargerAvailable(
                                e.target.checked
                              )
                            }
                            style={{
                              width: "1rem",
                              height: "1rem",
                              cursor: "pointer",
                            }}
                          />
                          Old charger available
                        </label>
                      </div>
                      {salesOldChargerOldChargerAvailable && (
                        <>
                          <div>
                            <label
                              style={{
                                display: "block",
                                marginBottom: "0.25rem",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}
                            >
                              Old Charger Voltage (available){" "}
                              <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "0.75rem",
                                alignItems: "center",
                              }}
                            >
                              {["48V", "60V", "72V"].map((v) => (
                                <label
                                  key={v}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.4rem",
                                    cursor: "pointer",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name="salesOldChargerOldChargerVoltage"
                                    value={v}
                                    checked={
                                      salesOldChargerOldChargerVoltageOption ===
                                      v
                                    }
                                    onChange={(e) => {
                                      setSalesOldChargerOldChargerVoltageOption(
                                        e.target.value
                                      );
                                      setSalesOldChargerOldChargerVoltage(
                                        e.target.value
                                      );
                                    }}
                                    style={{
                                      width: "0.9rem",
                                      height: "0.9rem",
                                    }}
                                  />
                                  {v}
                                </label>
                              ))}
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.4rem",
                                  cursor: "pointer",
                                  fontSize: "0.875rem",
                                }}
                              >
                                <input
                                  type="radio"
                                  name="salesOldChargerOldChargerVoltage"
                                  value="other"
                                  checked={
                                    salesOldChargerOldChargerVoltageOption ===
                                    "other"
                                  }
                                  onChange={(e) => {
                                    setSalesOldChargerOldChargerVoltageOption(
                                      e.target.value
                                    );
                                    setSalesOldChargerOldChargerVoltage(
                                      salesOldChargerOldChargerVoltageOther.trim()
                                    );
                                  }}
                                  style={{ width: "0.9rem", height: "0.9rem" }}
                                />
                                Other
                              </label>
                            </div>
                            {salesOldChargerOldChargerVoltageOption ===
                              "other" && (
                              <input
                                type="text"
                                value={salesOldChargerOldChargerVoltageOther}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setSalesOldChargerOldChargerVoltageOther(
                                    value
                                  );
                                  setSalesOldChargerOldChargerVoltage(value);
                                }}
                                placeholder="Enter custom voltage"
                                style={{
                                  width: "100%",
                                  marginTop: "0.35rem",
                                  padding: "0.5rem",
                                  borderRadius: "0.375rem",
                                  border: "1px solid #d1d5db",
                                  fontSize: "0.875rem",
                                }}
                              />
                            )}
                          </div>
                          <div>
                            <label
                              style={{
                                display: "block",
                                marginBottom: "0.25rem",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}
                            >
                              Working condition
                            </label>
                            <div
                              style={{
                                display: "flex",
                                gap: "0.75rem",
                                flexWrap: "wrap",
                              }}
                            >
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.4rem",
                                  cursor: "pointer",
                                  fontSize: "0.875rem",
                                }}
                              >
                                <input
                                  type="radio"
                                  name="salesOldChargerOldChargerWorking"
                                  value="working"
                                  checked={
                                    salesOldChargerOldChargerWorking ===
                                    "working"
                                  }
                                  onChange={(e) =>
                                    setSalesOldChargerOldChargerWorking(
                                      e.target.value
                                    )
                                  }
                                  style={{ width: "0.9rem", height: "0.9rem" }}
                                />
                                Working
                              </label>
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.4rem",
                                  cursor: "pointer",
                                  fontSize: "0.875rem",
                                }}
                              >
                                <input
                                  type="radio"
                                  name="salesOldChargerOldChargerWorking"
                                  value="notWorking"
                                  checked={
                                    salesOldChargerOldChargerWorking ===
                                    "notWorking"
                                  }
                                  onChange={(e) =>
                                    setSalesOldChargerOldChargerWorking(
                                      e.target.value
                                    )
                                  }
                                  style={{ width: "0.9rem", height: "0.9rem" }}
                                />
                                Not working
                              </label>
                            </div>
                          </div>
                        </>
                      )}
                      <div
                        style={{
                          marginTop: "1.5rem",
                          paddingTop: "1rem",
                          borderTop: "1px solid #e5e7eb",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "0.75rem",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSalesChargerOldNew(null);
                            setSalesOldChargerType("");
                            setSalesOldChargerVoltage("");
                            setSalesOldChargerOldChargerAvailable(false);
                            setSalesOldChargerOldChargerVoltage("");
                            setSalesOldChargerOldChargerVoltageOption("");
                            setSalesOldChargerOldChargerVoltageOther("");
                            setSalesOldChargerOldChargerWorking("working");
                          }}
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            backgroundColor: "#3b82f6",
                            color: "white",
                            border: "2px solid #2563eb",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            fontWeight: 600,
                            boxShadow: "0 1px 3px rgba(59, 130, 246, 0.4)",
                          }}
                        >
                          Back
                        </button>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSalesType(null);
                              setSalesChargerOldNew(null);
                              setSalesOldChargerPrice("");
                              setSalesOldChargerType("");
                              setSalesOldChargerVoltage("");
                              setSalesOldChargerQuantity("1");
                              setSalesOldChargerOldChargerAvailable(false);
                              setSalesOldChargerOldChargerVoltage("");
                              setSalesOldChargerOldChargerVoltageOption("");
                              setSalesOldChargerOldChargerVoltageOther("");
                              setSalesOldChargerOldChargerWorking("working");
                            }}
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.875rem",
                              backgroundColor: "#6b7280",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddSalesOldCharger}
                            disabled={oldChargerSaleAddDisabled}
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.875rem",
                              backgroundColor: oldChargerSaleAddDisabled
                                ? "#9ca3af"
                                : "#10b981",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: oldChargerSaleAddDisabled
                                ? "not-allowed"
                                : "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Add to Jobcard
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : loadingChargers ? (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                      Loading chargers...
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#374151",
                          marginBottom: "0.25rem",
                        }}
                      >
                        New Charger
                      </span>

                      {/* Charger battery type filter */}
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.35rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Charger battery type{" "}
                          <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.75rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              cursor: "pointer",
                              fontSize: "0.875rem",
                            }}
                          >
                            <input
                              type="radio"
                              name="salesChargerBatteryType"
                              value="lead"
                              checked={salesChargerBatteryType === "lead"}
                              onChange={(e) => {
                                setSalesChargerBatteryType(e.target.value);
                                setSalesCharger(null);
                              }}
                              style={{ width: "0.9rem", height: "0.9rem" }}
                            />
                            Lead
                          </label>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              cursor: "pointer",
                              fontSize: "0.875rem",
                            }}
                          >
                            <input
                              type="radio"
                              name="salesChargerBatteryType"
                              value="lithium"
                              checked={salesChargerBatteryType === "lithium"}
                              onChange={(e) => {
                                setSalesChargerBatteryType(e.target.value);
                                setSalesCharger(null);
                              }}
                              style={{ width: "0.9rem", height: "0.9rem" }}
                            />
                            Lithium
                          </label>
                        </div>
                      </div>

                      {/* Charger select filtered by battery type */}
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Select Charger{" "}
                          <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <select
                          value={salesCharger?._id || ""}
                          onChange={(e) => {
                            const list = salesChargerBatteryType
                              ? chargers.filter(
                                  (c) =>
                                    c.batteryType === salesChargerBatteryType
                                )
                              : [];
                            const candidate = list.find(
                              (c) => c._id === e.target.value
                            );
                            setSalesCharger(candidate || null);
                          }}
                          disabled={!salesChargerBatteryType}
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.875rem",
                            backgroundColor: !salesChargerBatteryType
                              ? "#f3f4f6"
                              : "white",
                            color: !salesChargerBatteryType
                              ? "#9ca3af"
                              : "#111827",
                          }}
                        >
                          <option value="">
                            {salesChargerBatteryType
                              ? "Select a charger"
                              : "Select charger type first"}
                          </option>
                          {(salesChargerBatteryType
                            ? chargers.filter(
                                (c) => c.batteryType === salesChargerBatteryType
                              )
                            : []
                          ).map((charger) => (
                            <option key={charger._id} value={charger._id}>
                              {charger.name}{" "}
                              {charger.voltage ? `(${charger.voltage})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      {salesCharger && (
                        <>
                          <div>
                            <label
                              style={{
                                display: "block",
                                marginBottom: "0.25rem",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}
                            >
                              Quantity
                            </label>
                            <input
                              type="number"
                              value={salesChargerQuantity}
                              onChange={(e) =>
                                setSalesChargerQuantity(e.target.value)
                              }
                              placeholder="1"
                              min="1"
                              onWheel={(e) => e.target.blur()}
                              style={{
                                width: "100%",
                                padding: "0.5rem",
                                borderRadius: "0.375rem",
                                border: "1px solid #d1d5db",
                                fontSize: "0.875rem",
                              }}
                            />
                          </div>
                          <div>
                            <label
                              style={{
                                display: "block",
                                marginBottom: "0.25rem",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}
                            >
                              Warranty status
                            </label>
                            <select
                              value={salesChargerWarrantyStatus}
                              onChange={(e) =>
                                setSalesChargerWarrantyStatus(e.target.value)
                              }
                              style={{
                                width: "100%",
                                padding: "0.5rem",
                                borderRadius: "0.375rem",
                                border: "1px solid #d1d5db",
                                fontSize: "0.875rem",
                              }}
                            >
                              <option value="noWarranty">No warranty</option>
                              <option value="6months">6 months</option>
                              <option value="1year">1 year</option>
                            </select>
                            <div
                              style={{
                                marginTop: "0.35rem",
                                fontSize: "0.8125rem",
                                color: "#475569",
                                fontWeight: 500,
                              }}
                            >
                              Charger price:{" "}
                              <span
                                style={{ color: "#111827", fontWeight: 600 }}
                              >
                                ₹
                                {(salesChargerWarrantyStatus === "noWarranty"
                                  ? 1100
                                  : salesChargerWarrantyStatus === "6months"
                                  ? 1600
                                  : salesCharger?.sellingPrice || 0
                                ).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={salesChargerOldChargerAvailable}
                                onChange={(e) =>
                                  setSalesChargerOldChargerAvailable(
                                    e.target.checked
                                  )
                                }
                                style={{
                                  width: "1rem",
                                  height: "1rem",
                                  cursor: "pointer",
                                }}
                              />
                              Old charger available
                            </label>
                          </div>
                          {salesChargerOldChargerAvailable && (
                            <>
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    marginBottom: "0.25rem",
                                    fontSize: "0.875rem",
                                    fontWeight: 500,
                                  }}
                                >
                                  Old Charger Voltage{" "}
                                  <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.35rem",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "0.75rem",
                                    }}
                                  >
                                    {["48V", "60V", "72V"].map((v) => (
                                      <label
                                        key={v}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "0.4rem",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <input
                                          type="radio"
                                          name="salesOldChargerVoltage"
                                          value={v}
                                          checked={
                                            salesChargerOldChargerVoltageOption ===
                                            v
                                          }
                                          onChange={(e) => {
                                            setSalesChargerOldChargerVoltageOption(
                                              e.target.value
                                            );
                                            setSalesChargerOldChargerVoltage(
                                              e.target.value
                                            );
                                          }}
                                          style={{
                                            width: "0.9rem",
                                            height: "0.9rem",
                                          }}
                                        />
                                        {v}
                                      </label>
                                    ))}
                                    <label
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.4rem",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <input
                                        type="radio"
                                        name="salesOldChargerVoltage"
                                        value="other"
                                        checked={
                                          salesChargerOldChargerVoltageOption ===
                                          "other"
                                        }
                                        onChange={(e) => {
                                          setSalesChargerOldChargerVoltageOption(
                                            e.target.value
                                          );
                                          setSalesChargerOldChargerVoltage(
                                            salesChargerOldChargerVoltageOther.trim()
                                          );
                                        }}
                                        style={{
                                          width: "0.9rem",
                                          height: "0.9rem",
                                        }}
                                      />
                                      Other
                                    </label>
                                  </div>
                                  {salesChargerOldChargerVoltageOption ===
                                    "other" && (
                                    <input
                                      type="text"
                                      value={salesChargerOldChargerVoltageOther}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setSalesChargerOldChargerVoltageOther(
                                          value
                                        );
                                        setSalesChargerOldChargerVoltage(value);
                                      }}
                                      placeholder="Enter custom voltage"
                                      style={{
                                        width: "100%",
                                        padding: "0.5rem",
                                        borderRadius: "0.375rem",
                                        border: "1px solid #d1d5db",
                                        fontSize: "0.875rem",
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                              <div>
                                <label
                                  style={{
                                    display: "block",
                                    marginBottom: "0.25rem",
                                    fontSize: "0.875rem",
                                    fontWeight: 500,
                                  }}
                                >
                                  Old charger condition
                                </label>
                                <select
                                  value={salesChargerOldChargerWorking}
                                  onChange={(e) =>
                                    setSalesChargerOldChargerWorking(
                                      e.target.value
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "0.5rem",
                                    borderRadius: "0.375rem",
                                    border: "1px solid #d1d5db",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  <option value="working">Working</option>
                                  <option value="notWorking">
                                    Not working
                                  </option>
                                </select>
                              </div>
                            </>
                          )}
                        </>
                      )}
                      <div
                        style={{
                          marginTop: "1.5rem",
                          paddingTop: "1rem",
                          borderTop: "1px solid #e5e7eb",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "0.75rem",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSalesChargerOldNew(null)}
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            backgroundColor: "#3b82f6",
                            color: "white",
                            border: "2px solid #2563eb",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            fontWeight: 600,
                            boxShadow: "0 1px 3px rgba(59, 130, 246, 0.4)",
                          }}
                        >
                          Back
                        </button>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSalesType(null);
                              setSalesCharger(null);
                              setSalesChargerQuantity("1");
                              setSalesChargerWarrantyStatus("noWarranty");
                              setSalesChargerOldChargerAvailable(false);
                              setSalesChargerOldChargerVoltage("");
                              setSalesChargerOldChargerWorking("working");
                              setSalesChargerOldNew(null);
                            }}
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.875rem",
                              backgroundColor: "#6b7280",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddSalesCharger}
                            disabled={
                              !salesCharger ||
                              (salesChargerOldChargerAvailable &&
                                !salesChargerOldChargerVoltage.trim())
                            }
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.875rem",
                              backgroundColor:
                                salesCharger &&
                                (!salesChargerOldChargerAvailable ||
                                  salesChargerOldChargerVoltage.trim())
                                  ? "#10b981"
                                  : "#9ca3af",
                              color: "white",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor:
                                salesCharger &&
                                (!salesChargerOldChargerAvailable ||
                                  salesChargerOldChargerVoltage.trim())
                                  ? "pointer"
                                  : "not-allowed",
                              fontWeight: 500,
                            }}
                          >
                            Add to Jobcard
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Old Scooty Form */}
              {activeTab === "sales" && selectedSalesType === "oldScooty" && (
                <div
                  style={{
                    padding: "1.5rem",
                    marginBottom: "1rem",
                    backgroundColor: "#f9fafb",
                    borderRadius: "0.5rem",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h4
                    style={{
                      marginBottom: "1rem",
                      fontSize: "1rem",
                      fontWeight: 600,
                    }}
                  >
                    Add Old Scooty
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        alignItems: "flex-end",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: "1", minWidth: "140px" }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          PMC No.{" "}
                          <span style={{ color: "#6b7280", fontWeight: 400 }}>
                            (unique identifier)
                          </span>
                        </label>
                        <input
                          type="text"
                          value={oldScootyData.pmcNo}
                          onChange={(e) => {
                            setOldScootyData((prev) => ({
                              ...prev,
                              pmcNo: e.target.value,
                            }));
                            setOldScootyPmcLookupError("");
                          }}
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            (e.preventDefault(), handleOldScootyPmcLookup())
                          }
                          placeholder="e.g. 101 or PMC-101"
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.875rem",
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleOldScootyPmcLookup}
                        disabled={
                          oldScootyPmcLookupLoading ||
                          !(oldScootyData.pmcNo || "").trim()
                        }
                        style={{
                          padding: "0.5rem 1rem",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "white",
                          backgroundColor:
                            oldScootyPmcLookupLoading ||
                            !(oldScootyData.pmcNo || "").trim()
                              ? "#9ca3af"
                              : "#3b82f6",
                          border: "none",
                          borderRadius: "0.375rem",
                          cursor:
                            oldScootyPmcLookupLoading ||
                            !(oldScootyData.pmcNo || "").trim()
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {oldScootyPmcLookupLoading ? "Loading…" : "Get details"}
                      </button>
                    </div>
                    {oldScootyPmcLookupError && (
                      <div style={{ fontSize: "0.8125rem", color: "#dc2626" }}>
                        {oldScootyPmcLookupError}
                      </div>
                    )}
                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.25rem",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                        }}
                      >
                        Old Scooty Name{" "}
                        <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={oldScootyData.name}
                        onChange={(e) =>
                          setOldScootyData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Enter name or fetch by PMC No. above"
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          borderRadius: "0.375rem",
                          border: "1px solid #d1d5db",
                          fontSize: "0.875rem",
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.25rem",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                        }}
                      >
                        Price (₹) <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="number"
                        value={oldScootyData.price}
                        onChange={(e) =>
                          setOldScootyData((prev) => ({
                            ...prev,
                            price: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        style={{
                          width: "100%",
                          maxWidth: "200px",
                          padding: "0.5rem",
                          borderRadius: "0.375rem",
                          border: "1px solid #d1d5db",
                          fontSize: "0.875rem",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        width: "100%",
                        marginTop: "0.5rem",
                        padding: "1rem",
                        borderRadius: "0.5rem",
                        backgroundColor: "#f0f9ff",
                        border: "1px solid #bae6fd",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#0c4a6e",
                        }}
                      >
                        Battery (Lead / Lithium)
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                          marginBottom: "1rem",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.batteryChemistry === "lead"
                                ? "#3b82f6"
                                : "#e5e7eb"
                            }`,
                            backgroundColor:
                              oldScootyData.batteryChemistry === "lead"
                                ? "#eff6ff"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyBatteryChemistry"
                            value="lead"
                            checked={oldScootyData.batteryChemistry === "lead"}
                            onChange={(e) =>
                              setOldScootyData((prev) => ({
                                ...prev,
                                batteryChemistry: e.target.value,
                              }))
                            }
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#3b82f6",
                            }}
                          />
                          Lead
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.batteryChemistry === "lithium"
                                ? "#3b82f6"
                                : "#e5e7eb"
                            }`,
                            backgroundColor:
                              oldScootyData.batteryChemistry === "lithium"
                                ? "#eff6ff"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyBatteryChemistry"
                            value="lithium"
                            checked={
                              oldScootyData.batteryChemistry === "lithium"
                            }
                            onChange={(e) =>
                              setOldScootyData((prev) => ({
                                ...prev,
                                batteryChemistry: e.target.value,
                              }))
                            }
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#3b82f6",
                            }}
                          />
                          Lithium
                        </label>
                      </div>
                      <span
                        style={{
                          display: "block",
                          marginBottom: "0.25rem",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#0c4a6e",
                        }}
                      >
                        Battery voltage
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontSize: "0.75rem",
                          color: "#64748b",
                        }}
                      >
                        48V = 4 battery, 60V = 5 battery, 72V = 6 battery
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                          marginBottom: "1rem",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.batteryVoltage === "48"
                                ? "#0ea5e9"
                                : "#e5e7eb"
                            }`,
                            backgroundColor:
                              oldScootyData.batteryVoltage === "48"
                                ? "#f0f9ff"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyBatteryVoltage"
                            value="48"
                            checked={oldScootyData.batteryVoltage === "48"}
                            onChange={(e) =>
                              setOldScootyData((prev) => ({
                                ...prev,
                                batteryVoltage: e.target.value,
                              }))
                            }
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#0ea5e9",
                            }}
                          />
                          48V (4 battery)
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.batteryVoltage === "60"
                                ? "#0ea5e9"
                                : "#e5e7eb"
                            }`,
                            backgroundColor:
                              oldScootyData.batteryVoltage === "60"
                                ? "#f0f9ff"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyBatteryVoltage"
                            value="60"
                            checked={oldScootyData.batteryVoltage === "60"}
                            onChange={(e) =>
                              setOldScootyData((prev) => ({
                                ...prev,
                                batteryVoltage: e.target.value,
                              }))
                            }
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#0ea5e9",
                            }}
                          />
                          60V (5 battery)
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.batteryVoltage === "72"
                                ? "#0ea5e9"
                                : "#e5e7eb"
                            }`,
                            backgroundColor:
                              oldScootyData.batteryVoltage === "72"
                                ? "#f0f9ff"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyBatteryVoltage"
                            value="72"
                            checked={oldScootyData.batteryVoltage === "72"}
                            onChange={(e) =>
                              setOldScootyData((prev) => ({
                                ...prev,
                                batteryVoltage: e.target.value,
                              }))
                            }
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#0ea5e9",
                            }}
                          />
                          72V (6 battery)
                        </label>
                      </div>
                      <span
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#0c4a6e",
                        }}
                      >
                        Old / New Battery
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                          marginBottom:
                            oldScootyData.batteryType === "newBattery"
                              ? "1rem"
                              : "0",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.batteryType === "oldBattery"
                                ? "#3b82f6"
                                : "#e5e7eb"
                            }`,
                            backgroundColor:
                              oldScootyData.batteryType === "oldBattery"
                                ? "#eff6ff"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyBatteryType"
                            value="oldBattery"
                            checked={oldScootyData.batteryType === "oldBattery"}
                            onChange={(e) => {
                              setOldScootyData((prev) => ({
                                ...prev,
                                batteryType: e.target.value,
                              }));
                              setOldScootySelectedBattery(null);
                            }}
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#3b82f6",
                            }}
                          />
                          Old Battery
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.batteryType === "newBattery"
                                ? "#3b82f6"
                                : "#e5e7eb"
                            }`,
                            backgroundColor:
                              oldScootyData.batteryType === "newBattery"
                                ? "#eff6ff"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyBatteryType"
                            value="newBattery"
                            checked={oldScootyData.batteryType === "newBattery"}
                            onChange={(e) => {
                              setOldScootyData((prev) => ({
                                ...prev,
                                batteryType: e.target.value,
                              }));
                              setOldScootySelectedBattery(null);
                            }}
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#3b82f6",
                            }}
                          />
                          New Battery
                        </label>
                      </div>
                      {oldScootyData.batteryType === "newBattery" && (
                        <div
                          style={{
                            paddingLeft: "0.75rem",
                            borderLeft: "3px solid #0ea5e9",
                          }}
                        >
                          <span
                            style={{
                              display: "block",
                              marginBottom: "0.5rem",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: "#0369a1",
                            }}
                          >
                            Select Battery (from database){" "}
                            <span style={{ color: "#ef4444" }}>*</span>
                          </span>
                          {oldScootyLoadingBatteries ? (
                            <span
                              style={{
                                fontSize: "0.8125rem",
                                color: "#6b7280",
                              }}
                            >
                              Loading...
                            </span>
                          ) : (
                            <select
                              value={oldScootySelectedBattery?._id || ""}
                              onChange={(e) => {
                                const b = oldScootyBatteries.find(
                                  (x) => x._id === e.target.value
                                );
                                setOldScootySelectedBattery(b || null);
                              }}
                              style={{
                                width: "100%",
                                maxWidth: "280px",
                                padding: "0.5rem",
                                borderRadius: "0.375rem",
                                border: "1px solid #d1d5db",
                                fontSize: "0.875rem",
                              }}
                            >
                              <option value="">Select a battery</option>
                              {oldScootyBatteries.map((b) => (
                                <option key={b._id} value={b._id}>
                                  {b.name}{" "}
                                  {b.ampereValue ? `(${b.ampereValue} A)` : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          <span
                            style={{
                              display: "block",
                              marginTop: "1rem",
                              marginBottom: "0.5rem",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: "#0369a1",
                            }}
                          >
                            Battery warranty
                          </span>
                          <div
                            style={{
                              display: "flex",
                              gap: "1rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                cursor: "pointer",
                                padding: "0.5rem 0.75rem",
                                borderRadius: "0.375rem",
                                border: `2px solid ${
                                  oldScootyData.warrantyStatus ===
                                  "withWarranty"
                                    ? "#059669"
                                    : "#e5e7eb"
                                }`,
                                backgroundColor:
                                  oldScootyData.warrantyStatus ===
                                  "withWarranty"
                                    ? "#ecfdf5"
                                    : "#fff",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}
                            >
                              <input
                                type="radio"
                                name="oldScootyWarranty"
                                value="withWarranty"
                                checked={
                                  oldScootyData.warrantyStatus ===
                                  "withWarranty"
                                }
                                onChange={(e) =>
                                  setOldScootyData((prev) => ({
                                    ...prev,
                                    warrantyStatus: e.target.value,
                                  }))
                                }
                                style={{
                                  width: "1rem",
                                  height: "1rem",
                                  accentColor: "#059669",
                                }}
                              />
                              With warranty
                            </label>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                cursor: "pointer",
                                padding: "0.5rem 0.75rem",
                                borderRadius: "0.375rem",
                                border: `2px solid ${
                                  oldScootyData.warrantyStatus ===
                                  "withoutWarranty"
                                    ? "#059669"
                                    : "#e5e7eb"
                                }`,
                                backgroundColor:
                                  oldScootyData.warrantyStatus ===
                                  "withoutWarranty"
                                    ? "#ecfdf5"
                                    : "#fff",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}
                            >
                              <input
                                type="radio"
                                name="oldScootyWarranty"
                                value="withoutWarranty"
                                checked={
                                  oldScootyData.warrantyStatus ===
                                  "withoutWarranty"
                                }
                                onChange={(e) =>
                                  setOldScootyData((prev) => ({
                                    ...prev,
                                    warrantyStatus: e.target.value,
                                  }))
                                }
                                style={{
                                  width: "1rem",
                                  height: "1rem",
                                  accentColor: "#059669",
                                }}
                              />
                              Without warranty
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        width: "100%",
                        marginTop: "0.5rem",
                        padding: "1rem",
                        borderRadius: "0.5rem",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          marginBottom: "0.25rem",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#334155",
                        }}
                      >
                        Charger (Lead / Lithium)
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                          marginBottom: "1rem",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.chargerChemistry === "lead"
                                ? "#64748b"
                                : "#e2e8f0"
                            }`,
                            backgroundColor:
                              oldScootyData.chargerChemistry === "lead"
                                ? "#f1f5f9"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyChargerChemistry"
                            value="lead"
                            checked={oldScootyData.chargerChemistry === "lead"}
                            onChange={(e) =>
                              setOldScootyData((prev) => ({
                                ...prev,
                                chargerChemistry: e.target.value,
                              }))
                            }
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#64748b",
                            }}
                          />
                          Lead
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.chargerChemistry === "lithium"
                                ? "#64748b"
                                : "#e2e8f0"
                            }`,
                            backgroundColor:
                              oldScootyData.chargerChemistry === "lithium"
                                ? "#f1f5f9"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyChargerChemistry"
                            value="lithium"
                            checked={
                              oldScootyData.chargerChemistry === "lithium"
                            }
                            onChange={(e) =>
                              setOldScootyData((prev) => ({
                                ...prev,
                                chargerChemistry: e.target.value,
                              }))
                            }
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#64748b",
                            }}
                          />
                          Lithium
                        </label>
                      </div>
                      <span
                        style={{
                          display: "block",
                          marginBottom: "0.25rem",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#334155",
                        }}
                      >
                        Charger voltage
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontSize: "0.75rem",
                          color: "#64748b",
                        }}
                      >
                        48V = 4 battery, 60V = 5 battery, 72V = 6 battery
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                          marginBottom: "1rem",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.chargerVoltage === "48"
                                ? "#64748b"
                                : "#e2e8f0"
                            }`,
                            backgroundColor:
                              oldScootyData.chargerVoltage === "48"
                                ? "#f1f5f9"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyChargerVoltage"
                            value="48"
                            checked={oldScootyData.chargerVoltage === "48"}
                            onChange={(e) =>
                              setOldScootyData((prev) => ({
                                ...prev,
                                chargerVoltage: e.target.value,
                              }))
                            }
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#64748b",
                            }}
                          />
                          48V (4 battery)
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.chargerVoltage === "60"
                                ? "#64748b"
                                : "#e2e8f0"
                            }`,
                            backgroundColor:
                              oldScootyData.chargerVoltage === "60"
                                ? "#f1f5f9"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyChargerVoltage"
                            value="60"
                            checked={oldScootyData.chargerVoltage === "60"}
                            onChange={(e) =>
                              setOldScootyData((prev) => ({
                                ...prev,
                                chargerVoltage: e.target.value,
                              }))
                            }
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#64748b",
                            }}
                          />
                          60V (5 battery)
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.chargerVoltage === "72"
                                ? "#64748b"
                                : "#e2e8f0"
                            }`,
                            backgroundColor:
                              oldScootyData.chargerVoltage === "72"
                                ? "#f1f5f9"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyChargerVoltage"
                            value="72"
                            checked={oldScootyData.chargerVoltage === "72"}
                            onChange={(e) =>
                              setOldScootyData((prev) => ({
                                ...prev,
                                chargerVoltage: e.target.value,
                              }))
                            }
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#64748b",
                            }}
                          />
                          72V (6 battery)
                        </label>
                      </div>
                      <span
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#334155",
                        }}
                      >
                        Charger Type
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "1rem",
                          flexWrap: "wrap",
                          marginBottom:
                            oldScootyData.chargerType === "newCharger"
                              ? "1rem"
                              : "0",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.chargerType === "oldCharger"
                                ? "#64748b"
                                : "#e2e8f0"
                            }`,
                            backgroundColor:
                              oldScootyData.chargerType === "oldCharger"
                                ? "#f1f5f9"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyCharger"
                            value="oldCharger"
                            checked={oldScootyData.chargerType === "oldCharger"}
                            onChange={(e) => {
                              setOldScootyData((prev) => ({
                                ...prev,
                                chargerType: e.target.value,
                              }));
                              setOldScootySelectedCharger(null);
                            }}
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#64748b",
                            }}
                          />
                          Old Charger
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: `2px solid ${
                              oldScootyData.chargerType === "newCharger"
                                ? "#64748b"
                                : "#e2e8f0"
                            }`,
                            backgroundColor:
                              oldScootyData.chargerType === "newCharger"
                                ? "#f1f5f9"
                                : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          <input
                            type="radio"
                            name="oldScootyCharger"
                            value="newCharger"
                            checked={oldScootyData.chargerType === "newCharger"}
                            onChange={(e) => {
                              setOldScootyData((prev) => ({
                                ...prev,
                                chargerType: e.target.value,
                              }));
                              setOldScootySelectedCharger(null);
                            }}
                            style={{
                              width: "1rem",
                              height: "1rem",
                              accentColor: "#64748b",
                            }}
                          />
                          New Charger
                        </label>
                      </div>
                      {oldScootyData.chargerType === "newCharger" && (
                        <div
                          style={{
                            marginTop: "1rem",
                            paddingLeft: "0.75rem",
                            borderLeft: "3px solid #64748b",
                          }}
                        >
                          <span
                            style={{
                              display: "block",
                              marginBottom: "0.5rem",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: "#475569",
                            }}
                          >
                            Select Charger (from database){" "}
                            <span style={{ color: "#ef4444" }}>*</span>
                          </span>
                          {oldScootyLoadingChargers ? (
                            <span
                              style={{
                                fontSize: "0.8125rem",
                                color: "#6b7280",
                              }}
                            >
                              Loading...
                            </span>
                          ) : (
                            <select
                              value={oldScootySelectedCharger?._id || ""}
                              onChange={(e) => {
                                const c = oldScootyChargers.find(
                                  (x) => x._id === e.target.value
                                );
                                setOldScootySelectedCharger(c || null);
                              }}
                              style={{
                                width: "100%",
                                maxWidth: "280px",
                                padding: "0.5rem",
                                borderRadius: "0.375rem",
                                border: "1px solid #d1d5db",
                                fontSize: "0.875rem",
                              }}
                            >
                              <option value="">Select a charger</option>
                              {oldScootyChargers.map((c) => (
                                <option key={c._id} value={c._id}>
                                  {c.name} {c.voltage ? `(${c.voltage})` : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          <span
                            style={{
                              display: "block",
                              marginTop: "1rem",
                              marginBottom: "0.5rem",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: "#475569",
                            }}
                          >
                            Charger warranty
                          </span>
                          <div
                            style={{
                              display: "flex",
                              gap: "1rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                cursor: "pointer",
                                padding: "0.5rem 0.75rem",
                                borderRadius: "0.375rem",
                                border: `2px solid ${
                                  oldScootyData.chargerWarrantyStatus ===
                                  "noWarranty"
                                    ? "#059669"
                                    : "#e2e8f0"
                                }`,
                                backgroundColor:
                                  oldScootyData.chargerWarrantyStatus ===
                                  "noWarranty"
                                    ? "#ecfdf5"
                                    : "#fff",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}
                            >
                              <input
                                type="radio"
                                name="oldScootyChargerWarranty"
                                value="noWarranty"
                                checked={
                                  oldScootyData.chargerWarrantyStatus ===
                                  "noWarranty"
                                }
                                onChange={(e) =>
                                  setOldScootyData((prev) => ({
                                    ...prev,
                                    chargerWarrantyStatus: e.target.value,
                                  }))
                                }
                                style={{
                                  width: "1rem",
                                  height: "1rem",
                                  accentColor: "#059669",
                                }}
                              />
                              No warranty
                            </label>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                cursor: "pointer",
                                padding: "0.5rem 0.75rem",
                                borderRadius: "0.375rem",
                                border: `2px solid ${
                                  oldScootyData.chargerWarrantyStatus ===
                                  "6months"
                                    ? "#059669"
                                    : "#e2e8f0"
                                }`,
                                backgroundColor:
                                  oldScootyData.chargerWarrantyStatus ===
                                  "6months"
                                    ? "#ecfdf5"
                                    : "#fff",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}
                            >
                              <input
                                type="radio"
                                name="oldScootyChargerWarranty"
                                value="6months"
                                checked={
                                  oldScootyData.chargerWarrantyStatus ===
                                  "6months"
                                }
                                onChange={(e) =>
                                  setOldScootyData((prev) => ({
                                    ...prev,
                                    chargerWarrantyStatus: e.target.value,
                                  }))
                                }
                                style={{
                                  width: "1rem",
                                  height: "1rem",
                                  accentColor: "#059669",
                                }}
                              />
                              6 months
                            </label>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                cursor: "pointer",
                                padding: "0.5rem 0.75rem",
                                borderRadius: "0.375rem",
                                border: `2px solid ${
                                  oldScootyData.chargerWarrantyStatus ===
                                  "1year"
                                    ? "#059669"
                                    : "#e2e8f0"
                                }`,
                                backgroundColor:
                                  oldScootyData.chargerWarrantyStatus ===
                                  "1year"
                                    ? "#ecfdf5"
                                    : "#fff",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                              }}
                            >
                              <input
                                type="radio"
                                name="oldScootyChargerWarranty"
                                value="1year"
                                checked={
                                  oldScootyData.chargerWarrantyStatus ===
                                  "1year"
                                }
                                onChange={(e) =>
                                  setOldScootyData((prev) => ({
                                    ...prev,
                                    chargerWarrantyStatus: e.target.value,
                                  }))
                                }
                                style={{
                                  width: "1rem",
                                  height: "1rem",
                                  accentColor: "#059669",
                                }}
                              />
                              1 year
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        width: "100%",
                        marginTop: "0.5rem",
                        padding: "1rem",
                        borderRadius: "0.5rem",
                        backgroundColor: "#faf5ff",
                        border: "1px solid #e9d5ff",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#5b21b6",
                        }}
                      >
                        Spares used to get it ready
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                          alignItems: "flex-end",
                          marginBottom: "0.75rem",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            flex: "1",
                            minWidth: "140px",
                            position: "relative",
                          }}
                          ref={oldScootySpareSuggestionsRef}
                        >
                          <input
                            ref={oldScootySpareInputRef}
                            type="text"
                            value={oldScootySpareName}
                            onChange={(e) => {
                              setOldScootySpareName(e.target.value);
                              setSelectedSpareForOldScooty(null);
                            }}
                            onFocus={() =>
                              oldScootySpareName.trim() &&
                              setShowOldScootySpareSuggestions(
                                oldScootySpareSuggestions.length > 0
                              )
                            }
                            onKeyDown={(e) => {
                              if (
                                !showOldScootySpareSuggestions ||
                                oldScootySpareSuggestions.length === 0
                              )
                                return;
                              if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setOldScootySpareSelectedIndex((i) =>
                                  i < oldScootySpareSuggestions.length - 1
                                    ? i + 1
                                    : -1
                                );
                              } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setOldScootySpareSelectedIndex((i) =>
                                  i <= 0 ? -1 : i - 1
                                );
                              } else if (
                                e.key === "Enter" &&
                                oldScootySpareSelectedIndex >= 0 &&
                                oldScootySpareSuggestions[
                                  oldScootySpareSelectedIndex
                                ]
                              ) {
                                e.preventDefault();
                                selectOldScootySpareSuggestion(
                                  oldScootySpareSuggestions[
                                    oldScootySpareSelectedIndex
                                  ]
                                );
                              } else if (e.key === "Escape") {
                                setShowOldScootySpareSuggestions(false);
                              }
                            }}
                            placeholder="Type spare name (suggestions from inventory)"
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #e2e8f0",
                              fontSize: "0.875rem",
                            }}
                          />
                          {showOldScootySpareSuggestions &&
                            oldScootySpareSuggestions.length > 0 && (
                              <ul
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  right: 0,
                                  top: "100%",
                                  margin: 0,
                                  marginTop: "2px",
                                  padding: 0,
                                  listStyle: "none",
                                  backgroundColor: "#fff",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "0.375rem",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                  maxHeight: "220px",
                                  overflowY: "auto",
                                  zIndex: 1000,
                                }}
                              >
                                {oldScootySpareSuggestions.map((spare, idx) => (
                                  <li
                                    key={spare._id}
                                    onClick={() =>
                                      selectOldScootySpareSuggestion(spare)
                                    }
                                    onMouseEnter={() =>
                                      setOldScootySpareSelectedIndex(idx)
                                    }
                                    style={{
                                      padding: "0.5rem 0.75rem",
                                      cursor: "pointer",
                                      fontSize: "0.875rem",
                                      backgroundColor:
                                        oldScootySpareSelectedIndex === idx
                                          ? "#ede9fe"
                                          : "transparent",
                                      borderBottom:
                                        idx <
                                        oldScootySpareSuggestions.length - 1
                                          ? "1px solid #f3e8ff"
                                          : "none",
                                    }}
                                  >
                                    <span style={{ fontWeight: 500 }}>
                                      {spare.name}
                                    </span>
                                    <span
                                      style={{
                                        marginLeft: "0.5rem",
                                        color: "#6b7280",
                                        fontSize: "0.8125rem",
                                      }}
                                    >
                                      Qty: {spare.quantity ?? 0}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                        </div>
                        <input
                          type="number"
                          value={oldScootySpareQty}
                          onChange={(e) => setOldScootySpareQty(e.target.value)}
                          placeholder="Qty"
                          min="1"
                          onWheel={(e) => e.target.blur()}
                          style={{
                            width: "70px",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #e2e8f0",
                            fontSize: "0.875rem",
                          }}
                        />
                        {selectedSpareForOldScooty?.hasColors &&
                          Array.isArray(
                            selectedSpareForOldScooty?.colorQuantity
                          ) &&
                          selectedSpareForOldScooty.colorQuantity.length >
                            0 && (
                            <select
                              value={oldScootySpareColor}
                              onChange={(e) =>
                                setOldScootySpareColor(e.target.value)
                              }
                              style={{
                                minWidth: "100px",
                                padding: "0.5rem",
                                borderRadius: "0.375rem",
                                border: "1px solid #e2e8f0",
                                fontSize: "0.875rem",
                                backgroundColor: "#fff",
                              }}
                            >
                              {selectedSpareForOldScooty.colorQuantity.map(
                                (cq) => (
                                  <option
                                    key={cq.color || ""}
                                    value={cq.color || ""}
                                  >
                                    {cq.color || "—"}
                                  </option>
                                )
                              )}
                            </select>
                          )}
                        <button
                          type="button"
                          onClick={handleAddOldScootySpare}
                          disabled={!oldScootySpareName.trim()}
                          style={{
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.875rem",
                            backgroundColor: oldScootySpareName.trim()
                              ? "#7c3aed"
                              : "#c4b5fd",
                            color: "white",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor: oldScootySpareName.trim()
                              ? "pointer"
                              : "not-allowed",
                            fontWeight: 500,
                          }}
                        >
                          Add spare
                        </button>
                      </div>
                      {(oldScootyData.sparesUsed || []).length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.8125rem",
                              fontWeight: 500,
                              color: "#6b7280",
                            }}
                          >
                            Added spares (total:{" "}
                            {(oldScootyData.sparesUsed || []).reduce(
                              (sum, s) =>
                                sum +
                                (typeof s.quantity === "number"
                                  ? s.quantity
                                  : parseInt(s.quantity, 10) || 0),
                              0
                            )}
                            )
                          </span>
                          {(oldScootyData.sparesUsed || []).map((s, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "0.375rem 0.5rem",
                                backgroundColor: "#fff",
                                borderRadius: "0.25rem",
                                border: "1px solid #e2e8f0",
                                fontSize: "0.875rem",
                              }}
                            >
                              <span>
                                <span style={{ fontWeight: 500 }}>
                                  {s.name}
                                </span>
                                {s.color ? (
                                  <span
                                    style={{
                                      marginLeft: "0.25rem",
                                      color: "#6b7280",
                                    }}
                                  >
                                    ({s.color})
                                  </span>
                                ) : null}{" "}
                                ×{" "}
                                {typeof s.quantity === "number"
                                  ? s.quantity
                                  : parseInt(s.quantity, 10) || 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveOldScootySpare(idx)}
                                style={{
                                  padding: "0.25rem 0.5rem",
                                  fontSize: "0.75rem",
                                  color: "#dc2626",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: 500,
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.5rem",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSalesType(null);
                          setOldScootyData({
                            pmcNo: "",
                            name: "",
                            price: "",
                            quantity: "1",
                            batteryChemistry: "lead",
                            batteryVoltage: "48",
                            batteryType: "oldBattery",
                            chargerType: "oldCharger",
                            chargerChemistry: "lead",
                            chargerVoltage: "48",
                            warrantyStatus: "withoutWarranty",
                            chargerWarrantyStatus: "noWarranty",
                            sparesUsed: [],
                          });
                          setOldScootySpareName("");
                          setOldScootySpareQty("1");
                          setOldScootySpareColor("");
                          setOldScootyPmcLookupError("");
                          setOldScootySelectedBattery(null);
                          setOldScootySelectedCharger(null);
                        }}
                        style={{
                          padding: "0.5rem 1rem",
                          fontSize: "0.875rem",
                          backgroundColor: "#6b7280",
                          color: "white",
                          border: "none",
                          borderRadius: "0.375rem",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddOldScooty}
                        style={{
                          padding: "0.5rem 1rem",
                          fontSize: "0.875rem",
                          backgroundColor: "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: "0.375rem",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        Add to Jobcard
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showSearch && (
                <div className="search-container">
                  <SparePartsSearch onSelectPart={handlePartSelect} />
                </div>
              )}

              {showCustomSpare && (
                <div
                  style={{
                    padding: "1.5rem",
                    marginBottom: "1rem",
                    backgroundColor: "#f9fafb",
                    borderRadius: "0.5rem",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h4
                    style={{
                      marginBottom: "1rem",
                      fontSize: "1rem",
                      fontWeight: 600,
                    }}
                  >
                    Add Custom Spare Part
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.25rem",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                        }}
                      >
                        Spare Part Name{" "}
                        <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={customSpareData.name}
                        onChange={(e) =>
                          setCustomSpareData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Enter spare part name"
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          borderRadius: "0.375rem",
                          border: "1px solid #d1d5db",
                          fontSize: "0.875rem",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Price for 1 Quantity (₹){" "}
                          <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="number"
                          value={customSpareData.price}
                          onChange={(e) =>
                            setCustomSpareData((prev) => ({
                              ...prev,
                              price: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.875rem",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={customSpareData.quantity}
                          onChange={(e) =>
                            setCustomSpareData((prev) => ({
                              ...prev,
                              quantity: e.target.value, // allow empty while typing/backspacing
                            }))
                          }
                          placeholder="1"
                          min="1"
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.875rem",
                          }}
                        />
                      </div>
                    </div>
                    {activeTab === "service" && (
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          Color (Optional)
                        </label>
                        <input
                          type="text"
                          value={customSpareData.color}
                          onChange={(e) =>
                            setCustomSpareData((prev) => ({
                              ...prev,
                              color: e.target.value,
                            }))
                          }
                          placeholder="Enter color (e.g., black, white)"
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #d1d5db",
                            fontSize: "0.875rem",
                          }}
                        />
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.5rem",
                      }}
                    >
                      <button
                        type="button"
                        onClick={toggleCustomSpare}
                        style={{
                          padding: "0.5rem 1rem",
                          fontSize: "0.875rem",
                          backgroundColor: "#6b7280",
                          color: "white",
                          border: "none",
                          borderRadius: "0.375rem",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomSpare}
                        style={{
                          padding: "0.5rem 1rem",
                          fontSize: "0.875rem",
                          backgroundColor: "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: "0.375rem",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        Add to Jobcard
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Display parts for the active tab */}
              {activeTab &&
                selectedParts[activeTab] &&
                selectedParts[activeTab].length > 0 && (
                  <div className="selected-parts">
                    <h4>Selected Parts</h4>
                    <div className="parts-list">
                      {selectedParts[activeTab].map((part) => (
                        <div
                          key={part.id}
                          style={{
                            padding: "1.5rem",
                            marginBottom: "1rem",
                            display: "flex",
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "2.5rem",
                            width: "100%",
                            backgroundColor: "#ffffff",
                            borderRadius: "8px",
                            border: "1px solid #e5e7eb",
                            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow =
                              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
                            e.currentTarget.style.borderColor = "#d1d5db";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow =
                              "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
                            e.currentTarget.style.borderColor = "#e5e7eb";
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                                marginBottom: "0.5rem",
                                flexWrap: "wrap",
                              }}
                            >
                              <h4
                                style={{
                                  fontWeight: 600,
                                  fontSize: "1.125rem",
                                  margin: 0,
                                  color: "#111827",
                                  lineHeight: "1.5",
                                  letterSpacing: "-0.01em",
                                }}
                              >
                                {part.name}
                              </h4>
                              {part.replacementType && (
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    padding: "0.25rem 0.5rem",
                                    backgroundColor:
                                      part.replacementType === "battery"
                                        ? "#dbeafe"
                                        : part.replacementType === "charger"
                                        ? "#fef3c7"
                                        : part.replacementType === "controller"
                                        ? "#e0e7ff"
                                        : part.replacementType === "motor"
                                        ? "#fce7f3"
                                        : "#f3f4f6",
                                    color:
                                      part.replacementType === "battery"
                                        ? "#1e40af"
                                        : part.replacementType === "charger"
                                        ? "#92400e"
                                        : part.replacementType === "controller"
                                        ? "#3730a3"
                                        : part.replacementType === "motor"
                                        ? "#9f1239"
                                        : "#374151",
                                    borderRadius: "4px",
                                    fontWeight: 600,
                                    textTransform: "capitalize",
                                    border: "1px solid",
                                    borderColor:
                                      part.replacementType === "battery"
                                        ? "#93c5fd"
                                        : part.replacementType === "charger"
                                        ? "#fde68a"
                                        : part.replacementType === "controller"
                                        ? "#c7d2fe"
                                        : part.replacementType === "motor"
                                        ? "#fbcfe8"
                                        : "#d1d5db",
                                  }}
                                >
                                  {part.replacementType}
                                </span>
                              )}
                              {part.salesType && (
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    padding: "0.25rem 0.5rem",
                                    backgroundColor:
                                      part.salesType === "battery"
                                        ? "#dbeafe"
                                        : part.salesType === "charger"
                                        ? "#fef3c7"
                                        : part.salesType === "oldScooty"
                                        ? "#fce7f3"
                                        : part.salesType === "spare"
                                        ? "#e0e7ff"
                                        : "#f3f4f6",
                                    color:
                                      part.salesType === "battery"
                                        ? "#1e40af"
                                        : part.salesType === "charger"
                                        ? "#92400e"
                                        : part.salesType === "oldScooty"
                                        ? "#9f1239"
                                        : part.salesType === "spare"
                                        ? "#3730a3"
                                        : "#374151",
                                    borderRadius: "4px",
                                    fontWeight: 600,
                                    textTransform: "capitalize",
                                    border: "1px solid",
                                    borderColor:
                                      part.salesType === "battery"
                                        ? "#93c5fd"
                                        : part.salesType === "charger"
                                        ? "#fde68a"
                                        : part.salesType === "oldScooty"
                                        ? "#fbcfe8"
                                        : part.salesType === "spare"
                                        ? "#c7d2fe"
                                        : "#d1d5db",
                                  }}
                                >
                                  {part.salesType === "oldScooty"
                                    ? "Old Scooty"
                                    : part.salesType}
                                </span>
                              )}
                            </div>
                            {/* Show details for replacement parts */}
                            {part.partType === "replacement" && (
                              <div style={{ marginBottom: "0.75rem" }}>
                                {part.replacementType === "battery" && (
                                  <div
                                    style={{
                                      fontSize: "0.875rem",
                                      color: "#374151",
                                      marginTop: "0.5rem",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "0.25rem",
                                    }}
                                  >
                                    {part.ampereValue &&
                                    part.ampereValue.trim() !== "" ? (
                                      <span style={{ fontWeight: 500 }}>
                                        Ampere:{" "}
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: "#111827",
                                          }}
                                        >
                                          {part.ampereValue} A
                                        </span>
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          fontWeight: 500,
                                          color: "#9ca3af",
                                        }}
                                      >
                                        Ampere: Not specified
                                      </span>
                                    )}
                                    {part.replacementFromCompany !==
                                      undefined && (
                                      <span style={{ fontWeight: 500 }}>
                                        Replacement:{" "}
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: part.replacementFromCompany
                                              ? "#059669"
                                              : "#dc2626",
                                          }}
                                        >
                                          {part.replacementFromCompany
                                            ? "From Company"
                                            : "Not from Company"}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                )}
                                {part.replacementType === "charger" && (
                                  <div
                                    style={{
                                      fontSize: "0.875rem",
                                      color: "#374151",
                                      marginTop: "0.5rem",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "0.25rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "1rem",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      {part.batteryType && (
                                        <span style={{ fontWeight: 500 }}>
                                          <span style={{ fontWeight: 400 }}>
                                            Batt. Type:
                                          </span>{" "}
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              color: "#111827",
                                            }}
                                          >
                                            {part.batteryType}
                                          </span>
                                        </span>
                                      )}
                                      {part.voltage && (
                                        <span style={{ fontWeight: 500 }}>
                                          <span style={{ fontWeight: 400 }}>
                                            Voltage-Ampere:
                                          </span>{" "}
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              color: "#111827",
                                            }}
                                          >
                                            {part.voltage}
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                    {part.oldChargerName && (
                                      <span style={{ fontWeight: 500 }}>
                                        Old Charger:{" "}
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: "#111827",
                                          }}
                                        >
                                          {part.oldChargerName}
                                        </span>
                                        {part.oldChargerVoltage && (
                                          <span
                                            style={{
                                              fontWeight: 400,
                                              color: "#6b7280",
                                            }}
                                          >
                                            {" "}
                                            ({part.oldChargerVoltage})
                                          </span>
                                        )}
                                      </span>
                                    )}
                                    {part.replacementFromCompany !==
                                      undefined && (
                                      <span style={{ fontWeight: 500 }}>
                                        Replacement:{" "}
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: part.replacementFromCompany
                                              ? "#059669"
                                              : "#dc2626",
                                          }}
                                        >
                                          {part.replacementFromCompany
                                            ? "From Company"
                                            : "Not from Company"}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                )}
                                {part.replacementType === "controller" && (
                                  <div
                                    style={{
                                      fontSize: "0.875rem",
                                      color: "#6b7280",
                                      marginTop: "0.5rem",
                                    }}
                                  >
                                    Controller
                                  </div>
                                )}
                                {part.replacementType === "motor" && (
                                  <div
                                    style={{
                                      fontSize: "0.875rem",
                                      color: "#6b7280",
                                      marginTop: "0.5rem",
                                    }}
                                  >
                                    Motor
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Show details for sales parts */}
                            {part.partType === "sales" && (
                              <div style={{ marginBottom: "0.75rem" }}>
                                {part.salesType === "battery" && (
                                  <div
                                    style={{
                                      fontSize: "0.875rem",
                                      color: "#374151",
                                      marginTop: "0.5rem",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "0.25rem",
                                    }}
                                  >
                                    {(part.batteryOldNew === "old" ||
                                      part.batteryOldNew === "new") && (
                                      <span style={{ fontWeight: 500 }}>
                                        Type:{" "}
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: "#111827",
                                          }}
                                        >
                                          {part.batteryOldNew === "old"
                                            ? "Old Battery"
                                            : "New Battery"}
                                        </span>
                                      </span>
                                    )}
                                    {part.batteryOldNew !== "old" &&
                                    part.ampereValue &&
                                    part.ampereValue.trim() !== "" ? (
                                      <span style={{ fontWeight: 500 }}>
                                        Ampere:{" "}
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: "#111827",
                                          }}
                                        >
                                          {part.ampereValue} A
                                        </span>
                                      </span>
                                    ) : part.batteryOldNew !== "old" ? (
                                      <span
                                        style={{
                                          fontWeight: 500,
                                          color: "#9ca3af",
                                        }}
                                      >
                                        Ampere: Not specified
                                      </span>
                                    ) : null}
                                    {part.batteryOldNew !== "old" &&
                                      part.warrantyStatus !== undefined && (
                                        <span style={{ fontWeight: 500 }}>
                                          Warranty:{" "}
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              color:
                                                part.warrantyStatus ===
                                                "warranty"
                                                  ? "#059669"
                                                  : "#6b7280",
                                            }}
                                          >
                                            {part.warrantyStatus === "warranty"
                                              ? "Warranty"
                                              : "No Warranty"}
                                          </span>
                                        </span>
                                      )}
                                    {part.scrapAvailable !== undefined && (
                                      <span style={{ fontWeight: 500 }}>
                                        Scrap Available:{" "}
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: part.scrapAvailable
                                              ? "#059669"
                                              : "#dc2626",
                                          }}
                                        >
                                          {part.scrapAvailable ? "Yes" : "No"}
                                        </span>
                                        {part.scrapAvailable &&
                                          part.scrapQuantity != null &&
                                          part.scrapQuantity > 0 && (
                                            <span
                                              style={{
                                                marginLeft: "0.5rem",
                                                fontWeight: 600,
                                                color: "#111827",
                                              }}
                                            >
                                              (Qty: {part.scrapQuantity})
                                            </span>
                                          )}
                                      </span>
                                    )}
                                    {part.scrapAvailable &&
                                      part.scrapQuantity > 0 &&
                                      (part.scrapPricePerUnit ?? 0) > 0 && (
                                        <span
                                          style={{
                                            fontWeight: 500,
                                            display: "block",
                                            marginTop: "0.25rem",
                                          }}
                                        >
                                          Scrap deduction:{" "}
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              color: "#059669",
                                            }}
                                          >
                                            ₹
                                            {(
                                              part.scrapQuantity *
                                              (part.scrapPricePerUnit ?? 0)
                                            ).toFixed(2)}
                                          </span>
                                          <span
                                            style={{
                                              color: "#6b7280",
                                              marginLeft: "0.25rem",
                                            }}
                                          >
                                            ({part.scrapQuantity} × ₹
                                            {(
                                              part.scrapPricePerUnit ?? 0
                                            ).toFixed(2)}
                                            )
                                          </span>
                                        </span>
                                      )}
                                  </div>
                                )}
                                {part.salesType === "charger" && (
                                  <div
                                    style={{
                                      fontSize: "0.875rem",
                                      color: "#374151",
                                      marginTop: "0.5rem",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "0.25rem",
                                    }}
                                  >
                                    {(part.chargerOldNew === "old" ||
                                      part.chargerOldNew === "new") && (
                                      <span style={{ fontWeight: 500 }}>
                                        Type:{" "}
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: "#111827",
                                          }}
                                        >
                                          {part.chargerOldNew === "old"
                                            ? "Old Charger"
                                            : "New Charger"}
                                        </span>
                                      </span>
                                    )}
                                    {part.chargerOldNew === "old" &&
                                      part.voltage && (
                                        <span style={{ fontWeight: 500 }}>
                                          Voltage:{" "}
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              color: "#111827",
                                            }}
                                          >
                                            {part.voltage}
                                          </span>
                                        </span>
                                      )}
                                    {part.chargerOldNew !== "old" &&
                                      part.warrantyStatus !== undefined && (
                                        <span style={{ fontWeight: 500 }}>
                                          Warranty:{" "}
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              color: "#111827",
                                            }}
                                          >
                                            {part.warrantyStatus ===
                                            "noWarranty"
                                              ? "No warranty"
                                              : part.warrantyStatus ===
                                                "6months"
                                              ? "6 months"
                                              : part.warrantyStatus === "1year"
                                              ? "1 year"
                                              : part.warrantyStatus}
                                          </span>
                                        </span>
                                      )}
                                    {part.chargerOldNew !== "old" && (
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: "1rem",
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        {part.batteryType && (
                                          <span style={{ fontWeight: 500 }}>
                                            <span style={{ fontWeight: 400 }}>
                                              Batt. Type:
                                            </span>{" "}
                                            <span
                                              style={{
                                                fontWeight: 600,
                                                color: "#111827",
                                              }}
                                            >
                                              {part.batteryType}
                                            </span>
                                          </span>
                                        )}
                                        {part.voltage && (
                                          <span style={{ fontWeight: 500 }}>
                                            <span style={{ fontWeight: 400 }}>
                                              Voltage-Ampere:
                                            </span>{" "}
                                            <span
                                              style={{
                                                fontWeight: 600,
                                                color: "#111827",
                                              }}
                                            >
                                              {part.voltage}
                                            </span>
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {part.oldChargerAvailable &&
                                      (part.oldChargerVoltage ||
                                        part.oldChargerWorking != null) && (
                                        <span style={{ fontWeight: 500 }}>
                                          Old charger available:
                                          {part.oldChargerVoltage && (
                                            <span
                                              style={{
                                                fontWeight: 600,
                                                color: "#111827",
                                                marginLeft: "0.25rem",
                                              }}
                                            >
                                              {part.oldChargerVoltage}
                                            </span>
                                          )}
                                          {part.oldChargerWorking != null && (
                                            <span
                                              style={{
                                                marginLeft: "0.5rem",
                                                fontWeight: 600,
                                                color:
                                                  part.oldChargerWorking ===
                                                  "working"
                                                    ? "#059669"
                                                    : "#dc2626",
                                              }}
                                            >
                                              •{" "}
                                              {part.oldChargerWorking ===
                                              "working"
                                                ? "Working"
                                                : "Not working"}
                                            </span>
                                          )}
                                        </span>
                                      )}
                                  </div>
                                )}
                                {part.salesType === "oldScooty" && (
                                  <div
                                    style={{
                                      fontSize: "0.875rem",
                                      color: "#374151",
                                      marginTop: "0.5rem",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "0.25rem",
                                    }}
                                  >
                                    {part.pmcNo && (
                                      <span style={{ fontWeight: 500 }}>
                                        PMC No.:{" "}
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: "#111827",
                                          }}
                                        >
                                          {String(part.pmcNo).replace(
                                            /^PMC-?/i,
                                            ""
                                          )
                                            ? `PMC-${String(part.pmcNo).replace(
                                                /^PMC-?/i,
                                                ""
                                              )}`
                                            : part.pmcNo}
                                        </span>
                                      </span>
                                    )}
                                    {(part.batteryChemistry ||
                                      part.batteryVoltage ||
                                      part.batteryType) && (
                                      <span style={{ fontWeight: 500 }}>
                                        Battery:{" "}
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: "#111827",
                                          }}
                                        >
                                          {[
                                            part.batteryChemistry
                                              ? part.batteryChemistry === "lead"
                                                ? "Lead"
                                                : part.batteryChemistry ===
                                                  "lithium"
                                                ? "Lithium"
                                                : part.batteryChemistry
                                              : part.batteryType === "lead" ||
                                                part.batteryType === "lithium"
                                              ? part.batteryType === "lead"
                                                ? "Lead"
                                                : "Lithium"
                                              : null,
                                            part.batteryVoltage
                                              ? `${part.batteryVoltage}V`
                                              : null,
                                            part.batteryType === "oldBattery" ||
                                            part.batteryType === "newBattery"
                                              ? part.batteryType ===
                                                "oldBattery"
                                                ? "Old Battery"
                                                : "New Battery"
                                              : null,
                                          ]
                                            .filter(Boolean)
                                            .join(", ")}
                                        </span>
                                      </span>
                                    )}
                                    {part.batteryType === "newBattery" &&
                                      part.batteryName && (
                                        <span style={{ fontWeight: 500 }}>
                                          Battery:{" "}
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              color: "#111827",
                                            }}
                                          >
                                            {part.batteryName}
                                          </span>
                                        </span>
                                      )}
                                    {part.batteryType === "newBattery" &&
                                      part.warrantyStatus && (
                                        <span style={{ fontWeight: 500 }}>
                                          Battery warranty:{" "}
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              color:
                                                part.warrantyStatus ===
                                                "withWarranty"
                                                  ? "#059669"
                                                  : "#6b7280",
                                            }}
                                          >
                                            {part.warrantyStatus ===
                                            "withWarranty"
                                              ? "With warranty"
                                              : "Without warranty"}
                                          </span>
                                        </span>
                                      )}
                                    {part.chargerType && (
                                      <span style={{ fontWeight: 500 }}>
                                        Charger:{" "}
                                        <span
                                          style={{
                                            fontWeight: 600,
                                            color: "#111827",
                                          }}
                                        >
                                          {[
                                            part.chargerType === "oldCharger"
                                              ? "Old Charger"
                                              : part.chargerType ===
                                                "newCharger"
                                              ? "New Charger"
                                              : part.chargerType,
                                            part.chargerChemistry
                                              ? part.chargerChemistry === "lead"
                                                ? "Lead"
                                                : part.chargerChemistry ===
                                                  "lithium"
                                                ? "Lithium"
                                                : part.chargerChemistry
                                              : null,
                                            part.chargerVoltage
                                              ? `${part.chargerVoltage}V (${
                                                  part.chargerVoltage === "48"
                                                    ? "4"
                                                    : part.chargerVoltage ===
                                                      "60"
                                                    ? "5"
                                                    : "6"
                                                } battery)`
                                              : null,
                                          ]
                                            .filter(Boolean)
                                            .join(", ")}
                                        </span>
                                      </span>
                                    )}
                                    {part.chargerType === "newCharger" &&
                                      part.chargerName && (
                                        <span style={{ fontWeight: 500 }}>
                                          Charger:{" "}
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              color: "#111827",
                                            }}
                                          >
                                            {part.chargerName}
                                          </span>
                                        </span>
                                      )}
                                    {part.chargerType === "newCharger" &&
                                      part.chargerWarrantyStatus && (
                                        <span style={{ fontWeight: 500 }}>
                                          Charger warranty:{" "}
                                          <span
                                            style={{
                                              fontWeight: 600,
                                              color: "#111827",
                                            }}
                                          >
                                            {part.chargerWarrantyStatus ===
                                            "noWarranty"
                                              ? "No warranty"
                                              : part.chargerWarrantyStatus ===
                                                "6months"
                                              ? "6 months"
                                              : part.chargerWarrantyStatus ===
                                                "1year"
                                              ? "1 year"
                                              : part.chargerWarrantyStatus}
                                          </span>
                                        </span>
                                      )}
                                    {part.sparesUsed &&
                                      part.sparesUsed.length > 0 &&
                                      (() => {
                                        const total = part.sparesUsed.reduce(
                                          (sum, s) => sum + (s.quantity || 0),
                                          0
                                        );
                                        return (
                                          <span style={{ fontWeight: 500 }}>
                                            Spares used to get ready:{" "}
                                            <span
                                              style={{
                                                fontWeight: 600,
                                                color: "#111827",
                                              }}
                                            >
                                              {total}
                                            </span>
                                            <span
                                              style={{
                                                color: "#6b7280",
                                                marginLeft: "0.25rem",
                                              }}
                                            >
                                              (
                                              {part.sparesUsed
                                                .map(
                                                  (s) =>
                                                    `${s.name}${
                                                      s.color
                                                        ? ` (${s.color})`
                                                        : ""
                                                    } × ${s.quantity || 1}`
                                                )
                                                .join(", ")}
                                              )
                                            </span>
                                          </span>
                                        );
                                      })()}
                                  </div>
                                )}
                                {part.salesType === "spare" && (
                                  <div
                                    style={{
                                      fontSize: "0.875rem",
                                      color: "#6b7280",
                                      marginTop: "0.5rem",
                                    }}
                                  >
                                    Spare Part
                                  </div>
                                )}
                              </div>
                            )}
                            {part.models && part.models.length > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "0.5rem",
                                  marginBottom: "1rem",
                                }}
                              >
                                {part.models.map((model, index) => (
                                  <span
                                    key={index}
                                    style={{
                                      fontSize: "0.8125rem",
                                      padding: "0.375rem 0.75rem",
                                      backgroundColor: "#f8fafc",
                                      color: "#475569",
                                      borderRadius: "6px",
                                      fontWeight: 500,
                                      border: "1px solid #e2e8f0",
                                      letterSpacing: "0.01em",
                                    }}
                                  >
                                    {model}
                                  </span>
                                ))}
                              </div>
                            )}
                            {activeTab === "service" &&
                              part.hasColors &&
                              part.availableColors &&
                              part.availableColors.length > 0 && (
                                <div
                                  style={{
                                    marginBottom: "1rem",
                                  }}
                                >
                                  <label
                                    style={{
                                      display: "block",
                                      fontSize: "0.8125rem",
                                      fontWeight: 500,
                                      color: "#475569",
                                      marginBottom: "0.5rem",
                                    }}
                                  >
                                    Color
                                  </label>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.75rem",
                                    }}
                                  >
                                    <select
                                      value={part.selectedColor || ""}
                                      onChange={(e) =>
                                        handleColorChange(
                                          part.id,
                                          e.target.value,
                                          activeTab
                                        )
                                      }
                                      style={{
                                        padding: "0.5rem 0.75rem",
                                        fontSize: "0.875rem",
                                        border: "1px solid #d1d5db",
                                        borderRadius: "6px",
                                        backgroundColor: "white",
                                        color: "#111827",
                                        cursor: "pointer",
                                        outline: "none",
                                        minWidth: "120px",
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.borderColor = "#3b82f6";
                                        e.target.style.boxShadow =
                                          "0 0 0 3px rgba(59, 130, 246, 0.1)";
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor = "#d1d5db";
                                        e.target.style.boxShadow = "none";
                                      }}
                                    >
                                      {part.availableColors.map(
                                        (color, index) => (
                                          <option key={index} value={color}>
                                            {color}
                                          </option>
                                        )
                                      )}
                                    </select>
                                    {part.selectedColor && (
                                      <div
                                        style={{
                                          width: "32px",
                                          height: "32px",
                                          borderRadius: "6px",
                                          border: "2px solid #d1d5db",
                                          backgroundColor: getColorHex(
                                            part.selectedColor
                                          ).includes("gradient")
                                            ? "transparent"
                                            : getColorHex(part.selectedColor),
                                          background: getColorHex(
                                            part.selectedColor
                                          ),
                                          backgroundImage: getColorHex(
                                            part.selectedColor
                                          ).includes("gradient")
                                            ? getColorHex(part.selectedColor)
                                            : "none",
                                          flexShrink: 0,
                                          boxShadow:
                                            "0 1px 2px rgba(0, 0, 0, 0.1)",
                                        }}
                                        title={part.selectedColor}
                                      />
                                    )}
                                  </div>
                                </div>
                              )}
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: "1rem",
                                color: "#0f172a",
                                marginTop: "0.5rem",
                                fontFamily:
                                  "system-ui, -apple-system, sans-serif",
                              }}
                            >
                              {part.partType === "replacement" &&
                              part.replacementType === "battery" ? (
                                // For battery replacement, show total price (price per battery × quantity)
                                <>
                                  ₹
                                  {(
                                    part.price * (part.selectedQuantity || 1)
                                  ).toFixed(2)}
                                </>
                              ) : part.partType === "sales" &&
                                part.salesType === "battery" ? (
                                // For sales battery: show net price after scrap deduction
                                <>₹{getPartTotal(part).toFixed(2)}</>
                              ) : part.partType === "sales" &&
                                part.salesType === "charger" ? (
                                // For sales charger: show total (charger may have scrap deduction)
                                <>₹{getPartTotal(part).toFixed(2)}</>
                              ) : (
                                // For other parts, show unit price
                                <>₹{part.price.toFixed(2)}</>
                              )}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              justifyContent: "center",
                              gap: "1rem",
                              flexShrink: 0,
                            }}
                          >
                            {part.salesType !== "oldScooty" && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0",
                                  backgroundColor: "#ffffff",
                                  padding: "0",
                                  borderRadius: "6px",
                                  border: "1px solid #d1d5db",
                                  overflow: "hidden",
                                  width: "126px",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if ((part.selectedQuantity || 1) <= 1) {
                                      alert("Quantity cannot be less than 1");
                                    } else {
                                      decreaseQuantity(part.id, activeTab);
                                    }
                                  }}
                                  disabled={(part.selectedQuantity || 1) <= 1}
                                  title={
                                    (part.selectedQuantity || 1) <= 1
                                      ? "Quantity cannot be less than 1"
                                      : ""
                                  }
                                  style={{
                                    width: "38px",
                                    height: "38px",
                                    flex: "0 0 38px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor:
                                      (part.selectedQuantity || 1) <= 1
                                        ? "#cbd5e1"
                                        : "#3b82f6",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRight: "1px solid #d1d5db",
                                    cursor:
                                      (part.selectedQuantity || 1) <= 1
                                        ? "not-allowed"
                                        : "pointer",
                                    fontSize: "1.125rem",
                                    fontWeight: 500,
                                    transition: "all 0.15s ease",
                                    padding: 0,
                                    margin: 0,
                                    boxSizing: "border-box",
                                    outline: "none",
                                    WebkitAppearance: "none",
                                    MozAppearance: "none",
                                    appearance: "none",
                                    opacity:
                                      (part.selectedQuantity || 1) <= 1
                                        ? 0.5
                                        : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if ((part.selectedQuantity || 1) > 1) {
                                      e.target.style.backgroundColor =
                                        "#2563eb";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if ((part.selectedQuantity || 1) > 1) {
                                      e.target.style.backgroundColor =
                                        "#3b82f6";
                                    }
                                  }}
                                >
                                  −
                                </button>
                                <div
                                  style={{
                                    width: "50px",
                                    height: "38px",
                                    flex: "0 0 50px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: "transparent",
                                    borderLeft: "1px solid #d1d5db",
                                    borderRight: "1px solid #d1d5db",
                                    fontSize: "0.9375rem",
                                    fontWeight: 600,
                                    color: "#0f172a",
                                    boxSizing: "border-box",
                                  }}
                                >
                                  {part.selectedQuantity || 1}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const maxQty = getMaxQuantity(part);
                                    if (
                                      (part.selectedQuantity || 1) >= maxQty
                                    ) {
                                      alert(
                                        `Maximum quantity reached. Available: ${maxQty}`
                                      );
                                    } else {
                                      increaseQuantity(part.id, activeTab);
                                    }
                                  }}
                                  disabled={
                                    (part.selectedQuantity || 1) >=
                                    getMaxQuantity(part)
                                  }
                                  title={
                                    (part.selectedQuantity || 1) >=
                                    getMaxQuantity(part)
                                      ? `Maximum quantity reached. Available: ${getMaxQuantity(
                                          part
                                        )}`
                                      : ""
                                  }
                                  style={{
                                    width: "38px",
                                    height: "38px",
                                    flex: "0 0 38px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor:
                                      (part.selectedQuantity || 1) >=
                                      getMaxQuantity(part)
                                        ? "#cbd5e1"
                                        : "#3b82f6",
                                    color: "#ffffff",
                                    border: "none",
                                    borderLeft: "1px solid #d1d5db",
                                    cursor:
                                      (part.selectedQuantity || 1) >=
                                      getMaxQuantity(part)
                                        ? "not-allowed"
                                        : "pointer",
                                    fontSize: "1.125rem",
                                    fontWeight: 500,
                                    transition: "all 0.15s ease",
                                    padding: 0,
                                    margin: 0,
                                    boxSizing: "border-box",
                                    outline: "none",
                                    WebkitAppearance: "none",
                                    MozAppearance: "none",
                                    appearance: "none",
                                    opacity:
                                      (part.selectedQuantity || 1) >=
                                      getMaxQuantity(part)
                                        ? 0.5
                                        : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (
                                      (part.selectedQuantity || 1) <
                                      getMaxQuantity(part)
                                    ) {
                                      e.target.style.backgroundColor =
                                        "#2563eb";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (
                                      (part.selectedQuantity || 1) <
                                      getMaxQuantity(part)
                                    ) {
                                      e.target.style.backgroundColor =
                                        "#3b82f6";
                                    }
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removePart(part.id, activeTab)}
                              style={{
                                padding: "0.5rem 1rem",
                                fontSize: "0.875rem",
                                backgroundColor: "#ef4444",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: 500,
                                width: "126px",
                                transition: "all 0.15s ease",
                                letterSpacing: "0.01em",
                                boxSizing: "border-box",
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = "#dc2626";
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = "#ef4444";
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Things added to jobcard - consolidated view */}
        {false && (
          <div className="form-section" style={{ marginTop: "1.5rem" }}>
            <div
              style={{
                padding: "1rem 1.5rem",
                backgroundColor: "#eff6ff",
                borderRadius: "0.5rem 0.5rem 0 0",
                border: "1px solid #bfdbfe",
                borderBottom: "none",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "#1e40af",
                }}
              >
                Things added to jobcard
              </h3>
              <p
                style={{
                  margin: "0.25rem 0 0",
                  fontSize: "0.875rem",
                  color: "#1e3a8a",
                }}
              >
                All parts from Service, Replacement, and Sales (
                {totalPartsCount} {totalPartsCount === 1 ? "item" : "items"})
              </p>
            </div>
            <div
              style={{
                padding: "1rem 1.5rem",
                backgroundColor: "#ffffff",
                borderRadius: "0 0 0.5rem 0.5rem",
                border: "1px solid #bfdbfe",
                borderTop: "none",
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              {["service", "replacement", "sales"].map(
                (cat) =>
                  (selectedParts[cat]?.length || 0) > 0 && (
                    <div
                      key={cat}
                      style={{ marginBottom: cat !== "sales" ? "1.5rem" : 0 }}
                    >
                      <h4
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: 600,
                          marginBottom: "0.75rem",
                          textTransform: "capitalize",
                          color: "#374151",
                        }}
                      >
                        {cat === "service" && "Service"}
                        {cat === "replacement" && "Replacement"}
                        {cat === "sales" && "Sales"}
                        <span
                          style={{
                            marginLeft: "0.5rem",
                            color: "#6b7280",
                            fontWeight: 500,
                          }}
                        >
                          ({(selectedParts[cat] || []).length}{" "}
                          {(selectedParts[cat] || []).length === 1
                            ? "item"
                            : "items"}
                          )
                        </span>
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "1rem",
                        }}
                      >
                        {(selectedParts[cat] || []).map((part) => (
                          <div
                            key={part.id}
                            style={{
                              padding: "1rem 1.25rem",
                              display: "flex",
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "1.5rem",
                              width: "100%",
                              backgroundColor: "#f8fafc",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  marginBottom: "0.25rem",
                                  flexWrap: "wrap",
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "0.9375rem",
                                    color: "#111827",
                                  }}
                                >
                                  {part.name}
                                </span>
                                {part.replacementType && (
                                  <span
                                    style={{
                                      fontSize: "0.6875rem",
                                      padding: "0.2rem 0.4rem",
                                      backgroundColor:
                                        part.replacementType === "battery"
                                          ? "#dbeafe"
                                          : part.replacementType === "charger"
                                          ? "#fef3c7"
                                          : "#e0e7ff",
                                      color:
                                        part.replacementType === "battery"
                                          ? "#1e40af"
                                          : part.replacementType === "charger"
                                          ? "#92400e"
                                          : "#3730a3",
                                      borderRadius: "4px",
                                      fontWeight: 600,
                                      textTransform: "capitalize",
                                    }}
                                  >
                                    {part.replacementType}
                                  </span>
                                )}
                                {part.salesType && (
                                  <span
                                    style={{
                                      fontSize: "0.6875rem",
                                      padding: "0.2rem 0.4rem",
                                      backgroundColor:
                                        part.salesType === "battery"
                                          ? "#dbeafe"
                                          : part.salesType === "charger"
                                          ? "#fef3c7"
                                          : part.salesType === "oldScooty"
                                          ? "#fce7f3"
                                          : "#e0e7ff",
                                      color:
                                        part.salesType === "battery"
                                          ? "#1e40af"
                                          : part.salesType === "charger"
                                          ? "#92400e"
                                          : part.salesType === "oldScooty"
                                          ? "#9f1239"
                                          : "#3730a3",
                                      borderRadius: "4px",
                                      fontWeight: 600,
                                      textTransform: "capitalize",
                                    }}
                                  >
                                    {part.salesType === "oldScooty"
                                      ? "Old Scooty"
                                      : part.salesType}
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.8125rem",
                                  color: "#6b7280",
                                  marginTop: "0.25rem",
                                }}
                              >
                                Qty: {part.selectedQuantity || 1}
                                {part.price != null && (
                                  <span
                                    style={{
                                      marginLeft: "0.75rem",
                                      fontWeight: 600,
                                      color: "#0f172a",
                                    }}
                                  >
                                    ₹{getPartTotal(part).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                                flexShrink: 0,
                              }}
                            >
                              {part.salesType !== "oldScooty" && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    backgroundColor: "#ffffff",
                                    borderRadius: "6px",
                                    border: "1px solid #d1d5db",
                                    overflow: "hidden",
                                    width: "100px",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if ((part.selectedQuantity || 1) <= 1) {
                                        alert("Quantity cannot be less than 1");
                                      } else {
                                        decreaseQuantity(part.id, cat);
                                      }
                                    }}
                                    disabled={(part.selectedQuantity || 1) <= 1}
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      backgroundColor:
                                        (part.selectedQuantity || 1) <= 1
                                          ? "#cbd5e1"
                                          : "#3b82f6",
                                      color: "#ffffff",
                                      border: "none",
                                      cursor:
                                        (part.selectedQuantity || 1) <= 1
                                          ? "not-allowed"
                                          : "pointer",
                                      fontSize: "1rem",
                                      fontWeight: 500,
                                    }}
                                  >
                                    −
                                  </button>
                                  <div
                                    style={{
                                      width: "36px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "0.875rem",
                                      fontWeight: 600,
                                      color: "#0f172a",
                                    }}
                                  >
                                    {part.selectedQuantity || 1}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const maxQty = getMaxQuantity(part);
                                      if (
                                        (part.selectedQuantity || 1) >= maxQty
                                      ) {
                                        alert(
                                          `Maximum quantity reached. Available: ${maxQty}`
                                        );
                                      } else {
                                        increaseQuantity(part.id, cat);
                                      }
                                    }}
                                    disabled={
                                      (part.selectedQuantity || 1) >=
                                      getMaxQuantity(part)
                                    }
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      backgroundColor:
                                        (part.selectedQuantity || 1) >=
                                        getMaxQuantity(part)
                                          ? "#cbd5e1"
                                          : "#3b82f6",
                                      color: "#ffffff",
                                      border: "none",
                                      cursor:
                                        (part.selectedQuantity || 1) >=
                                        getMaxQuantity(part)
                                          ? "not-allowed"
                                          : "pointer",
                                      fontSize: "1rem",
                                      fontWeight: 500,
                                    }}
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => removePart(part.id, cat)}
                                style={{
                                  padding: "0.4rem 0.75rem",
                                  fontSize: "0.8125rem",
                                  backgroundColor: "#ef4444",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  fontWeight: 500,
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = "#dc2626";
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = "#ef4444";
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
              )}
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem",
                  backgroundColor: "#f1f5f9",
                  borderRadius: "0.375rem",
                  textAlign: "right",
                  fontWeight: 600,
                  fontSize: "1rem",
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "1rem",
                }}
              >
                <strong>Total: </strong>₹{calculateTotal()}
              </div>
            </div>
          </div>
        )}

        {/* Things added to jobcard - consolidated view */}
        {hasAnyParts && (
          <div className="form-section" style={{ marginTop: "1.5rem" }}>
            <div
              style={{
                padding: "1rem 1.5rem",
                backgroundColor: "#eff6ff",
                borderRadius: "0.5rem 0.5rem 0 0",
                border: "1px solid #bfdbfe",
                borderBottom: "none",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "#1e40af",
                }}
              >
                Things added to jobcard
              </h3>
              <p
                style={{
                  margin: "0.25rem 0 0",
                  fontSize: "0.875rem",
                  color: "#1e3a8a",
                }}
              >
                All parts from Service, Replacement, and Sales (
                {totalPartsCount} {totalPartsCount === 1 ? "item" : "items"})
              </p>
            </div>
            <div
              style={{
                padding: "1rem 1.5rem",
                backgroundColor: "#ffffff",
                borderRadius: "0 0 0.5rem 0.5rem",
                border: "1px solid #bfdbfe",
                borderTop: "none",
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              {["service", "replacement", "sales"].map(
                (cat) =>
                  (selectedParts[cat]?.length || 0) > 0 && (
                    <div
                      key={cat}
                      style={{ marginBottom: cat !== "sales" ? "1.5rem" : 0 }}
                    >
                      <h4
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: 600,
                          marginBottom: "0.75rem",
                          textTransform: "capitalize",
                          color: "#374151",
                        }}
                      >
                        {cat === "service" && "Service"}
                        {cat === "replacement" && "Replacement"}
                        {cat === "sales" && "Sales"}
                        <span
                          style={{
                            marginLeft: "0.5rem",
                            color: "#6b7280",
                            fontWeight: 500,
                          }}
                        >
                          ({(selectedParts[cat] || []).length}{" "}
                          {(selectedParts[cat] || []).length === 1
                            ? "item"
                            : "items"}
                          )
                        </span>
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "1rem",
                        }}
                      >
                        {(selectedParts[cat] || []).map((part) => (
                          <div
                            key={part.id}
                            style={{
                              padding: "1rem 1.25rem",
                              display: "flex",
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "1.5rem",
                              width: "100%",
                              backgroundColor: "#f8fafc",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  marginBottom: "0.25rem",
                                  flexWrap: "wrap",
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "0.9375rem",
                                    color: "#111827",
                                  }}
                                >
                                  {part.name}
                                </span>
                                {part.replacementType && (
                                  <span
                                    style={{
                                      fontSize: "0.6875rem",
                                      padding: "0.2rem 0.4rem",
                                      backgroundColor:
                                        part.replacementType === "battery"
                                          ? "#dbeafe"
                                          : part.replacementType === "charger"
                                          ? "#fef3c7"
                                          : "#e0e7ff",
                                      color:
                                        part.replacementType === "battery"
                                          ? "#1e40af"
                                          : part.replacementType === "charger"
                                          ? "#92400e"
                                          : "#3730a3",
                                      borderRadius: "4px",
                                      fontWeight: 600,
                                      textTransform: "capitalize",
                                    }}
                                  >
                                    {part.replacementType}
                                  </span>
                                )}
                                {part.salesType && (
                                  <span
                                    style={{
                                      fontSize: "0.6875rem",
                                      padding: "0.2rem 0.4rem",
                                      backgroundColor:
                                        part.salesType === "battery"
                                          ? "#dbeafe"
                                          : part.salesType === "charger"
                                          ? "#fef3c7"
                                          : part.salesType === "oldScooty"
                                          ? "#fce7f3"
                                          : "#e0e7ff",
                                      color:
                                        part.salesType === "battery"
                                          ? "#1e40af"
                                          : part.salesType === "charger"
                                          ? "#92400e"
                                          : part.salesType === "oldScooty"
                                          ? "#9f1239"
                                          : "#3730a3",
                                      borderRadius: "4px",
                                      fontWeight: 600,
                                      textTransform: "capitalize",
                                    }}
                                  >
                                    {part.salesType === "oldScooty"
                                      ? "Old Scooty"
                                      : part.salesType}
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.8125rem",
                                  color: "#6b7280",
                                  marginTop: "0.25rem",
                                }}
                              >
                                Qty: {part.selectedQuantity || 1}
                                {part.price != null && (
                                  <span
                                    style={{
                                      marginLeft: "0.75rem",
                                      fontWeight: 600,
                                      color: "#0f172a",
                                    }}
                                  >
                                    ₹{getPartTotal(part).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                                flexShrink: 0,
                              }}
                            >
                              {part.salesType !== "oldScooty" && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    backgroundColor: "#ffffff",
                                    borderRadius: "6px",
                                    border: "1px solid #d1d5db",
                                    overflow: "hidden",
                                    width: "100px",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if ((part.selectedQuantity || 1) <= 1) {
                                        alert("Quantity cannot be less than 1");
                                      } else {
                                        decreaseQuantity(part.id, cat);
                                      }
                                    }}
                                    disabled={(part.selectedQuantity || 1) <= 1}
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      backgroundColor:
                                        (part.selectedQuantity || 1) <= 1
                                          ? "#cbd5e1"
                                          : "#3b82f6",
                                      color: "#ffffff",
                                      border: "none",
                                      cursor:
                                        (part.selectedQuantity || 1) <= 1
                                          ? "not-allowed"
                                          : "pointer",
                                      fontSize: "1rem",
                                      fontWeight: 500,
                                    }}
                                  >
                                    −
                                  </button>
                                  <div
                                    style={{
                                      width: "36px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "0.875rem",
                                      fontWeight: 600,
                                      color: "#0f172a",
                                    }}
                                  >
                                    {part.selectedQuantity || 1}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const maxQty = getMaxQuantity(part);
                                      if (
                                        (part.selectedQuantity || 1) >= maxQty
                                      ) {
                                        alert(
                                          `Maximum quantity reached. Available: ${maxQty}`
                                        );
                                      } else {
                                        increaseQuantity(part.id, cat);
                                      }
                                    }}
                                    disabled={
                                      (part.selectedQuantity || 1) >=
                                      getMaxQuantity(part)
                                    }
                                    style={{
                                      width: "32px",
                                      height: "32px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      backgroundColor:
                                        (part.selectedQuantity || 1) >=
                                        getMaxQuantity(part)
                                          ? "#cbd5e1"
                                          : "#3b82f6",
                                      color: "#ffffff",
                                      border: "none",
                                      cursor:
                                        (part.selectedQuantity || 1) >=
                                        getMaxQuantity(part)
                                          ? "not-allowed"
                                          : "pointer",
                                      fontSize: "1rem",
                                      fontWeight: 500,
                                    }}
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => removePart(part.id, cat)}
                                style={{
                                  padding: "0.4rem 0.75rem",
                                  fontSize: "0.8125rem",
                                  backgroundColor: "#ef4444",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  fontWeight: 500,
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = "#dc2626";
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = "#ef4444";
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
              )}
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem",
                  backgroundColor: "#f1f5f9",
                  borderRadius: "0.375rem",
                  textAlign: "right",
                  fontWeight: 600,
                  fontSize: "1rem",
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "1rem",
                }}
              >
                <strong>Total: </strong>₹{calculateTotal()}
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
          >
            {isEditMode ? "Update Jobcard" : "Save Jobcard"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/jobcards/pending")}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
