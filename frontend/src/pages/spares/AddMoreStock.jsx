import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDate } from "../../utils/dateUtils";
import { fetchWithRetry } from "../../config/api";

// Helper function to display dd/mm/yyyy dates without parsing
const displayDate = (dateString) => {
  if (!dateString) return "";

  // Convert Date object to string if needed
  const dateStr =
    dateString instanceof Date ? dateString.toString() : String(dateString);

  // If already in dd/mm/yyyy format, return as-is
  if (dateStr.includes("/")) {
    return dateStr;
  }
  // Otherwise try to format using the existing function
  return formatDate(dateString);
};

const groupColorsByDate = (colors) => {
  if (!Array.isArray(colors)) return [];
  const map = new Map();
  colors.forEach((c) => {
    const date = displayDate(c?.purchaseDate || "");
    const key = date || "";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  });
  const groups = Array.from(map.entries()).map(([date, list]) => ({
    date,
    colors: list.reverse(), // Reverse colors within each date group (latest first)
  }));
  const toDate = (s) => {
    const p = String(s || "").split("/");
    if (p.length === 3) return new Date(`${p[2]}-${p[1]}-${p[0]}`);
    return new Date(s || "");
  };
  // Sort from newest to oldest (latest entries on top)
  groups.sort((a, b) => toDate(b.date) - toDate(a.date));
  return groups;
};

// Helper function to validate date format (dd/mm/yyyy)
const validateDateFormat = (dateString) => {
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(dateString)) return false;

  const [day, month, year] = dateString.split("/");
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === parseInt(year) &&
    date.getMonth() === parseInt(month) - 1 &&
    date.getDate() === parseInt(day)
  );
};

const style = {
  padding: "1rem",
  backgroundColor: "#f9fafb",
  minHeight: "100vh",
  position: "relative",
};

/** Purchased amount for a stock layer (fixed after first save); falls back to current qty if unset */
function spareLayerPurchasedQty(row) {
  if (!row) return 0;
  const o = row.originalQuantity;
  if (o !== undefined && o !== null && !Number.isNaN(Number(o))) {
    return Math.max(0, parseInt(o, 10));
  }
  return Math.max(0, parseInt(row.quantity || 0, 10));
}

function spareLayerLeftQty(row) {
  return Math.max(0, parseInt(row?.quantity || 0, 10));
}

function AddMoreStock() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [spare, setSpare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stockField, setStockField] = useState("stockEntries");

  // State for new stock entry form
  const [newStockEntry, setNewStockEntry] = useState({
    quantity: "", // For non-color tracking mode
    purchasePrice: "",
    purchaseDate: formatDate(new Date()),
    colorQuantities: [{ color: "", quantity: "", minStockLevel: "" }], // For color tracking mode
  });
  const [colorQuantityError, setColorQuantityError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formWarning, setFormWarning] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredEntryIndex, setHoveredEntryIndex] = useState(null);
  const [editingEntryIndex, setEditingEntryIndex] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const datePickerRef = useRef(null);

  // State for edit entry color management
  const [editEntryColors, setEditEntryColors] = useState([]);
  const [newEditColor, setNewEditColor] = useState("");
  const [newEditColorCustom, setNewEditColorCustom] = useState("");
  const [newEditColorQuantity, setNewEditColorQuantity] = useState("");
  const [newEditColorMinStockLevel, setNewEditColorMinStockLevel] = useState("");
  const [newEditColorPurchasePrice, setNewEditColorPurchasePrice] =
    useState("");

  // Check if color tracking is enabled for this spare
  const isColorTrackingEnabled =
    spare?.hasColors === true
      ? true
      : spare?.hasColors === false
      ? false
      : Array.isArray(spare?.colorQuantity) && spare.colorQuantity.length > 0;

  // Check if user is authenticated as admin (for purchase price unlock)
  const [isPurchasePriceUnlocked, setIsPurchasePriceUnlocked] = useState(() => {
    // Check if admin is already authenticated on mount
    return !!sessionStorage.getItem("adminSecurityKey");
  });
  const [showPurchasePriceDialog, setShowPurchasePriceDialog] = useState(false);
  const [purchasePriceSecurityKey, setPurchasePriceSecurityKey] = useState("");
  const [showPurchasePriceKey, setShowPurchasePriceKey] = useState(false);
  const [purchasePriceDialogError, setPurchasePriceDialogError] = useState("");

  // Dialog to ask user whether to enter purchase price now or later
  const [showPurchasePriceDecisionDialog, setShowPurchasePriceDecisionDialog] =
    useState(false);

  // Dialog to ask user whether to use existing min stock level or enter new one
  const [showMinStockLevelDialog, setShowMinStockLevelDialog] = useState(false);
  const [pendingColorIndex, setPendingColorIndex] = useState(null);
  const [pendingColorValue, setPendingColorValue] = useState("");
  const [existingMinStockLevel, setExistingMinStockLevel] = useState(0);
  const [isNewEditMinStockAuto, setIsNewEditMinStockAuto] = useState(false);

  // Ensure that for each color, a single default minStockLevel is used everywhere.
  // When multiple entries for the same color exist, the latest minStockLevel
  // (from the last occurrence in the array) becomes the default applied to all.
  const normalizeColorMinStockLevels = (colorQuantity) => {
    if (!Array.isArray(colorQuantity) || colorQuantity.length === 0) {
      return colorQuantity;
    }

    const latestMinByColor = {};
    for (let i = colorQuantity.length - 1; i >= 0; i--) {
      const cq = colorQuantity[i];
      const key = String(cq.color || "").toLowerCase().trim();
      if (!key) continue;
      if (latestMinByColor[key] === undefined) {
        latestMinByColor[key] = cq.minStockLevel !== undefined ? cq.minStockLevel : 0;
      }
    }

    return colorQuantity.map((cq) => {
      const key = String(cq.color || "").toLowerCase().trim();
      if (!key || latestMinByColor[key] === undefined) return cq;
      if (cq.minStockLevel === latestMinByColor[key]) return cq;
      return { ...cq, minStockLevel: latestMinByColor[key] };
    });
  };

  // When adding a new color in the edit entry section, prefill min stock if this color
  // already exists anywhere in spare.colorQuantity
  const handleNewEditColorChange = (value) => {
    setNewEditColor(value);

    if (!value || value === "other") {
      // For "other" or empty, don't auto-fill
      setIsNewEditMinStockAuto(false);
      return;
    }

    const existingColorEntry = (spare?.colorQuantity || []).find(
      (cq) => (cq.color || "").toLowerCase() === String(value).toLowerCase()
    );

    if (existingColorEntry && existingColorEntry.minStockLevel !== undefined) {
      setNewEditColorMinStockLevel(
        String(parseInt(existingColorEntry.minStockLevel || 0))
      );
      setIsNewEditMinStockAuto(true);
    } else {
      setIsNewEditMinStockAuto(false);
    }
  };

  // Sync unlock state with sessionStorage when component mounts or when admin logs in
  useEffect(() => {
    const checkAdminAuth = () => {
      const hasAuth = !!sessionStorage.getItem("adminSecurityKey");
      setIsPurchasePriceUnlocked(hasAuth);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // When user switches to another tab/page, immediately lock purchase price
        sessionStorage.removeItem("adminAuth");
        sessionStorage.removeItem("adminSecurityKey");
        setIsPurchasePriceUnlocked(false);
        setShowPurchasePriceDialog(false);
        setPurchasePriceSecurityKey("");
        setPurchasePriceDialogError("");
      } else {
        // When user returns, re-sync with storage (will stay locked until key entered again)
        checkAdminAuth();
      }
    };

    checkAdminAuth();

    // Listen for storage changes (in case admin logs in from another tab)
    window.addEventListener("storage", checkAdminAuth);
    // Lock purchase price on tab/page visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("storage", checkAdminAuth);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // When leaving this page (component unmount), always lock and clear admin auth
      sessionStorage.removeItem("adminAuth");
      sessionStorage.removeItem("adminSecurityKey");
      setIsPurchasePriceUnlocked(false);
      setShowPurchasePriceDialog(false);
      setPurchasePriceSecurityKey("");
      setPurchasePriceDialogError("");
    };
  }, []);

  // Handle purchase price unlock
  const handleUnlockPurchasePrice = async () => {
    setPurchasePriceDialogError("");
    
    if (!purchasePriceSecurityKey.trim()) {
      setPurchasePriceDialogError("Please enter security key");
      return;
    }

    try {
      const response = await fetchWithRetry(`/admin/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ securityKey: purchasePriceSecurityKey }),
      });

      const data = await response.json();

      if (data.success) {
        // Store admin authentication
        sessionStorage.setItem("adminAuth", "true");
        sessionStorage.setItem("adminSecurityKey", purchasePriceSecurityKey);
        setIsPurchasePriceUnlocked(true);
        setShowPurchasePriceDialog(false);
        setPurchasePriceSecurityKey("");
        setPurchasePriceDialogError("");
      } else {
        setPurchasePriceDialogError("Invalid security key");
      }
    } catch (err) {
      console.error("Authentication error:", err);
      setPurchasePriceDialogError("Authentication failed. Please try again.");
    }
  };

  // State to track if we need to re-scroll
  const [needsRescroll, setNeedsRescroll] = useState(false);

  const [activeColorByDate, setActiveColorByDate] = useState({});
  
  // Store original entry state for comparison to detect changes
  const [originalEditEntry, setOriginalEditEntry] = useState(null);
  const [originalEditEntryColors, setOriginalEditEntryColors] = useState([]);

  // State for editing color entries
  const [editingColorIndex, setEditingColorIndex] = useState(null);
  const [editingColorEntry, setEditingColorEntry] = useState(null);

  // State for form pre-fill animation
  const [preFilledFields, setPreFilledFields] = useState({
    purchaseDate: false,
    purchasePrice: false,
  });
  const [clickedButtonId, setClickedButtonId] = useState(null);
  
  // Ref for form section to enable scrolling
  const formSectionRef = useRef(null);

  // Predefined color options (similar to model stock entries)
  const colorOptions = useMemo(
    () => [
      { value: "black", label: "Black", hex: "#000000" },
      { value: "blue", label: "Blue", hex: "#0000FF" },
      { value: "white", label: "White", hex: "#FFFFFF" },
      {
        value: "white-black",
        label: "White-Black",
        hex: "linear-gradient(45deg, #FFFFFF 50%, #000000 50%)",
      },
      { value: "peacock", label: "Peacock", hex: "#006994" },
      { value: "green", label: "Green", hex: "#006400" },
      { value: "cherry", label: "Cherry", hex: "#8B0000" },
      { value: "red", label: "Red", hex: "#FF0000" },
      { value: "grey", label: "Grey", hex: "#808080" },
      { value: "silver", label: "Silver", hex: "#C0C0C0" },
      { value: "yellow", label: "Yellow", hex: "#FFFF00" },
    ],
    []
  );

  // Helper function to get color display (for preview)
  const getColourDisplay = (colorValue) => {
    if (!colorValue) return "#f5f5f5";
    const color = colorOptions.find((c) => c.value === colorValue);
    if (color && color.hex && !color.hex.includes("gradient")) {
      return color.hex;
    }
    return "#f5f5f5";
  };

  // Get existing colors for the selected purchase date (for Add New Color Entry form)

  // Helper function to create default stock entry when color tracking is enabled
  const createDefaultStockEntry = () => {
    if (!isColorTrackingEnabled || editEntryColors.length === 0) return null;

    const totalQuantity = editEntryColors.reduce(
      (total, cq) => total + cq.quantity,
      0
    );

    return {
      quantity: totalQuantity,
      purchasePrice: editingEntry?.purchasePrice || 0,
      purchaseDate: editingEntry?.purchaseDate || formatDate(new Date()),
      color: editEntryColors[0]?.color || "",
      colorQuantities: editEntryColors.map((cq) => ({
        color: cq.color,
        quantity: cq.quantity,
      })),
    };
  };

  // Helper function to get sorted entries with default entry if color tracking is enabled
  const getSortedEntriesWithDefault = () => {
    const entries = sortEntriesByDate(spare?.[stockField] || []);

    // Add default entry if color tracking is enabled and editing
    if (
      isColorTrackingEnabled &&
      editingEntryIndex !== null &&
      editEntryColors.length > 0
    ) {
      const defaultEntry = createDefaultStockEntry();
      if (defaultEntry) {
        return [defaultEntry, ...entries];
      }
    }

    return entries;
  };

  // Helper function to get original index from sorted entries
  const getOriginalIndex = (sortedIndex) => {
    const sortedEntries = getSortedEntriesWithDefault();
    const sortedEntry = sortedEntries[sortedIndex];

    // Check if this is the default entry (first entry when editing with color tracking)
    if (
      isColorTrackingEnabled &&
      editingEntryIndex !== null &&
      editEntryColors.length > 0 &&
      sortedIndex === 0
    ) {
      const defaultEntry = createDefaultStockEntry();
      if (
        defaultEntry &&
        JSON.stringify(sortedEntry) === JSON.stringify(defaultEntry)
      ) {
        return editingEntryIndex; // Return the current editing index for default entry
      }
    }

    const entries = spare?.[stockField] || [];
    const matchIndex = entries.findIndex(
      (entry) =>
        displayDate(entry.purchaseDate) ===
          displayDate(sortedEntry.purchaseDate) &&
        parseInt(entry.quantity || 0) === parseInt(sortedEntry.quantity || 0) &&
        parseFloat(entry.purchasePrice || 0) ===
          parseFloat(sortedEntry.purchasePrice || 0)
    );
    return matchIndex !== -1 ? matchIndex : sortedIndex;
  };

  const entryWithDateForEdit = (entry) => ({
    ...entry,
    purchaseDate: entry.purchaseDate || formatDate(new Date()),
    originalQuantity: String(
      entry.originalQuantity != null && entry.originalQuantity !== ""
        ? entry.originalQuantity
        : spareLayerPurchasedQty(entry)
    ),
  });

  // Handle edit functionality
  const handleEditEntry = (index, entry) => {
    // If already editing this entry and user scrolled, reset and re-scroll
    if (editingEntryIndex === index && needsRescroll) {
      setEditingEntryIndex(null);
      setEditingEntry(null);
      setEditEntryColors([]);
      setNewEditColor("");
      setNewEditColorQuantity("");
      setNewEditColorPurchasePrice("");
      setNeedsRescroll(false);

      // Re-trigger edit after a brief delay
      setTimeout(() => {
        const entryWithDate = entryWithDateForEdit(entry);
        setEditingEntryIndex(index);
        setEditingEntry(entryWithDate);
        
        // Store original entry state for comparison
        setOriginalEditEntry({
          ...entryWithDate,
          purchasePrice: parseFloat(entry.purchasePrice || 0),
        });

        // Initialize colors if needed
        let initialColors = [];
        if (isColorTrackingEnabled) {
          setEditingEntry((prev) => ({ ...prev, quantity: 0 }));
          
          // For spares, colors are stored in spare.colorQuantity array, grouped by purchase date
          // Find all colors with the same purchase date as this entry
          const entryPurchaseDate = displayDate(entry.purchaseDate || "");
          const colorsForThisDate = (spare?.colorQuantity || []).filter(
            (cq) => displayDate(cq.purchaseDate || "") === entryPurchaseDate
          );

          if (colorsForThisDate.length > 0) {
            initialColors = colorsForThisDate.map((cq) => ({
              color: cq.color || "",
              quantity: parseInt(cq.quantity || 0),
              purchasePrice: parseFloat(cq.purchasePrice || 0),
              minStockLevel: parseInt(cq.minStockLevel || 0),
            }));
            setEditEntryColors(initialColors);
          } else if (
            Array.isArray(entry.colorQuantities) &&
            entry.colorQuantities.length > 0
          ) {
            // Fallback: check if entry has colorQuantities (for backward compatibility)
            initialColors = entry.colorQuantities.map((cq) => ({
                color: cq.color,
                quantity: parseInt(cq.quantity || 0),
              purchasePrice: parseFloat(cq.purchasePrice || 0),
              minStockLevel: parseInt(cq.minStockLevel || 0),
            }));
            setEditEntryColors(initialColors);
          } else if (entry.color) {
            initialColors = [
              { 
                color: entry.color, 
                quantity: entry.quantity,
                purchasePrice: parseFloat(entry.purchasePrice || 0),
                minStockLevel: parseInt(entry.minStockLevel || 0),
              },
            ];
            setEditEntryColors(initialColors);
          } else {
            setEditEntryColors([]);
          }
          
          // Store original colors for comparison
          setOriginalEditEntryColors(JSON.parse(JSON.stringify(initialColors)));
        } else {
          setEditEntryColors([]);
          setOriginalEditEntryColors([]);
        }
        
        // Pre-fill purchase price from entry when adding new colors
        const initialPurchasePrice = entry.purchasePrice 
          ? (typeof entry.purchasePrice === 'number' ? entry.purchasePrice.toString() : entry.purchasePrice)
          : "";
        setNewEditColor("");
        setNewEditColorQuantity("");
        setNewEditColorPurchasePrice(initialPurchasePrice);
      }, 50);
      return;
    }

    // Normal edit flow
    setEditingEntryIndex(index);
    const entryWithDate = entryWithDateForEdit(entry);
    setEditingEntry(entryWithDate);
    
    // Store original entry state for comparison
    setOriginalEditEntry({
      ...entryWithDate,
      purchasePrice: parseFloat(entry.purchasePrice || 0),
    });
    
    // Scroll to edit form after state is updated
    setTimeout(() => {
      const editFormSection = document.getElementById("edit-stock-section");
      if (editFormSection) {
        editFormSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);

    // Initialize edit entry colors if color tracking is enabled
    let initialColors = [];
    if (isColorTrackingEnabled) {
      // Reset quantity to 0 when color tracking is enabled
      setEditingEntry((prev) => ({ ...prev, quantity: 0 }));

      // For spares, colors are stored in spare.colorQuantity array, grouped by purchase date
      // Find all colors with the same purchase date as this entry
      const entryPurchaseDate = displayDate(entry.purchaseDate || "");
      const colorsForThisDate = (spare?.colorQuantity || []).filter(
        (cq) => displayDate(cq.purchaseDate || "") === entryPurchaseDate
      );

      if (colorsForThisDate.length > 0) {
        initialColors = colorsForThisDate.map((cq) => ({
          color: cq.color || "",
          quantity: parseInt(cq.quantity || 0),
          purchasePrice: parseFloat(cq.purchasePrice || 0),
          minStockLevel: parseInt(cq.minStockLevel || 0),
        }));
        setEditEntryColors(initialColors);
      } else if (
        Array.isArray(entry.colorQuantities) &&
        entry.colorQuantities.length > 0
      ) {
        // Fallback: check if entry has colorQuantities (for backward compatibility)
        initialColors = entry.colorQuantities.map((cq) => ({
            color: cq.color,
            quantity: parseInt(cq.quantity || 0),
          purchasePrice: parseFloat(cq.purchasePrice || 0),
          minStockLevel: parseInt(cq.minStockLevel || 0),
        }));
        setEditEntryColors(initialColors);
      } else if (entry.color) {
        initialColors = [
          {
            color: entry.color,
            quantity: entry.quantity,
            purchasePrice: parseFloat(entry.purchasePrice || 0),
            minStockLevel: parseInt(entry.minStockLevel || 0),
          },
        ];
        setEditEntryColors(initialColors);
      } else {
        setEditEntryColors([]);
      }
      
      // Store original colors for comparison (deep copy)
      setOriginalEditEntryColors(JSON.parse(JSON.stringify(initialColors)));
    } else {
      setEditEntryColors([]);
      setOriginalEditEntryColors([]);
    }
    
    // Pre-fill purchase price from entry when adding new colors
    const initialPurchasePrice = entry.purchasePrice 
      ? (typeof entry.purchasePrice === 'number' ? entry.purchasePrice.toString() : entry.purchasePrice)
      : "";
    setNewEditColor("");
    setNewEditColorCustom("");
    setNewEditColorQuantity("");
    setNewEditColorMinStockLevel("");
    setNewEditColorPurchasePrice(initialPurchasePrice);
    setNeedsRescroll(false);
  };

  // Add color to edit entry
  const addEditEntryColor = () => {
    // Get purchase price from the entry (all colors in an entry share the same purchase price)
    // Purchase price is optional, so allow 0 or undefined
    const entryPurchasePrice = parseFloat(editingEntry?.purchasePrice || 0);

    // Validate inputs (purchase price is optional)
    if (!newEditColor.trim() || !newEditColorQuantity.trim() || !newEditColorMinStockLevel.trim()) {
      setFormError("Please fill all required fields");
      return;
    }

    if (parseInt(newEditColorQuantity) < 0 || parseInt(newEditColorMinStockLevel) < 0) {
      setFormError("Quantity must be 0 or greater. Min stock level must be 0 or greater.");
      return;
    }

    // For "other" color, require custom color name
    if (newEditColor === "other" && !newEditColorCustom.trim()) {
      setFormError("Please enter a custom color name");
      return;
    }

    // Get the actual color value (custom name if "other")
    const colorValue = newEditColor === "other" ? newEditColorCustom.trim() : newEditColor.trim();

      // Check if color already exists
      const existingIndex = editEntryColors.findIndex(
      (cq) => cq.color.toLowerCase() === colorValue.toLowerCase()
      );

      if (existingIndex !== -1) {
      // Update existing color quantity and min stock level (purchase price comes from entry)
        setEditEntryColors((prev) =>
          prev.map((cq, index) =>
            index === existingIndex
              ? {
                  ...cq,
                  quantity: parseInt(newEditColorQuantity),
                purchasePrice: entryPurchasePrice, // Use entry's purchase price (can be 0)
                minStockLevel: parseInt(newEditColorMinStockLevel || 0),
                }
              : cq
          )
        );
      } else {
      // Add new color with entry's purchase price
        setEditEntryColors((prev) => [
          ...prev,
          {
          color: colorValue,
            quantity: parseInt(newEditColorQuantity),
          purchasePrice: entryPurchasePrice, // Use entry's purchase price automatically (can be 0)
          minStockLevel: parseInt(newEditColorMinStockLevel || 0),
          },
        ]);
      }
      setFormError("");
      setNewEditColor("");
    setNewEditColorCustom("");
      setNewEditColorQuantity("");
    setNewEditColorMinStockLevel("");
    // Don't reset purchase price as it's not user input anymore
  };

  // Remove color from edit entry
  const removeEditEntryColor = (colorToRemove) => {
    setEditEntryColors((prev) =>
      prev.filter((cq) => cq.color !== colorToRemove)
    );
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || !originalEditEntry) return;
    
    // Check if there are pending typed inputs in the "Add New Color" form
      const hasPendingTypedInputs =
        (newEditColor || "").trim() ||
      (newEditColorCustom || "").trim() ||
        (newEditColorQuantity || "").trim() ||
      (newEditColorMinStockLevel || "").trim();
    
      if (hasPendingTypedInputs) {
        setFormError(
        "Color and quantity inputs changed. Click Add to save before saving changes"
        );
        return;
      }
    
    // Check if anything has actually changed (before validation)
    const hasChanges = checkIfEntryChanged();
    
    if (!hasChanges) {
      // Nothing changed, just close the edit form silently without any prompts
      // Clear any form validation states and errors
      setFormError("");
      setFormWarning("");
      handleCancelEdit();
      return;
    }
    
    // Only validate if there are actual changes
    if (isColorTrackingEnabled) {
      if (editEntryColors.length === 0 && originalEditEntryColors.length > 0) {
        // Only show error if colors were removed (original had colors, now has none)
        setFormError("Add at least one color quantity using Add");
        return;
      }
    }

    if (!isColorTrackingEnabled) {
      const left = parseInt(String(editingEntry.quantity ?? "").trim(), 10);
      const baselinePurchased = spareLayerPurchasedQty(originalEditEntry);
      const purchasedParsed = parseInt(
        String(editingEntry.originalQuantity ?? "").trim(),
        10
      );
      const purchased = Number.isNaN(purchasedParsed)
        ? baselinePurchased
        : Math.max(0, purchasedParsed);
      if (Number.isNaN(left) || left < 0) {
        setFormError("Quantity left must be a number 0 or greater.");
        return;
      }
      if (purchased < left) {
        setFormError(
          "Purchased quantity cannot be less than quantity left for this entry."
        );
        return;
      }
    }
    
    await performSaveEdit();
  };
  
  // Helper function to check if entry has changed
  const checkIfEntryChanged = () => {
    if (!originalEditEntry || !editingEntry) return false;
    
    // Check if basic entry fields changed
    const purchaseDateChanged = 
      displayDate(originalEditEntry.purchaseDate || "") !== 
      displayDate(editingEntry.purchaseDate || "");
    
    const purchasePriceChanged = 
      parseFloat(originalEditEntry.purchasePrice || 0) !== 
      parseFloat(editingEntry.purchasePrice || 0);
    
    if (purchaseDateChanged || purchasePriceChanged) {
      return true;
    }
    
    // Check if color quantities changed (for color tracking)
    if (isColorTrackingEnabled) {
      // Compare colors arrays
      if (editEntryColors.length !== originalEditEntryColors.length) {
        return true;
      }
      
      // Deep comparison of colors
      const sortedCurrent = [...editEntryColors].sort((a, b) => 
        (a.color || "").localeCompare(b.color || "")
      );
      const sortedOriginal = [...originalEditEntryColors].sort((a, b) => 
        (a.color || "").localeCompare(b.color || "")
      );
      
      for (let i = 0; i < sortedCurrent.length; i++) {
        const current = sortedCurrent[i];
        const original = sortedOriginal[i];
        
        if (
          (current.color || "").toLowerCase() !== (original.color || "").toLowerCase() ||
          parseInt(current.quantity || 0) !== parseInt(original.quantity || 0) ||
          parseFloat(current.purchasePrice || 0) !== parseFloat(original.purchasePrice || 0) ||
          parseInt(current.minStockLevel || 0) !== parseInt(original.minStockLevel || 0)
        ) {
          return true;
        }
      }
    } else {
      // For non-color tracking, check quantity left and purchased (originalQuantity)
      const quantityChanged =
        parseInt(originalEditEntry.quantity || 0) !==
        parseInt(editingEntry.quantity || 0);

      const baselinePurchased = spareLayerPurchasedQty(originalEditEntry);
      const editedPurchasedParsed = parseInt(
        String(editingEntry.originalQuantity ?? "").trim(),
        10
      );
      const newPurchased = Number.isNaN(editedPurchasedParsed)
        ? baselinePurchased
        : Math.max(0, editedPurchasedParsed);
      const purchasedChanged = newPurchased !== baselinePurchased;

      if (quantityChanged || purchasedChanged) {
        return true;
      }
    }
    
    return false;
  };

  const performSaveEdit = async () => {
    try {
      const currentStockEntries = spare?.[stockField] || [];
      const currentColorQuantity = spare?.colorQuantity || [];

      // Calculate total quantity based on color tracking
      const totalQuantity = isColorTrackingEnabled
        ? editEntryColors.reduce((total, cq) => total + cq.quantity, 0)
        : parseInt(editingEntry?.quantity || 0);

      const existingStockRow = currentStockEntries[editingEntryIndex];
      const newQtyNonColor = parseInt(editingEntry?.quantity || 0, 10);
      const preservedEntryOriginal =
        existingStockRow &&
        existingStockRow.originalQuantity != null &&
        !Number.isNaN(Number(existingStockRow.originalQuantity))
          ? Number(existingStockRow.originalQuantity)
          : existingStockRow
          ? spareLayerPurchasedQty(existingStockRow)
          : newQtyNonColor;

      const editedPurchasedParsed = parseInt(
        String(editingEntry?.originalQuantity ?? "").trim(),
        10
      );
      const editedOriginalQtyNonColor = Number.isNaN(editedPurchasedParsed)
        ? preservedEntryOriginal
        : Math.max(0, editedPurchasedParsed);

      // Update the entry with total quantity and purchase price
      const updatedEntry = {
        ...editingEntry,
        quantity: totalQuantity,
        purchasePrice: editingEntry?.purchasePrice || 0,
        ...(!isColorTrackingEnabled && {
          quantity: newQtyNonColor,
          originalQuantity: editedOriginalQtyNonColor,
        }),
        color:
          editEntryColors.length > 0
            ? editEntryColors[0].color
            : editingEntry.color,
        colorQuantities: isColorTrackingEnabled
          ? editEntryColors.map((cq) => ({
              color: cq.color,
              quantity: cq.quantity,
            }))
          : editingEntry.colorQuantities || [],
      };

      // Check if purchase price is actually being CHANGED (not just present)
      const newPurchasePrice = parseFloat(updatedEntry.purchasePrice || 0);
      const originalPurchasePrice = parseFloat(originalEditEntry?.purchasePrice || 0);
      const purchasePriceChanged = newPurchasePrice > 0 && newPurchasePrice !== originalPurchasePrice;
      
      // For color tracking, also check if any color's purchase price changed
      let colorPurchasePriceChanged = false;
      if (isColorTrackingEnabled) {
        colorPurchasePriceChanged = editEntryColors.some(cq => {
          const newCqPrice = parseFloat(cq.purchasePrice || 0);
          if (newCqPrice <= 0) return false;
          // Find original color entry to compare
          const originalCq = originalEditEntryColors.find(
            orig => orig.color?.toLowerCase() === cq.color?.toLowerCase()
          );
          const originalCqPrice = parseFloat(originalCq?.purchasePrice || 0);
          return newCqPrice !== originalCqPrice;
        });
      }

      const hasPurchasePriceUpdate = purchasePriceChanged || colorPurchasePriceChanged;

      // Check admin authentication BEFORE making the request if purchase price is being updated
      if (hasPurchasePriceUpdate && !isPurchasePriceUnlocked) {
        setFormError("Please unlock the purchase price field with security key first.");
        return;
      }
      
      if (hasPurchasePriceUpdate) {
        const securityKey = sessionStorage.getItem("adminSecurityKey");
        if (!securityKey) {
          setFormError("Admin authentication required to update purchase price. Please unlock with security key first.");
          return;
        }
      }

      // Get security key if purchase price is being updated
      const securityKey = hasPurchasePriceUpdate 
        ? sessionStorage.getItem("adminSecurityKey") 
        : null;

      if (!isColorTrackingEnabled) {
        const otherEntries = currentStockEntries.filter(
          (_e, idx) => idx !== editingEntryIndex
        );
        const newDate = displayDate(updatedEntry.purchaseDate);
        const hasDuplicateDate = otherEntries.some(
          (e) => displayDate(e.purchaseDate) === newDate
        );
        if (hasDuplicateDate) {
          setFormWarning(
            "A stock entry with this purchase date already exists"
          );
          setTimeout(() => setFormWarning(""), 3000);
          return;
        }
      }

      // Update color quantities
      let updatedColorQuantity = [...currentColorQuantity];

      if (isColorTrackingEnabled) {
        // Use originalEditEntryColors which contains the colors that were in this entry when editing started
        // This ensures we're subtracting the correct colors for this specific purchase date
        const prevColors = originalEditEntryColors.length > 0
          ? originalEditEntryColors.map((cq) => ({
              color: String(cq.color || ""),
              quantity: parseInt(cq.quantity || 0),
            }))
          : Array.isArray(editingEntry.colorQuantities) &&
          editingEntry.colorQuantities.length > 0
            ? editingEntry.colorQuantities.map((cq) => ({
                color: String(cq.color || ""),
                quantity: parseInt(cq.quantity || 0),
              }))
            : editingEntry.color
            ? [
                {
                  color: String(editingEntry.color || ""),
                  quantity: parseInt(editingEntry.quantity || 0),
                },
              ]
            : [];

        // Get the purchase date for this entry
        const entryPurchaseDate = displayDate(editingEntry?.purchaseDate || "");

        const colorOrigKeyFn = (cq) =>
          `${String(cq.color || "").toLowerCase().trim()}|${displayDate(
            cq.purchaseDate || ""
          )}`;
        const origPurchaseByKey = new Map();
        currentColorQuantity.forEach((cq) => {
          origPurchaseByKey.set(colorOrigKeyFn(cq), spareLayerPurchasedQty(cq));
        });

        // Subtract previous entry color quantities from global colorQuantity
        // Match by both color name AND purchase date to avoid affecting other dates
        prevColors.forEach((prev) => {
          const idx = updatedColorQuantity.findIndex(
            (cq) => 
              cq.color.toLowerCase() === prev.color.toLowerCase() &&
              displayDate(cq.purchaseDate || "") === entryPurchaseDate
          );
          if (idx !== -1) {
            const newQty =
              parseInt(updatedColorQuantity[idx].quantity || 0) - prev.quantity;
            updatedColorQuantity[idx].quantity = newQty > 0 ? newQty : 0;
          }
        });

        editEntryColors.forEach((newCq) => {
          // Find existing color entry by BOTH color name AND purchase date
          const existingIndex = updatedColorQuantity.findIndex(
            (cq) => 
              cq.color.toLowerCase() === newCq.color.toLowerCase() &&
              displayDate(cq.purchaseDate || "") === entryPurchaseDate
          );

          if (existingIndex !== -1) {
            // Update existing color entry for this purchase date
            updatedColorQuantity[existingIndex].quantity =
              parseInt(updatedColorQuantity[existingIndex].quantity || 0) +
              newCq.quantity;
            // Update minStockLevel and purchasePrice if provided
            if (newCq.minStockLevel !== undefined) {
              updatedColorQuantity[existingIndex].minStockLevel = newCq.minStockLevel || 0;
            }
            if (newCq.purchasePrice !== undefined) {
              updatedColorQuantity[existingIndex].purchasePrice = newCq.purchasePrice || 0;
            }
          } else if (newCq.quantity >= 0) {
            // Create a new color entry for this purchase date
            // Even if the color exists for a different date, create a separate entry
            updatedColorQuantity.push({
              color: newCq.color,
              quantity: newCq.quantity,
              originalQuantity: parseInt(newCq.quantity, 10),
              minStockLevel: newCq.minStockLevel || 0,
              purchasePrice: newCq.purchasePrice || 0,
              purchaseDate: editingEntry?.purchaseDate || "",
            });
          }
        });

        // Normalize min stock levels so the latest value for each color
        // becomes the default across all entries
        updatedColorQuantity = normalizeColorMinStockLevels(updatedColorQuantity);

        updatedColorQuantity.forEach((cq) => {
          if (displayDate(cq.purchaseDate || "") !== entryPurchaseDate) return;
          const k = colorOrigKeyFn(cq);
          if (
            cq.originalQuantity === undefined ||
            cq.originalQuantity === null
          ) {
            const preserved = origPurchaseByKey.get(k);
            cq.originalQuantity =
              preserved != null
                ? preserved
                : Math.max(0, parseInt(cq.quantity || 0, 10));
          }
        });
      }

      // Keep all layers including quantity 0 (FIFO / edits); only explicit delete removes a row
      const updatedStockEntries = currentStockEntries.map((entry, index) =>
        index === editingEntryIndex ? updatedEntry : entry
      );

      const requestBody = {
        [stockField]: updatedStockEntries,
        ...(isColorTrackingEnabled && {
          colorQuantity: updatedColorQuantity,
        }),
        securityKey: securityKey || null, // Always include, backend will validate
      };

      const response = await fetchWithRetry(`/spares/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresAuth) {
          setFormError("Admin authentication required to update purchase price. Please log in as admin.");
          return;
        }
        throw new Error(errorData.message || "Failed to update stock entry");
      }

      if (response.ok) {
        const updatedSpare = await response.json();
        setSpare(updatedSpare);
        await fetchSpareDetails();
        setEditingEntryIndex(null);
        setEditingEntry(null);
        setEditEntryColors([]);
        setNewEditColor("");
        setNewEditColorCustom("");
        setNewEditColorQuantity("");
        setNewEditColorPurchasePrice("");
      } else {
        throw new Error("Failed to update stock entry");
      }
    } catch (error) {
      console.error("Error updating stock entry:", error);
      setError("Failed to update stock entry");
    }
  };

  const handleCancelEdit = () => {
    setEditingEntryIndex(null);
    setEditingEntry(null);
    setEditEntryColors([]);
    setNewEditColor("");
    setNewEditColorCustom("");
    setNewEditColorQuantity("");
    setNewEditColorMinStockLevel("");
    setNewEditColorPurchasePrice("");
    setFormError("");
    setFormWarning("");
    setOriginalEditEntry(null);
    setOriginalEditEntryColors([]);
  };

  // Helper function to sort entries by purchase date
  const sortEntriesByDate = (entries) => {
    if (!Array.isArray(entries)) return entries;

    return [...entries].sort((a, b) => {
      const dateA = displayDate(a.purchaseDate || "");
      const dateB = displayDate(b.purchaseDate || "");

      // Parse dd/mm/yyyy format for comparison
      const parseDate = (dateStr) => {
        if (!dateStr) return new Date(0);
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          const [day, month, year] = parts;
          return new Date(`${year}-${month}-${day}`);
        }
        return new Date(dateStr); // Fallback for other formats
      };

      return parseDate(dateA) - parseDate(dateB);
    });
  };

  const fetchSpareDetails = useCallback(async () => {
    try {
      const response = await fetchWithRetry(`/spares/${id}`);
      const data = await response.json();

      console.log("API Response:", data);
      console.log("All fields:", Object.keys(data));

      // Prefer explicit stock entries array; fallback to heuristic
      if (Array.isArray(data.stockEntries)) {
        setStockField("stockEntries");
      } else {
        const detectedField = Object.keys(data).find(
          (key) =>
            Array.isArray(data[key]) &&
            data[key].length > 0 &&
            data[key][0].quantity &&
            (key.toLowerCase().includes("stock") ||
              key.toLowerCase().includes("entries"))
        );
        if (detectedField) {
          setStockField(detectedField);
        }
      }

      if (!response.ok) {
        throw new Error(data.message || "Error fetching spare details");
      }

      setSpare(data);
    } catch (err) {
      setError(err.message || "Error loading spare details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSpareDetails();
  }, [fetchSpareDetails]);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showDatePicker &&
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target) &&
        !event.target.closest('input[name="purchaseDate"]')
      ) {
        setShowDatePicker(false);
      }
    };

    if (showDatePicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker]);

  // When color tracking is enabled, automatically clear stockEntries on the backend
  useEffect(() => {
    const clearStockEntriesIfNeeded = async () => {
      try {
        if (
          isColorTrackingEnabled &&
          Array.isArray(spare?.[stockField]) &&
          spare[stockField].length > 0
        ) {
          const response = await fetchWithRetry(
            `/spares/${id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ [stockField]: [] }),
            }
          );
          if (response.ok) {
            await fetchSpareDetails();
          } else {
            console.warn("Auto-clear stock entries failed");
          }
        }
      } catch (err) {
        console.warn("Error auto-clearing stock entries:", err);
      }
    };

    clearStockEntriesIfNeeded();
  }, [isColorTrackingEnabled, spare, stockField, id, fetchSpareDetails]);

  // Auto-scroll to edit form when editing is activated
  useEffect(() => {
    if (editingEntryIndex !== null) {
      // Use requestAnimationFrame for better timing
      const scrollToEdit = () => {
        const editElement = document.getElementById("edit-stock-section");
        if (editElement) {
          // First scroll to the element
          editElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });

          // Then add the 100px gap by scrolling up a bit more
          setTimeout(() => {
            window.scrollBy({
              top: -100,
              behavior: "smooth",
            });
          }, 100);
          return true;
        }
        return false;
      };

      // Try multiple times
      requestAnimationFrame(() => {
        scrollToEdit();
        setTimeout(scrollToEdit, 50);
        setTimeout(scrollToEdit, 150);
        setTimeout(scrollToEdit, 300);
      });
    }
  }, [editingEntryIndex]);

  // Refresh data when window gains focus (when user navigates back from EditSpare)
  useEffect(() => {
    const handleWindowFocus = () => {
      fetchSpareDetails();
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [fetchSpareDetails]);

  useEffect(() => {
    const handleScroll = () => {
      if (showDatePicker) setShowDatePicker(false);
      if (showEditDatePicker) setShowEditDatePicker(false);

      // Check if edit form is visible and set re-scroll flag if scrolled away
      if (editingEntryIndex !== null) {
        const editElement = document.getElementById("edit-stock-section");
        if (editElement) {
          const rect = editElement.getBoundingClientRect();
          // If edit form is not in viewport (scrolled away)
          if (rect.top < 0 || rect.bottom > window.innerHeight) {
            setNeedsRescroll(true);
          } else {
            setNeedsRescroll(false);
          }
        }
      }
    };

    const handleClickOutside = (event) => {
      if (showDatePicker) {
        const calendarElement = document.getElementById("date-picker-calendar");
        if (calendarElement && !calendarElement.contains(event.target)) {
          const isCalendarButton =
            event.target.closest('[title="Calendar"]') ||
            event.target.closest('button[onClick*="setShowDatePicker"]');
          if (!isCalendarButton) setShowDatePicker(false);
        }
      }
      if (showEditDatePicker) {
        const editCalendarElement = document.getElementById(
          "edit-date-picker-calendar"
        );
        if (
          editCalendarElement &&
          !editCalendarElement.contains(event.target)
        ) {
          const isEditCalendarButton = event.target.closest(
            'div[onClick*="setShowEditDatePicker"]'
          );
          if (!isEditCalendarButton) setShowEditDatePicker(false);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, true);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showDatePicker, showEditDatePicker, editingEntryIndex]);

  // Handle input changes for new stock entry form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewStockEntry((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (formWarning) setFormWarning("");
  };

  // Handle color-quantity entries
  const addColorQuantityEntry = () => {
    // Check if the last entry has color, quantity, and minStockLevel filled
    const lastEntry = newStockEntry.colorQuantities[newStockEntry.colorQuantities.length - 1];
    if (
      !lastEntry.color ||
      lastEntry.quantity === "" ||
      lastEntry.quantity === null ||
      lastEntry.quantity === undefined ||
      parseInt(lastEntry.quantity) < 0 ||
      !lastEntry.minStockLevel ||
      lastEntry.minStockLevel === "" ||
      parseInt(lastEntry.minStockLevel) < 0
    ) {
      setColorQuantityError(
        "Please fill color, quantity, and min stock level before adding a new entry"
      );
      setTimeout(() => setColorQuantityError(""), 3000);
      return;
    }
    setColorQuantityError("");
    setNewStockEntry((prev) => ({
      ...prev,
      colorQuantities: [...prev.colorQuantities, { color: "", quantity: "", minStockLevel: "" }],
    }));
  };

  const removeColorQuantityEntry = (index) => {
    if (newStockEntry.colorQuantities.length === 1) {
      setColorQuantityError("At least one color-quantity entry is required");
      setTimeout(() => setColorQuantityError(""), 3000);
      return;
    }
    setColorQuantityError("");
    setNewStockEntry((prev) => ({
      ...prev,
      colorQuantities: prev.colorQuantities.filter((_, i) => i !== index),
    }));
  };

  const handleColorQuantityChange = (index, field, value) => {
    setNewStockEntry((prev) => {
      const updated = [...prev.colorQuantities];
      const current = { ...updated[index], [field]: value };

      // If changing color and this color already exists in any existing colorQuantity entry
      // on the spare, ask user whether to use existing min stock level or enter new one
      if (field === "color" && value && value !== "other") {
        const existingColorEntry = (spare?.colorQuantity || []).find(
          (cq) => (cq.color || "").toLowerCase() === String(value).toLowerCase()
        );
        if (existingColorEntry && existingColorEntry.minStockLevel !== undefined) {
          // Only show dialog if user hasn't entered a minStockLevel yet for this row
          if (
            current.minStockLevel === undefined ||
            current.minStockLevel === ""
          ) {
            // Store the pending color change and show dialog
            setPendingColorIndex(index);
            setPendingColorValue(value);
            setExistingMinStockLevel(parseInt(existingColorEntry.minStockLevel || 0));
            setShowMinStockLevelDialog(true);
            // Don't update the color yet - wait for user's choice
            return prev;
          }
        }
      }

      updated[index] = current;

      // Clear error if last row is now valid
      const lastIndex = updated.length - 1;
      if (
        index === lastIndex &&
        updated[lastIndex].color &&
        updated[lastIndex].quantity &&
        parseInt(updated[lastIndex].quantity) > 0
      ) {
        setColorQuantityError("");
      }

      return { ...prev, colorQuantities: updated };
    });
  };

  // Handle user's choice for min stock level dialog
  const handleMinStockLevelChoice = (useExisting) => {
    if (pendingColorIndex !== null) {
      setNewStockEntry((prev) => {
        const updated = [...prev.colorQuantities];
        const current = { ...updated[pendingColorIndex] };
        current.color = pendingColorValue;
        if (useExisting) {
          current.minStockLevel = String(existingMinStockLevel);
        } else {
          // User wants to enter new value, leave minStockLevel empty
          current.minStockLevel = "";
        }
        updated[pendingColorIndex] = current;
        return { ...prev, colorQuantities: updated };
      });
    }
    setShowMinStockLevelDialog(false);
    setPendingColorIndex(null);
    setPendingColorValue("");
    setExistingMinStockLevel(0);
  };

  // Date picker helpers
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  // Handle date selection from calendar (for new entry)
  const handleDateSelect = (day) => {
    const selectedDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    const formattedDate = formatDate(selectedDate);
    setNewStockEntry((prev) => ({
      ...prev,
      purchaseDate: formattedDate,
    }));
    setShowDatePicker(false);
  };

  // Handle date selection from calendar (for edit entry)
  const handleEditDateSelect = (day) => {
    const selectedDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    const formattedDate = formatDate(selectedDate);
    setEditingEntry((prev) => ({
      ...prev,
      purchaseDate: formattedDate,
    }));
    setShowEditDatePicker(false);
  };

  // Delete stock entry function
  const handleDeleteStockEntry = async (entryIndex) => {
    if (!window.confirm("Are you sure you want to delete this stock entry?")) {
      return;
    }

    try {
      // Get current stock entries
      const currentStockEntries = spare?.[stockField] || [];

      // Remove the specific entry
      const updatedStockEntries = currentStockEntries.filter(
        (_, index) => index !== entryIndex
      );

      // Update the spare with the filtered stock entries
      const response = await fetchWithRetry(`/spares/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          [stockField]: updatedStockEntries,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete stock entry");
      }

      // Refresh the data
      await fetchSpareDetails();

      console.log("Stock entry deleted successfully");
    } catch (error) {
      console.error("Error deleting stock entry:", error);
      alert("Failed to delete stock entry. Please try again.");
    }
  };

  // Handle edit color entry
  const handleEditColorEntry = (colorIndex) => {
    const colorEntry = spare?.colorQuantity?.[colorIndex];
    if (!colorEntry) return;

    setEditingColorIndex(colorIndex);
    const purchased =
      colorEntry.originalQuantity != null && colorEntry.originalQuantity !== ""
        ? String(colorEntry.originalQuantity)
        : String(spareLayerPurchasedQty(colorEntry));
    setEditingColorEntry({
      color: colorEntry.color || "",
      originalQuantity: purchased,
      quantity: colorEntry.quantity?.toString() || "",
      purchasePrice: colorEntry.purchasePrice?.toString() || "",
      purchaseDate: colorEntry.purchaseDate
        ? formatDate(new Date(colorEntry.purchaseDate))
        : formatDate(new Date()),
      minStockLevel: colorEntry.minStockLevel?.toString() || "",
    });
  };

  // Handle delete color entry
  const handleDeleteColorEntry = async (colorIndex) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this color entry? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const currentColorQuantity = spare?.colorQuantity || [];
      const colorToDelete = currentColorQuantity[colorIndex];
      
      if (!colorToDelete) {
        console.error("Color entry not found at index:", colorIndex);
        return;
      }

      // Get the purchase date of the color being deleted
      const deletedColorDate = displayDate(colorToDelete.purchaseDate || "");
      
      // Filter out the deleted color
      const updatedColorQuantity = currentColorQuantity.filter(
        (_, index) => index !== colorIndex
      );

      // Get current stock entries and preserve them
      const currentStockEntries = spare?.[stockField] || [];
      
      // Recalculate total quantity for the purchase date after deletion
      const remainingColorsForDate = updatedColorQuantity.filter(
        (cq) => displayDate(cq.purchaseDate || "") === deletedColorDate
      );
      const newTotalQuantity = remainingColorsForDate.reduce(
        (sum, cq) => sum + parseInt(cq.quantity || 0),
        0
      );

      // Update or remove the stock entry for this date
      let updatedStockEntries = [...currentStockEntries];
      const entryIndexForDate = updatedStockEntries.findIndex(
        (entry) => displayDate(entry.purchaseDate || "") === deletedColorDate
      );

      if (entryIndexForDate !== -1) {
        if (newTotalQuantity > 0) {
          // Update the entry with new total quantity
          updatedStockEntries[entryIndexForDate] = {
            ...updatedStockEntries[entryIndexForDate],
            quantity: newTotalQuantity,
          };
        } else {
          // Remove the entry if no colors remain for this date
          updatedStockEntries = updatedStockEntries.filter(
            (_, index) => index !== entryIndexForDate
          );
        }
      }

      const response = await fetchWithRetry(`/spares/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          colorQuantity: updatedColorQuantity,
          [stockField]: updatedStockEntries,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete color entry");
      }

      await fetchSpareDetails();
      setEditingColorIndex(null);
      setEditingColorEntry(null);
      setActiveColorByDate({}); // Reset active color selection
      console.log("Color entry deleted successfully");
    } catch (error) {
      console.error("Error deleting color entry:", error);
      alert("Failed to delete color entry: " + error.message);
    }
  };


  // Handle save edited color entry
  const handleSaveColorEntry = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormWarning("");

    if (!editingColorEntry?.color) {
      setFormError("Color is required");
      return;
    }

    if (
      editingColorEntry?.quantity === "" ||
      editingColorEntry?.quantity === undefined ||
      editingColorEntry?.quantity === null
    ) {
      setFormError("Quantity left is required");
      return;
    }

    const leftQty = parseInt(String(editingColorEntry.quantity).trim(), 10);
    if (Number.isNaN(leftQty) || leftQty < 0) {
      setFormError("Quantity left must be a number 0 or greater.");
      return;
    }

    const purchasedParsed = parseInt(
      String(editingColorEntry.originalQuantity ?? "").trim(),
      10
    );
    const baselinePurchased = spareLayerPurchasedQty(
      spare?.colorQuantity?.[editingColorIndex]
    );
    const purchasedQty = Number.isNaN(purchasedParsed)
      ? baselinePurchased
      : Math.max(0, purchasedParsed);

    if (purchasedQty < leftQty) {
      setFormError(
        "Purchased quantity cannot be less than quantity left for this color."
      );
      return;
    }

    try {
      const currentColorQuantity = spare?.colorQuantity || [];
      const originalEntry = currentColorQuantity[editingColorIndex];
      if (!originalEntry) {
        setFormError("Color entry not found.");
        return;
      }

      const oldPriceRaw =
        originalEntry.purchasePrice !== undefined &&
        originalEntry.purchasePrice !== null
          ? parseFloat(originalEntry.purchasePrice)
          : null;

      let newPurchasePrice;
      if (!isPurchasePriceUnlocked) {
        newPurchasePrice =
          oldPriceRaw !== null && !Number.isNaN(oldPriceRaw) ? oldPriceRaw : 0;
      } else {
        const raw = editingColorEntry.purchasePrice;
        if (raw === "" || raw === undefined || raw === null) {
          newPurchasePrice = 0;
        } else {
          const p = parseFloat(raw);
          newPurchasePrice = Number.isNaN(p) ? 0 : p;
        }
      }

      const needsPurchasePriceAuth =
        newPurchasePrice > 0 &&
        (oldPriceRaw === null ||
          Number.isNaN(oldPriceRaw) ||
          newPurchasePrice !== oldPriceRaw);

      if (needsPurchasePriceAuth) {
        if (!isPurchasePriceUnlocked) {
          setFormError(
            "Please unlock the purchase price field with security key first."
          );
          return;
        }
        const sk = sessionStorage.getItem("adminSecurityKey");
        if (!sk) {
          setFormError(
            "Admin authentication required to set or change purchase price."
          );
          return;
        }
      }

      const updatedColorQuantity = currentColorQuantity.map((cq, index) =>
        index === editingColorIndex
          ? {
              ...cq,
              color: editingColorEntry.color.trim(),
              quantity: leftQty,
              originalQuantity: purchasedQty,
              minStockLevel: editingColorEntry.minStockLevel
                ? parseInt(editingColorEntry.minStockLevel, 10)
                : 0,
              purchasePrice: newPurchasePrice,
              purchaseDate: originalEntry.purchaseDate || cq.purchaseDate || "",
            }
          : cq
      );

      const body = { colorQuantity: updatedColorQuantity };
      if (needsPurchasePriceAuth) {
        body.securityKey = sessionStorage.getItem("adminSecurityKey");
      }

      const response = await fetchWithRetry(`/spares/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let msg = "Failed to update color entry";
        try {
          const err = await response.json();
          if (err.requiresAuth) {
            msg =
              err.message ||
              "Admin authentication required to update purchase price.";
          } else {
            msg = err.message || err.error || msg;
          }
        } catch {
          /* non-JSON body */
        }
        throw new Error(msg);
      }

      await fetchSpareDetails();
      setEditingColorIndex(null);
      setEditingColorEntry(null);
      setFormError("");
      setFormWarning("");
    } catch (error) {
      console.error("Error updating color entry:", error);
      setFormError(error.message || "Failed to update color entry");
    }
  };

  // Handle cancel edit color entry
  const handleCancelEditColor = () => {
    setEditingColorIndex(null);
    setEditingColorEntry(null);
    setFormError("");
    setFormWarning("");
  };

  // Core submit logic so we can call it both from form submit and "Later" dialog
  const submitStockEntry = async (allowMissingPurchasePrice = false) => {
    setFormError("");
    setFormWarning("");

    // Validate form first (purchase price can be optional)
    if (!isColorTrackingEnabled) {
      // Non-color tracking mode validation
      if (!newStockEntry.quantity || !newStockEntry.purchaseDate) {
        setFormError("Quantity and purchase date are required");
        return;
      }

      if (parseFloat(newStockEntry.quantity) < 0) {
        setFormError("Quantity must be 0 or greater");
        return;
      }

      // If user entered a purchase price, it must be > 0
      if (
        newStockEntry.purchasePrice &&
        parseFloat(newStockEntry.purchasePrice) <= 0
      ) {
        setFormError("Purchase price must be greater than 0 when provided");
        return;
      }
    } else {
      // Color tracking mode validation
      if (
      !newStockEntry.purchaseDate ||
        !newStockEntry.colorQuantities ||
        newStockEntry.colorQuantities.length === 0
    ) {
      setFormError(
          "Purchase date and at least one color-quantity pair are required"
      );
      return;
    }

      // Validate each color-quantity pair
      const invalidPairs = newStockEntry.colorQuantities.filter((cq) => {
        const qRaw = cq.quantity;
        const minRaw = cq.minStockLevel;
        return (
          !cq.color ||
          qRaw === "" ||
          qRaw === null ||
          qRaw === undefined ||
          parseInt(qRaw) < 0 ||
          minRaw === "" ||
          minRaw === null ||
          minRaw === undefined ||
          parseInt(minRaw) < 0 ||
          (cq.color === "other" && !cq.customColor?.trim())
        );
      });

      if (invalidPairs.length > 0) {
        setFormError(
          "Please fill all color, quantity, and min stock level fields. Quantity must be 0 or greater. Min stock level must be 0 or greater. Custom color name is required when 'Other' is selected."
        );
        return;
      }

      // If user entered a purchase price, it must be > 0
      if (
        newStockEntry.purchasePrice &&
        parseFloat(newStockEntry.purchasePrice) <= 0
      ) {
        setFormError("Purchase price must be greater than 0 when provided");
        return;
      }

      // Check for duplicate purchase date - prevent creating new entry with existing date
      const newDate = displayDate(newStockEntry.purchaseDate);
      const currentColorQuantity = spare?.colorQuantity || [];
      const uniqueDates = new Set(currentColorQuantity.map(cq => displayDate(cq.purchaseDate || "")));
      
      if (uniqueDates.has(newDate)) {
        setFormWarning(
          "A stock entry with this purchase date already exists. Please use a different date or click the 'Edit' button on the existing entry to add more colors."
        );
        setTimeout(() => setFormWarning(""), 5000);
        setIsSubmitting(false);
        return;
      }
    }

    // Decide whether we should prompt user about missing purchase price
    const hasPurchasePrice =
      newStockEntry.purchasePrice &&
      parseFloat(newStockEntry.purchasePrice) > 0;

    if (!hasPurchasePrice && !allowMissingPurchasePrice) {
      // Ask user whether to enter purchase price now or later
      setShowPurchasePriceDecisionDialog(true);
      return;
    }

    // Check admin authentication BEFORE submitting when purchase price is being set
    if (hasPurchasePrice && !isPurchasePriceUnlocked) {
      setFormError(
        "Please unlock the purchase price field with security key first."
      );
      return;
    }

    if (hasPurchasePrice) {
      const securityKey = sessionStorage.getItem("adminSecurityKey");
      if (!securityKey) {
        setFormError(
          "Admin authentication required to set purchase price. Please unlock with security key first."
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Get current stock entries and color quantities
      const currentStockEntries = spare?.[stockField] || [];
      const currentColorQuantity = spare?.colorQuantity || [];
      console.log("Current stock entries:", currentStockEntries);
      console.log("Current color quantities:", currentColorQuantity);

      let updatedStockEntries;
      let updatedColorQuantity;

      // Only compute stockEntries updates when color tracking is disabled
      if (!isColorTrackingEnabled) {
        const newDate = displayDate(newStockEntry.purchaseDate);
        const hasDuplicateDate = currentStockEntries.some(
          (entry) => displayDate(entry.purchaseDate) === newDate
        );
        if (hasDuplicateDate) {
          setFormWarning(
            "A stock entry with this purchase date already exists"
          );
          setTimeout(() => setFormWarning(""), 3000);
          setIsSubmitting(false);
          return;
        }

        const q1 = parseInt(newStockEntry.quantity, 10);
        updatedStockEntries = [
          ...currentStockEntries,
          {
            quantity: q1,
            originalQuantity: q1,
            purchasePrice: hasPurchasePrice
              ? parseFloat(newStockEntry.purchasePrice)
              : 0,
            purchaseDate: newStockEntry.purchaseDate,
          },
        ];
      }

      // Update colorQuantity array when color tracking is enabled
      if (isColorTrackingEnabled) {
        // Create a color entry for each color-quantity pair
        const newColorEntries = newStockEntry.colorQuantities
          .filter(
            (cq) =>
              cq.color &&
              cq.quantity !== "" &&
              cq.quantity !== null &&
              cq.quantity !== undefined &&
              parseInt(cq.quantity) >= 0
          )
          .map((cq) => {
            const qCol = parseInt(cq.quantity, 10);
            return {
              color:
                cq.color === "other"
                  ? cq.customColor
                    ? cq.customColor.trim()
                    : ""
                  : cq.color.trim(),
              quantity: qCol,
              originalQuantity: qCol,
              minStockLevel: cq.minStockLevel ? parseInt(cq.minStockLevel) : 0,
              purchasePrice: hasPurchasePrice
                ? parseFloat(newStockEntry.purchasePrice)
                : 0,
              purchaseDate: newStockEntry.purchaseDate,
            };
          });

        updatedColorQuantity = [...currentColorQuantity, ...newColorEntries];

        // Normalize min stock levels so the latest value for each color
        // becomes the default across all entries
        updatedColorQuantity = normalizeColorMinStockLevels(updatedColorQuantity);
      } else {
        updatedColorQuantity = currentColorQuantity;
      }

      console.log("Updated stock entries:", updatedStockEntries);
      console.log("Updated color quantities:", updatedColorQuantity);

      // Security key should already be validated above, but get it again for the request
      const securityKey = sessionStorage.getItem("adminSecurityKey");

      // Update the spare: when color tracking is enabled, only update colorQuantity; otherwise update stockEntries
      // Only include securityKey when a purchase price is actually being set
      const baseBody = isColorTrackingEnabled
        ? { colorQuantity: updatedColorQuantity, [stockField]: [] }
        : { [stockField]: updatedStockEntries };

      const requestBody = hasPurchasePrice && securityKey
        ? { ...baseBody, securityKey }
        : baseBody;

      const response = await fetchWithRetry(`/spares/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresAuth) {
          setFormError("Admin authentication required to set purchase price. Please log in as admin.");
          setIsSubmitting(false);
          return;
        }
        throw new Error(errorData.message || "Error adding stock entry");
      }

      console.log("Stock entry successfully added to database");

      // Refresh spare details
      await fetchSpareDetails();
      console.log("Spare details refreshed");

      // Reset form
      setNewStockEntry({
        purchasePrice: "",
        purchaseDate: formatDate(new Date()),
        colorQuantities: [{ color: "", quantity: "", minStockLevel: "" }],
        quantity: "", // Keep for non-color tracking mode
      });

      setColorQuantityError("");
      setFormError("");
      setFormWarning("");
    } catch (err) {
      setFormError(err.message || "Error adding stock entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle form submission for new stock entry
  const handleSubmitStockEntry = async (e) => {
    e.preventDefault();
    await submitStockEntry(false);
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <div>Loading spare details...</div>
      </div>
    );
  }

  if (error && !spare) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</div>
        <button
          onClick={() => navigate("/spares")}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          Back to Spares
        </button>
      </div>
    );
  }

  return (
    <div className="add-more-stock-page" style={style}>
      <style>
        {`
          @keyframes pulse {
            0% {
              transform: scale(1);
              box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
            }
            50% {
              transform: scale(1.02);
              box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
            }
            100% {
              transform: scale(1);
              box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
            }
          }
        `}
      </style>
      <button
        onClick={() => navigate("/spares/all")}
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          padding: "0.5rem 1rem",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "0.375rem",
          cursor: "pointer",
          fontSize: "0.875rem",
          zIndex: 10,
        }}
      >
        Back to Spares →
      </button>
      <div
        className="add-more-stock-card"
        style={{
          backgroundColor: "white",
          padding: "1.25rem",
          borderRadius: "0.5rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            marginBottom: "2rem",
          }}
        >
          <h3 style={{ marginBottom: "1rem", color: "#1f2937" }}>
            Spare Details
          </h3>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#374151",
                }}
              >
                Spare Name
              </label>
              <input
                type="text"
                value={spare?.name || ""}
                readOnly
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  backgroundColor: "#f9fafb",
                  fontSize: "0.875rem",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#374151",
                }}
              >
                Models
              </label>
              <input
                type="text"
                value={spare?.models?.join(", ") || "N/A"}
                readOnly
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  backgroundColor: "#f9fafb",
                  fontSize: "0.875rem",
                }}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#374151",
                }}
              >
                Supplier Name
              </label>
              <input
                type="text"
                value={spare?.supplierName || "N/A"}
                readOnly
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  backgroundColor: "#f9fafb",
                  fontSize: "0.875rem",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#374151",
                }}
              >
                Selling Price
              </label>
              <input
                type="text"
                value={
                  spare?.sellingPrice && parseFloat(spare.sellingPrice) > 0
                    ? "₹" +
                      parseFloat(spare.sellingPrice).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "Not set"
                }
                readOnly
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  backgroundColor: "#f9fafb",
                  color: spare?.sellingPrice && parseFloat(spare.sellingPrice) > 0 ? "#1f2937" : "#9ca3af",
                  fontStyle: spare?.sellingPrice && parseFloat(spare.sellingPrice) > 0 ? "normal" : "italic",
                  fontSize: "0.875rem",
                }}
              />
            </div>
            </div>
          </div>
        </div>

      {/* Add New Stock Entry Section - Always visible by default */}
        {editingEntryIndex === null && (
          <div 
            id="add-stock-form-section" 
            ref={formSectionRef}
            style={{ marginBottom: "2rem" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
                paddingBottom: "0.75rem",
                borderBottom: "2px solid #e5e7eb",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <h3
                style={{
                  margin: 0,
                  color: "#1f2937",
                  fontSize: "1.25rem",
                  fontWeight: "600",
                }}
              >
                  Add New Stock Entry
              </h3>
              {isColorTrackingEnabled && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    backgroundColor: "#ECFDF5",
                    color: "#065F46",
                    border: "1px solid #A7F3D0",
                    borderRadius: "9999px",
                    padding: "0.25rem 0.75rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                  title="Color tracking is enabled for this spare"
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      backgroundColor: "#10B981",
                      borderRadius: "9999px",
                      display: "inline-block",
                    }}
                  ></span>
                  Color tracking enabled
                </div>
              )}
              </div>
            </div>

            <form onSubmit={handleSubmitStockEntry}>
              {(formError || formWarning) && (
                <div
                  style={{
                    marginBottom: "1rem",
                    padding: "0.75rem",
                    backgroundColor: formWarning ? "#FEF3C7" : "#fee2e2",
                    color: formWarning ? "#92400E" : "#dc2626",
                    borderRadius: "0.375rem",
                    border: formWarning
                      ? "1px solid #FCD34D"
                      : "1px solid #fecaca",
                  }}
                >
                  {formWarning || formError}
                </div>
              )}

              {/* Form fields - different for color tracking vs non-color tracking */}
              {isColorTrackingEnabled ? (
                <>
                  {/* Purchase Date and Purchase Price - for color tracking */}
              <div
                style={{
                  display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                    <div style={{ position: "relative" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        color: "#374151",
                        fontWeight: "500",
                      }}
                    >
                        Purchase Date *
                    </label>
                    <input
                      type="text"
                        name="purchaseDate"
                        value={newStockEntry.purchaseDate}
                      onChange={handleInputChange}
                        onFocus={() => setShowDatePicker(true)}
                        placeholder="DD/MM/YYYY"
                        required
                      disabled={isSubmitting}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                          border: preFilledFields.purchaseDate
                            ? "2px solid #3b82f6"
                            : "1px solid #d1d5db",
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                          backgroundColor: preFilledFields.purchaseDate
                            ? "#eff6ff"
                            : "#ffffff",
                          boxShadow: preFilledFields.purchaseDate
                            ? "0 0 0 3px rgba(59, 130, 246, 0.1)"
                            : "none",
                          transition: "all 0.3s ease",
                          animation: preFilledFields.purchaseDate
                            ? "pulse 0.6s ease-in-out"
                            : "none",
                      }}
                    />
                      {showDatePicker && (
                        <div
                          ref={datePickerRef}
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            zIndex: 1000,
                            backgroundColor: "white",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.5rem",
                            padding: "1rem",
                            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                            marginTop: "0.25rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "1rem",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentMonth(
                                  new Date(
                                    currentMonth.getFullYear(),
                                    currentMonth.getMonth() - 1
                                  )
                                )
                              }
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "1.25rem",
                              }}
                            >
                              ←
                            </button>
                            <div style={{ fontWeight: "600" }}>
                              {currentMonth.toLocaleDateString("en-US", {
                                month: "long",
                                year: "numeric",
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentMonth(
                                  new Date(
                                    currentMonth.getFullYear(),
                                    currentMonth.getMonth() + 1
                                  )
                                )
                              }
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "1.25rem",
                              }}
                            >
                              →
                            </button>
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(7, 1fr)",
                              gap: "0.25rem",
                            }}
                          >
                            {[
                              "Sun",
                              "Mon",
                              "Tue",
                              "Wed",
                              "Thu",
                              "Fri",
                              "Sat",
                            ].map((day) => (
                              <div
                                key={day}
                                style={{
                                  textAlign: "center",
                                  fontWeight: "600",
                                  fontSize: "0.75rem",
                                  color: "#6b7280",
                                  padding: "0.5rem",
                                }}
                              >
                                {day}
                              </div>
                            ))}
                            {Array.from({
                              length: getFirstDayOfMonth(currentMonth),
                            }).map((_, i) => (
                              <div key={`empty-${i}`} />
                            ))}
                            {Array.from({
                              length: getDaysInMonth(currentMonth),
                            }).map((_, i) => {
                              const dayNumber = i + 1;
                              const currentDate = new Date(
                                currentMonth.getFullYear(),
                                currentMonth.getMonth(),
                                dayNumber
                              );
                              const currentDateString = formatDate(currentDate);
                              const isSelected =
                                currentDateString === newStockEntry.purchaseDate;
                              const isToday =
                                currentDateString === formatDate(new Date());
                              const isFuture =
                                currentDate >
                                new Date().setHours(23, 59, 59, 999);
                              return (
                                <div
                                  key={i}
                                  onClick={() =>
                                    !isFuture && handleDateSelect(dayNumber)
                                  }
                                  style={{
                                    padding: "0.5rem",
                                    textAlign: "center",
                                    cursor: isFuture ? "not-allowed" : "pointer",
                                    borderRadius: "0.25rem",
                                    backgroundColor: isSelected
                                      ? "#3b82f6"
                                      : isToday
                                      ? "#f3f4f6"
                                      : isFuture
                                      ? "#f9fafb"
                                      : "transparent",
                                    color: isSelected
                                      ? "white"
                                      : isToday
                                      ? "#1f2937"
                                      : isFuture
                                      ? "#d1d5db"
                                      : "#374151",
                                    fontSize: "0.875rem",
                                    fontWeight: isToday ? "600" : "400",
                                    border:
                                      isToday && !isSelected
                                        ? "1px solid #d1d5db"
                                        : "none",
                                    opacity: isFuture ? 0.5 : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected && !isFuture) {
                                      e.currentTarget.style.backgroundColor =
                                        isToday ? "#e5e7eb" : "#f3f4f6";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected && !isFuture) {
                                      e.currentTarget.style.backgroundColor =
                                        isToday ? "#f3f4f6" : "transparent";
                                    }
                                  }}
                                >
                                  {dayNumber}
                                </div>
                              );
                            })}
                          </div>
                  </div>
                )}
                    </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        color: "#374151",
                        fontWeight: "500",
                      }}
                    >
                        Purchase Price
                    </label>
                      {!isPurchasePriceUnlocked ? (
                        <div
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "2px solid #d1d5db",
                            borderRadius: "0.375rem",
                            backgroundColor: "#f9fafb",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onClick={() => setShowPurchasePriceDialog(true)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "#3b82f6";
                            e.currentTarget.style.backgroundColor = "#eff6ff";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "#d1d5db";
                            e.currentTarget.style.backgroundColor = "#f9fafb";
                          }}
                        >
                          <span style={{ fontSize: "1.25rem" }}>🔒</span>
                          <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                            Click to unlock with security key
                          </span>
                        </div>
                      ) : (
                    <input
                      type="number"
                          name="purchasePrice"
                          value={newStockEntry.purchasePrice}
                      onChange={handleInputChange}
                          placeholder="Enter purchase price"
                          min="0.01"
                          step="0.01"
                          required
                      disabled={isSubmitting}
                      onWheel={(e) => e.target.blur()}
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            border: preFilledFields.purchasePrice
                              ? "2px solid #3b82f6"
                              : "1px solid #d1d5db",
                            borderRadius: "0.375rem",
                            fontSize: "0.875rem",
                            backgroundColor: preFilledFields.purchasePrice
                              ? "#eff6ff"
                              : "#ffffff",
                            boxShadow: preFilledFields.purchasePrice
                              ? "0 0 0 3px rgba(59, 130, 246, 0.1)"
                              : "none",
                            transition: "all 0.3s ease",
                            animation: preFilledFields.purchasePrice
                              ? "pulse 0.6s ease-in-out"
                              : "none",
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Color & Quantity Section */}
                  <div style={{ marginBottom: "1.5rem" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        color: "#374151",
                        fontWeight: "500",
                      }}
                    >
                      Color, Quantity & Min Stock Level *
                    </label>
                    {newStockEntry.colorQuantities.map((entry, index) => (
                      <div
                        key={index}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 1fr auto",
                          gap: "0.5rem",
                          marginBottom: "0.5rem",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              fontSize: "0.875rem",
                              marginBottom: "0.25rem",
                              display: "block",
                            }}
                          >
                            Color
                          </label>
                          <select
                            value={entry.color}
                            onChange={(e) =>
                              handleColorQuantityChange(
                                index,
                                "color",
                                e.target.value
                              )
                            }
                            disabled={isSubmitting}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                        backgroundColor: "#ffffff",
                      }}
                          >
                            <option value="">Select color</option>
                            {colorOptions.map((color) => {
                              const selectedInForm = newStockEntry.colorQuantities
                                .map((e, i) => (i !== index ? e.color : ""))
                                .filter((c) => c && c !== "");
                              const isSelectedInForm = selectedInForm.some(
                                (c) => c.toLowerCase() === color.value.toLowerCase() || 
                                       colorOptions.find(opt => opt.value.toLowerCase() === c.toLowerCase())?.label.toLowerCase() === color.label.toLowerCase()
                              );
                              
                              // Only disable if already selected in the current form (not based on existing entries)
                              const isDisabled = isSelectedInForm;
                              return (
                                <option
                                  key={color.value}
                                  value={color.value}
                                  disabled={isDisabled}
                                >
                                  {color.label}{" "}
                                  {isSelectedInForm ? "(already selected)" : ""}
                                </option>
                              );
                            })}
                            <option value="other" disabled={false}>
                              Other (specify)
                            </option>
                          </select>
                          {/* Color Preview */}
                          <div
                            style={{
                              width: "100%",
                              height: "40px",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.375rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              position: "relative",
                              overflow: "hidden",
                              backgroundColor: "#f5f5f5",
                              marginTop: "0.5rem",
                            }}
                          >
                            {entry.color === "white-black" ? (
                              <>
                                <div
                                  style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    width: "50%",
                                    height: "100%",
                                    backgroundColor: "#FFFFFF",
                                  }}
                                />
                                <div
                                  style={{
                                    position: "absolute",
                                    right: 0,
                                    top: 0,
                                    width: "50%",
                                    height: "100%",
                                    backgroundColor: "#000000",
                                  }}
                                />
                                <span
                                  style={{
                                    position: "relative",
                                    zIndex: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "100%",
                                    height: "100%",
                                  }}
                                >
                                  <span
                                    style={{
                                      position: "absolute",
                                      left: "25%",
                                      color: "#000",
                                      fontWeight: "bold",
                                      fontSize: "14px",
                                    }}
                                  >
                                    W
                                  </span>
                                  <span
                                    style={{
                                      position: "absolute",
                                      right: "25%",
                                      color: "#fff",
                                      fontWeight: "bold",
                                      fontSize: "14px",
                                    }}
                                  >
                                    B
                                  </span>
                                </span>
                              </>
                            ) : (
                              <>
                                <div
                                  style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    width: "100%",
                                    height: "100%",
                                    backgroundColor:
                                      entry.color === "other" || !entry.color
                                        ? "#f5f5f5"
                                        : getColourDisplay(entry.color),
                                  }}
                                />
                                <span
                                  style={{
                                    position: "relative",
                                    zIndex: 1,
                                    color:
                                      entry.color === "white" ||
                                      entry.color === "yellow"
                                        ? "#000"
                                        : entry.color && entry.color !== "other"
                                        ? "#fff"
                                        : "#666",
                                  }}
                                >
                                  {entry.color && entry.color !== "other"
                                    ? colorOptions.find(
                                        (c) => c.value === entry.color
                                      )?.label
                                    : entry.color === "other"
                                    ? (entry.customColor?.trim() || "Custom")
                                    : "No color"}
                                </span>
                              </>
                            )}
                  </div>
                          {entry.color === "other" && (
                            <input
                              type="text"
                              placeholder="Enter custom color name"
                              value={entry.customColor || ""}
                              onChange={(e) => {
                                const updated = [...newStockEntry.colorQuantities];
                                updated[index] = { ...updated[index], customColor: e.target.value };
                                setNewStockEntry((prev) => ({ ...prev, colorQuantities: updated }));
                              }}
                              disabled={isSubmitting}
                              style={{
                                width: "100%",
                                padding: "0.5rem",
                                border: "1px solid #d1d5db",
                                borderRadius: "0.375rem",
                                fontSize: "0.875rem",
                                marginTop: "0.5rem",
                                backgroundColor: "#ffffff",
                              }}
                            />
                          )}
                        </div>
                <div>
                  <label
                    style={{
                              fontSize: "0.875rem",
                              marginBottom: "0.25rem",
                      display: "block",
                    }}
                  >
                            Quantity
                  </label>
                  <input
                    type="number"
                            value={entry.quantity}
                            onChange={(e) =>
                              handleColorQuantityChange(
                                index,
                                "quantity",
                                e.target.value
                              )
                            }
                            placeholder="Quantity"
                            min="0"
                    disabled={isSubmitting}
                    onWheel={(e) => e.target.blur()}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      backgroundColor: "#ffffff",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                              fontSize: "0.875rem",
                              marginBottom: "0.25rem",
                      display: "block",
                    }}
                  >
                            Min Stock Level *
                  </label>
                  <input
                    type="number"
                            value={entry.minStockLevel || ""}
                            onChange={(e) =>
                              handleColorQuantityChange(
                                index,
                                "minStockLevel",
                                e.target.value
                              )
                            }
                            placeholder="Min level"
                            min="0"
                    required
                    disabled={isSubmitting}
                    onWheel={(e) => e.target.blur()}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                              border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                              backgroundColor: "#ffffff",
                            }}
                          />
                        </div>
                        {newStockEntry.colorQuantities.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeColorQuantityEntry(index)}
                            disabled={isSubmitting}
                            style={{
                              padding: "0.5rem",
                              border: "1px solid #dc2626",
                              borderRadius: "0.375rem",
                              backgroundColor: "#fee2e2",
                              color: "#dc2626",
                              cursor: "pointer",
                              fontSize: "1rem",
                              width: "40px",
                              height: "40px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              marginTop: "1.5rem",
                            }}
                            title="Remove entry"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        marginTop: "0.5rem",
                      }}
                    >
                      <button
                        type="button"
                        onClick={addColorQuantityEntry}
                        disabled={isSubmitting}
                        style={{
                          padding: "0.5rem 1rem",
                          border: "1px solid #10b981",
                          borderRadius: "0.375rem",
                          backgroundColor: "#d1fae5",
                          color: "#10b981",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                          fontWeight: "500",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ fontSize: "1.2rem" }}>+</span>
                        <span>Add More Color & Quantity</span>
                      </button>
                      {colorQuantityError && (
                        <span
                          style={{
                            color: "#dc2626",
                            fontSize: "0.875rem",
                            fontWeight: "500",
                            whiteSpace: "nowrap",
                    }}
                        >
                          {colorQuantityError}
                        </span>
                      )}
                    </div>
                </div>

                  {/* Submit buttons for color tracking mode */}
                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      justifyContent: "flex-end",
                      marginTop: "1.5rem",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setNewStockEntry({
                          purchasePrice: "",
                          purchaseDate: formatDate(new Date()),
                          colorQuantities: [{ color: "", quantity: "", minStockLevel: "" }],
                          quantity: "",
                        });
                        setFormError("");
                        setFormWarning("");
                        setColorQuantityError("");
                      }}
                      disabled={isSubmitting}
                      style={{
                        padding: "0.75rem 1.5rem",
                        backgroundColor: "#6b7280",
                        color: "white",
                        border: "none",
                        borderRadius: "0.375rem",
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                      }}
                    >
                      Clear
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{
                        padding: "0.75rem 1.5rem",
                        backgroundColor: isSubmitting ? "#9ca3af" : "#3b82f6",
                        color: "white",
                        border: "none",
                        borderRadius: "0.375rem",
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                      }}
                    >
                      {isSubmitting ? "Adding..." : "Add Stock Entry"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Non-color tracking mode: Purchase Date, Purchase Price, Quantity */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "1rem",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <div style={{ position: "relative" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      color: "#374151",
                      fontWeight: "500",
                    }}
                  >
                    Purchase Date *
                  </label>
                    <input
                      type="text"
                      name="purchaseDate"
                      value={newStockEntry.purchaseDate}
                      onChange={handleInputChange}
                        onFocus={() => setShowDatePicker(true)}
                        placeholder="DD/MM/YYYY"
                      required
                      disabled={isSubmitting}
                      style={{
                          width: "100%",
                        padding: "0.5rem",
                        border: preFilledFields.purchaseDate
                          ? "2px solid #3b82f6"
                          : "1px solid #d1d5db",
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                        backgroundColor: preFilledFields.purchaseDate
                          ? "#eff6ff"
                          : "#ffffff",
                        boxShadow: preFilledFields.purchaseDate
                          ? "0 0 0 3px rgba(59, 130, 246, 0.1)"
                          : "none",
                        transition: "all 0.3s ease",
                        animation: preFilledFields.purchaseDate
                          ? "pulse 0.6s ease-in-out"
                          : "none",
                      }}
                    />
                      {showDatePicker && (
                        <div
                          ref={datePickerRef}
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            zIndex: 1000,
                            backgroundColor: "white",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.5rem",
                            padding: "1rem",
                            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                            marginTop: "0.25rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "1rem",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentMonth(
                                  new Date(
                                    currentMonth.getFullYear(),
                                    currentMonth.getMonth() - 1
                                  )
                                )
                              }
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "1.25rem",
                              }}
                            >
                              ←
                            </button>
                            <div style={{ fontWeight: "600" }}>
                              {currentMonth.toLocaleDateString("en-US", {
                                month: "long",
                                year: "numeric",
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentMonth(
                                  new Date(
                                    currentMonth.getFullYear(),
                                    currentMonth.getMonth() + 1
                                  )
                                )
                              }
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "1.25rem",
                              }}
                            >
                              →
                            </button>
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(7, 1fr)",
                              gap: "0.25rem",
                            }}
                          >
                            {[
                              "Sun",
                              "Mon",
                              "Tue",
                              "Wed",
                              "Thu",
                              "Fri",
                              "Sat",
                            ].map((day) => (
                                <div
                                  key={day}
                                  style={{
                                    textAlign: "center",
                                    fontWeight: "600",
                                  fontSize: "0.75rem",
                                    color: "#6b7280",
                                  padding: "0.5rem",
                                  }}
                                >
                                  {day}
                                </div>
                            ))}
                            {Array.from({
                              length: getFirstDayOfMonth(currentMonth),
                            }).map((_, i) => (
                              <div key={`empty-${i}`} />
                            ))}
                            {Array.from({
                              length: getDaysInMonth(currentMonth),
                            }).map((_, i) => {
                              const dayNumber = i + 1;
                              const currentDate = new Date(
                                currentMonth.getFullYear(),
                                currentMonth.getMonth(),
                                dayNumber
                              );
                              const currentDateString = formatDate(currentDate);
                              const isSelected =
                                currentDateString === newStockEntry.purchaseDate;
                              const isToday =
                                currentDateString === formatDate(new Date());
                              const isFuture =
                                currentDate >
                                new Date().setHours(23, 59, 59, 999);
                              return (
                                <div
                                  key={i}
                                  onClick={() =>
                                    !isFuture && handleDateSelect(dayNumber)
                                  }
                                  style={{
                                    padding: "0.5rem",
                                    textAlign: "center",
                                    cursor: isFuture ? "not-allowed" : "pointer",
                                    borderRadius: "0.25rem",
                                    backgroundColor: isSelected
                                      ? "#3b82f6"
                                      : isToday
                                      ? "#f3f4f6"
                                      : isFuture
                                      ? "#f9fafb"
                                      : "transparent",
                                    color: isSelected
                                      ? "white"
                                      : isToday
                                      ? "#1f2937"
                                      : isFuture
                                      ? "#d1d5db"
                                      : "#374151",
                                    fontSize: "0.875rem",
                                    fontWeight: isToday ? "600" : "400",
                                    border:
                                      isToday && !isSelected
                                        ? "1px solid #d1d5db"
                                        : "none",
                                    opacity: isFuture ? 0.5 : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected && !isFuture) {
                                      e.currentTarget.style.backgroundColor =
                                        isToday ? "#e5e7eb" : "#f3f4f6";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected && !isFuture) {
                                      e.currentTarget.style.backgroundColor =
                                        isToday ? "#f3f4f6" : "transparent";
                                    }
                                  }}
                                >
                                  {dayNumber}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          color: "#374151",
                          fontWeight: "500",
                        }}
                      >
                        Purchase Price *
                      </label>
                      {!isPurchasePriceUnlocked ? (
                        <div
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "2px solid #d1d5db",
                            borderRadius: "0.375rem",
                            backgroundColor: "#f9fafb",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onClick={() => setShowPurchasePriceDialog(true)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "#3b82f6";
                            e.currentTarget.style.backgroundColor = "#eff6ff";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "#d1d5db";
                            e.currentTarget.style.backgroundColor = "#f9fafb";
                          }}
                        >
                          <span style={{ fontSize: "1.25rem" }}>🔒</span>
                          <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                            Click to unlock with security key
                          </span>
                  </div>
                      ) : (
                        <input
                          type="number"
                          name="purchasePrice"
                          value={newStockEntry.purchasePrice}
                          onChange={handleInputChange}
                          placeholder="Enter purchase price"
                          min="0.01"
                          step="0.01"
                          required
                          disabled={isSubmitting}
                          onWheel={(e) => e.target.blur()}
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            border: preFilledFields.purchasePrice
                              ? "2px solid #3b82f6"
                              : "1px solid #d1d5db",
                            borderRadius: "0.375rem",
                            fontSize: "0.875rem",
                            backgroundColor: preFilledFields.purchasePrice
                              ? "#eff6ff"
                              : "#ffffff",
                            boxShadow: preFilledFields.purchasePrice
                              ? "0 0 0 3px rgba(59, 130, 246, 0.1)"
                              : "none",
                            transition: "all 0.3s ease",
                            animation: preFilledFields.purchasePrice
                              ? "pulse 0.6s ease-in-out"
                              : "none",
                          }}
                        />
                      )}
                </div>
              </div>

                  {/* Quantity field for non-color tracking mode - same width as Purchase Date column */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "1rem",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          color: "#374151",
                          fontWeight: "500",
                        }}
                      >
                        Quantity *
                      </label>
                      <input
                        type="number"
                        name="quantity"
                        value={newStockEntry.quantity}
                        onChange={handleInputChange}
                        placeholder="Enter quantity"
                        min="1"
                        required
                        disabled={isSubmitting}
                        onWheel={(e) => e.target.blur()}
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          border: "1px solid #d1d5db",
                          borderRadius: "0.375rem",
                          fontSize: "0.875rem",
                        }}
                      />
                    </div>
                    <div />
                  </div>

              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setNewStockEntry({
                      quantity: "",
                      purchasePrice: "",
                      purchaseDate: formatDate(new Date()),
                      color: "",
                    });
                    setFormError("");
                  }}
                  disabled={isSubmitting}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#6b7280",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: isSubmitting ? "#9ca3af" : "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  {isSubmitting ? "Adding..." : "Add Stock Entry"}
                </button>
              </div>
                </>
              )}
            </form>
          </div>
        )}

        {/* Edit Stock Entry Section - Appears above all stock entries */}
        {editingEntryIndex !== null && (
          <div id="edit-stock-section" style={{ marginBottom: "2rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
                paddingBottom: "0.75rem",
                borderBottom: "2px solid #3b82f6",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "#1f2937",
                  fontSize: "1.25rem",
                  fontWeight: "600",
                }}
              >
                Edit Stock Entry{" "}
                <span style={{ color: "#3b82f6" }}>
                  #{editingEntryIndex + 1}
                </span>
              </h3>
            </div>

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
              }}
            >
              {(formError || formWarning) && (
                <div
                  style={{
                    marginBottom: "1rem",
                    padding: "0.75rem",
                    backgroundColor: formWarning ? "#FEF3C7" : "#fee2e2",
                    color: formWarning ? "#92400E" : "#dc2626",
                    borderRadius: "0.375rem",
                    border: formWarning
                      ? "1px solid #FCD34D"
                      : "1px solid #fecaca",
                    fontSize: "0.875rem",
                  }}
                >
                  {formWarning || formError}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "3rem",
                  marginBottom: "1rem",
                  alignItems: "start",
                }}
              >
                <div>
                  {!isColorTrackingEnabled && (
                    <>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontSize: "0.875rem",
                          fontWeight: "500",
                          color: "#374151",
                        }}
                      >
                        Purchased (this entry)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingEntry?.originalQuantity ?? ""}
                        onChange={(e) =>
                          setEditingEntry({
                            ...editingEntry,
                            originalQuantity: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          border: "1px solid #d1d5db",
                          borderRadius: "0.375rem",
                          fontSize: "0.875rem",
                          backgroundColor: "#ffffff",
                          marginBottom: "0.5rem",
                        }}
                        placeholder="Units bought for this batch"
                        onWheel={(e) => e.target.blur()}
                      />
                      <small
                        style={{
                          color: "#6b7280",
                          fontSize: "0.75rem",
                          marginBottom: "0.75rem",
                          display: "block",
                          lineHeight: 1.4,
                        }}
                      >
                        Record of what was bought. Quantity left still tracks
                        stock after sales; you can correct purchased if the
                        initial entry was wrong.
                      </small>
                    </>
                  )}
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
                    {isColorTrackingEnabled
                      ? "Total quantity (from colors)"
                      : "Quantity left (this entry)"}
                  </label>
                  <input
                    type="number"
                    value={
                      editEntryColors.length > 0 || isColorTrackingEnabled
                        ? editEntryColors.reduce(
                            (total, cq) => total + cq.quantity,
                            0
                          )
                        : editingEntry?.quantity || ""
                    }
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        quantity: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      backgroundColor:
                        editEntryColors.length > 0 || isColorTrackingEnabled
                          ? "#f3f4f6"
                          : "#ffffff",
                      cursor: "text",
                    }}
                    placeholder={
                      editEntryColors.length > 0 || isColorTrackingEnabled
                        ? "Auto-calculated from colors"
                        : "Enter quantity"
                    }
                    min="0"
                    required
                    readOnly={
                      editEntryColors.length > 0 || isColorTrackingEnabled
                    }
                    onWheel={(e) => e.target.blur()}
                  />
                  {(editEntryColors.length > 0 || isColorTrackingEnabled) &&
                  editEntryColors.length > 0 ? (
                    <small
                      style={{
                        color: "#6b7280",
                        fontSize: "0.75rem",
                        marginTop: "0.25rem",
                        display: "block",
                      }}
                    >
                      Total quantity is automatically calculated from color
                      quantities.
                    </small>
                  ) : editEntryColors.length > 0 || isColorTrackingEnabled ? (
                    <small
                      style={{
                        color: "#6b7280",
                        fontSize: "0.75rem",
                        marginTop: "0.25rem",
                        display: "block",
                      }}
                    >
                      Add colors to automatically calculate total quantity
                    </small>
                  ) : null}
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
                    Purchase Price
                  </label>
                  {!isPurchasePriceUnlocked ? (
                    <div
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "2px solid #d1d5db",
                        borderRadius: "0.375rem",
                        backgroundColor: "#f9fafb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setShowPurchasePriceDialog(true)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#3b82f6";
                        e.currentTarget.style.backgroundColor = "#eff6ff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#d1d5db";
                        e.currentTarget.style.backgroundColor = "#f9fafb";
                      }}
                    >
                      <span style={{ fontSize: "1.25rem" }}>🔒</span>
                      <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                        Click to unlock with security key
                      </span>
                    </div>
                  ) : (
                  <input
                    type="number"
                    value={editingEntry?.purchasePrice || ""}
                    onChange={(e) =>
                      {
                        const nextVal = e.target.value;
                        setEditingEntry({
                          ...editingEntry,
                          purchasePrice: nextVal,
                        });
                        // In color-tracking mode, purchase price is stored per-color
                        // (Spare.colorQuantity[].purchasePrice). Keep them in sync.
                        if (isColorTrackingEnabled && Array.isArray(editEntryColors) && editEntryColors.length > 0) {
                          setEditEntryColors((prev) =>
                            prev.map((cq) => ({
                              ...cq,
                              purchasePrice: nextVal,
                            }))
                          );
                        }
                      }
                    }
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      backgroundColor: "#ffffff",
                    }}
                    placeholder="Enter purchase price"
                    min="0"
                    step="0.01"
                    required
                    onWheel={(e) => e.target.blur()}
                  />
                  )}
                </div>

                <div
                  style={{
                    display: "none",
                  }}
                ></div>

                {(editEntryColors.length > 0 || isColorTrackingEnabled) && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                        color: "#374151",
                      }}
                    >
                      Color Quantities
                    </label>

                    {/* Current Edit Entry Colors - Already Added */}
                    <div style={{ marginBottom: "1rem" }}>
                      {editEntryColors.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#6b7280",
                              fontWeight: "500",
                              marginBottom: "0.25rem",
                            }}
                          >
                            Current Colors:
                          </div>
                          {editEntryColors.map((cq, index) => {
                            const rawColor = String(cq.color || "");
                            const normalizedColor = rawColor.toLowerCase().trim();

                            // Use colorOptions only for a friendly label
                            const labelOption = colorOptions.find(
                              (c) =>
                                c.value === normalizedColor ||
                                c.label.toLowerCase() === normalizedColor
                            );

                            const displayColor = labelOption ? labelOption.label : rawColor;
                            return (
                              <div
                              key={index}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                  gap: "0.75rem",
                                  padding: "0.5rem",
                                  backgroundColor: "#f3f4f6",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "0.375rem",
                                }}
                              >
                                <div
                                  style={{
                                    width: "24px",
                                    height: "24px",
                                    borderRadius: "50%",
                                    position: "relative",
                                    overflow: "hidden",
                                    flexShrink: 0,
                                    border:
                                      normalizedColor === "white" &&
                                      normalizedColor !== "white-black"
                                        ? "1px solid #d1d5db"
                                        : "none",
                                  }}
                                >
                                  {normalizedColor === "white-black" ? (
                                    <>
                                      <div
                                        style={{
                                          position: "absolute",
                                          left: 0,
                                          top: 0,
                                          width: "50%",
                                          height: "100%",
                                          backgroundColor: "#FFFFFF",
                                        }}
                                      />
                                      <div
                                        style={{
                                          position: "absolute",
                                          right: 0,
                                          top: 0,
                                          width: "50%",
                                          height: "100%",
                                          backgroundColor: "#000000",
                                        }}
                                      />
                                    </>
                                  ) : (
                                    <div
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        // For all non-gradient colors, rely on getColourDisplay
                                        backgroundColor: getColourDisplay(
                                          normalizedColor
                                        ),
                                      }}
                                    />
                                  )}
                                </div>
                                <span
                                  style={{
                                    flex: 1,
                                    color: "#374151",
                                    fontWeight: "500",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  {displayColor} - Quantity: {cq.quantity}
                                  {cq.minStockLevel > 0 && (
                                    <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>
                                      (Min: {cq.minStockLevel})
                                    </span>
                                  )}
                                  {cq.purchasePrice > 0 && (
                                    <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>
                                      {isPurchasePriceUnlocked ? (
                                        <span>
                                          (₹{cq.purchasePrice.toLocaleString("en-IN", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })})
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowPurchasePriceDialog(true);
                                          }}
                                          style={{
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                gap: "0.25rem",
                                            backgroundColor: "#fee2e2",
                                            border: "1px solid #fecaca",
                                            borderRadius: "0.25rem",
                                            padding: "0.125rem 0.375rem",
                                            fontSize: "0.75rem",
                                            color: "#dc2626",
                                            fontWeight: "500",
                                          }}
                                          title="Click to unlock with security key"
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = "#fecaca";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = "#fee2e2";
                                          }}
                                        >
                                          🔒
                                        </button>
                                      )}
                                    </span>
                                  )}
                                </span>
                              <button
                                type="button"
                                onClick={() => removeEditEntryColor(cq.color)}
                                style={{
                                    backgroundColor: "#fee2e2",
                                    color: "#dc2626",
                                    border: "1px solid #fecaca",
                                  borderRadius: "0.25rem",
                                  cursor: "pointer",
                                    padding: "0.25rem 0.5rem",
                                  fontSize: "0.875rem",
                                    fontWeight: "500",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  transition: "background-color 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#fecaca";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "#fee2e2";
                                }}
                                  title="Remove color"
                              >
                                ×
                              </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{ color: "#6b7280", fontStyle: "italic", fontSize: "0.875rem" }}>
                          No colors added yet. Add colors below.
                        </p>
                      )}
                    </div>

                    {/* Add Color Quantity */}
                    <div style={{ marginTop: "1rem" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontSize: "0.875rem",
                          fontWeight: "500",
                          color: "#374151",
                        }}
                      >
                        Add New Color, Quantity & Min Stock Level
                      </label>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 1fr auto",
                          gap: "0.5rem",
                          alignItems: "flex-start",
                        }}
                      >
                    <div>
                          <label
                            style={{
                              fontSize: "0.75rem",
                              marginBottom: "0.25rem",
                              display: "block",
                              color: "#6b7280",
                            }}
                          >
                            Color
                          </label>
                          <select
                            value={newEditColor}
                            onChange={(e) => handleNewEditColorChange(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.375rem",
                              fontSize: "0.875rem",
                              backgroundColor: "#ffffff",
                            }}
                          >
                            <option value="">Select color</option>
                            {colorOptions.map((color) => {
                              // Check if this color is already in editEntryColors
                              // Compare both by value and by label (case-insensitive)
                              const isAlreadySelected = editEntryColors.some(
                                (cq) => {
                                  const storedColor = (cq.color || "").toLowerCase();
                                  const optionValue = color.value.toLowerCase();
                                  const optionLabel = color.label.toLowerCase();
                                  return storedColor === optionValue || storedColor === optionLabel;
                                }
                              );
                              return (
                                <option
                                  key={color.value}
                                  value={color.value}
                                  disabled={isAlreadySelected}
                                >
                                  {color.label}{" "}
                                  {isAlreadySelected ? "(already added)" : ""}
                                </option>
                              );
                            })}
                            <option
                              value="other"
                              disabled={false}
                            >
                              Other (specify)
                            </option>
                          </select>
                          {/* Color Preview */}
                      <div
                        style={{
                              width: "100%",
                              height: "40px",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.375rem",
                          display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              position: "relative",
                              overflow: "hidden",
                              backgroundColor: "#f5f5f5",
                              marginTop: "0.5rem",
                            }}
                          >
                            {newEditColor === "white-black" ? (
                              <>
                                <div
                                  style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    width: "50%",
                                    height: "100%",
                                    backgroundColor: "#FFFFFF",
                                  }}
                                />
                                <div
                                  style={{
                                    position: "absolute",
                                    right: 0,
                                    top: 0,
                                    width: "50%",
                                    height: "100%",
                                    backgroundColor: "#000000",
                                  }}
                                />
                                <span
                                  style={{
                                    position: "relative",
                                    zIndex: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "100%",
                                    height: "100%",
                                  }}
                                >
                                  <span
                                    style={{
                                      position: "absolute",
                                      left: "25%",
                                      color: "#000",
                                      fontWeight: "bold",
                                      fontSize: "14px",
                                    }}
                                  >
                                    W
                                  </span>
                                  <span
                                    style={{
                                      position: "absolute",
                                      right: "25%",
                                      color: "#fff",
                                      fontWeight: "bold",
                                      fontSize: "14px",
                        }}
                      >
                                    B
                                  </span>
                                </span>
                              </>
                            ) : (
                              <>
                                <div
                                  style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    width: "100%",
                                    height: "100%",
                                    backgroundColor:
                                      newEditColor === "other" || !newEditColor
                                        ? "#f5f5f5"
                                        : getColourDisplay(newEditColor),
                                  }}
                                />
                                <span
                                  style={{
                                    position: "relative",
                                    zIndex: 1,
                                    color:
                                      newEditColor === "white" ||
                                      newEditColor === "yellow"
                                        ? "#000"
                                        : newEditColor && newEditColor !== "other"
                                        ? "#fff"
                                        : "#666",
                                  }}
                                >
                                  {newEditColor && newEditColor !== "other"
                                    ? colorOptions.find(
                                        (c) => c.value === newEditColor
                                      )?.label
                                    : newEditColor === "other"
                                    ? "Custom"
                                    : "No color"}
                                </span>
                              </>
                            )}
                          </div>
                          {newEditColor === "other" && (
                          <input
                            type="text"
                              placeholder="Enter custom color name"
                              value={newEditColorCustom}
                              onChange={(e) => setNewEditColorCustom(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.375rem",
                                fontSize: "0.875rem",
                                marginTop: "0.5rem",
                              backgroundColor: "#ffffff",
                            }}
                          />
                          )}
                        </div>
                        <div>
                          <label
                            style={{
                              fontSize: "0.75rem",
                              marginBottom: "0.25rem",
                              display: "block",
                              color: "#6b7280",
                            }}
                          >
                            Quantity
                          </label>
                          <input
                            type="number"
                            value={newEditColorQuantity}
                            onChange={(e) =>
                              setNewEditColorQuantity(e.target.value)
                            }
                            placeholder="Quantity"
                            min="0"
                            onKeyPress={(e) =>
                              e.key === "Enter" && addEditEntryColor()
                            }
                            onWheel={(e) => e.target.blur()}
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.375rem",
                              backgroundColor: "#ffffff",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              fontSize: "0.75rem",
                              marginBottom: "0.25rem",
                              display: "block",
                              color: "#6b7280",
                            }}
                          >
                            Min Stock *
                          </label>
                          <input
                            type="number"
                            value={newEditColorMinStockLevel}
                            onChange={(e) => {
                              setNewEditColorMinStockLevel(e.target.value);
                              setIsNewEditMinStockAuto(false);
                            }}
                            placeholder="Min level"
                            min="0"
                            onKeyPress={(e) =>
                              e.key === "Enter" && addEditEntryColor()
                            }
                            onWheel={(e) => e.target.blur()}
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.375rem",
                              backgroundColor: "#ffffff",
                            }}
                          />
                          {isNewEditMinStockAuto &&
                            String(newEditColorMinStockLevel || "").trim() !== "" && (
                              <div
                                style={{
                                  marginTop: "0.35rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                  padding: "0.15rem 0.5rem",
                                  borderRadius: "999px",
                                  backgroundColor: "#fef3c7",
                                  border: "1px solid #facc15",
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  color: "#92400e",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "999px",
                                    backgroundColor: "#f97316",
                                  }}
                                />
                                default min. stock quantity
                        </div>
                            )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-start",
                          }}
                        >
                          <div style={{ height: "21px" }}></div>
                        <button
                          type="button"
                          onClick={addEditEntryColor}
                          disabled={
                            !newEditColor.trim() ||
                            newEditColorQuantity === "" ||
                            newEditColorQuantity === null ||
                            newEditColorQuantity === undefined ||
                            !newEditColorMinStockLevel.trim() ||
                            parseInt(newEditColorQuantity) < 0 ||
                            parseInt(newEditColorMinStockLevel) < 0 ||
                            (newEditColor === "other" && !newEditColorCustom.trim())
                          }
                          style={{
                            padding: "0.5rem 1rem",
                            backgroundColor:
                              newEditColor.trim() &&
                              (newEditColorQuantity || "").toString().trim() &&
                                newEditColorMinStockLevel.trim() &&
                                parseInt(newEditColorQuantity) >= 0 &&
                                parseInt(newEditColorMinStockLevel) >= 0 &&
                                (newEditColor !== "other" || newEditColorCustom.trim())
                                ? "#10b981"
                                : "#9ca3af",
                            color: "white",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor:
                              newEditColor.trim() &&
                              (newEditColorQuantity || "").toString().trim() &&
                                newEditColorMinStockLevel.trim() &&
                                parseInt(newEditColorQuantity) >= 0 &&
                                parseInt(newEditColorMinStockLevel) >= 0 &&
                                (newEditColor !== "other" || newEditColorCustom.trim())
                                ? "pointer"
                                : "not-allowed",
                              fontSize: "0.875rem",
                              fontWeight: "500",
                              whiteSpace: "nowrap",
                          }}
                        >
                          Add
                        </button>
                        </div>
                      </div>
                      <small
                        style={{
                          color: "#6b7280",
                          fontSize: "0.875rem",
                          marginTop: "0.25rem",
                          display: "block",
                        }}
                      >
                        Add color-specific quantities for this stock entry
                      </small>
                      {((newEditColor || "").trim() ||
                        (newEditColorCustom || "").trim() ||
                        (newEditColorQuantity || "").trim() ||
                        (newEditColorMinStockLevel || "").trim()) && (
                        <div
                          style={{
                            marginTop: "0.5rem",
                            padding: "0.5rem 0.75rem",
                            backgroundColor: "#FEF3C7",
                            color: "#92400E",
                            border: "1px solid #FCD34D",
                            borderRadius: "0.375rem",
                            fontSize: "0.875rem",
                          }}
                        >
                          Color and quantity inputs changed. Click Add to save.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
                    Purchase Date
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={
                        editingEntry?.purchaseDate || formatDate(new Date())
                      }
                      onChange={(e) =>
                        setEditingEntry({
                          ...editingEntry,
                          purchaseDate: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                        backgroundColor: "#ffffff",
                        paddingRight: "3rem",
                      }}
                      placeholder="dd/mm/yyyy"
                      maxLength="10"
                      required
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        cursor: "pointer",
                      }}
                      onClick={() => setShowEditDatePicker(!showEditDatePicker)}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#6b7280"
                        strokeWidth="2"
                      >
                        <rect
                          x="3"
                          y="4"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        ></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      {showEditDatePicker && (
                        <div
                          id="edit-date-picker-calendar"
                          style={{
                            position: "absolute",
                            top: "100%",
                            right: "0",
                            marginTop: "0.5rem",
                            backgroundColor: "white",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.5rem",
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                            padding: "1rem",
                            zIndex: 1000,
                            minWidth: "280px",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "1rem",
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                previousMonth();
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "0.25rem",
                                borderRadius: "0.25rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "#f3f4f6";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#6b7280"
                                strokeWidth="2"
                              >
                                <polyline points="15 18 9 12 15 6"></polyline>
                              </svg>
                            </button>
                            <div
                              style={{
                                fontSize: "0.875rem",
                                fontWeight: "600",
                                color: "#374151",
                              }}
                            >
                              {formatMonthName(currentMonth)}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                nextMonth();
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "0.25rem",
                                borderRadius: "0.25rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "#f3f4f6";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#6b7280"
                                strokeWidth="2"
                              >
                                <polyline points="9 18 15 12 9 6"></polyline>
                              </svg>
                            </button>
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(7, 1fr)",
                              gap: "0.25rem",
                              marginBottom: "0.5rem",
                            }}
                          >
                            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(
                              (day) => (
                                <div
                                  key={day}
                                  style={{
                                    textAlign: "center",
                                    fontSize: "0.75rem",
                                    fontWeight: "600",
                                    color: "#6b7280",
                                    padding: "0.25rem",
                                  }}
                                >
                                  {day}
                                </div>
                              )
                            )}
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(7, 1fr)",
                              gap: "0.25rem",
                            }}
                          >
                            {Array.from({ length: 35 }, (_, i) => {
                              const date = new Date(currentMonth);
                              date.setDate(1);
                              const firstDay = date.getDay();
                              const daysInMonth = new Date(
                                date.getFullYear(),
                                date.getMonth() + 1,
                                0
                              ).getDate();
                              const dayNumber = i - firstDay + 1;
                              const isValidDay =
                                dayNumber > 0 && dayNumber <= daysInMonth;
                              if (!isValidDay)
                                return (
                                  <div
                                    key={i}
                                    style={{ padding: "0.5rem" }}
                                  ></div>
                                );
                              const currentDate = new Date(
                                date.getFullYear(),
                                date.getMonth(),
                                dayNumber
                              );
                              const currentDateString = `${String(
                                dayNumber
                              ).padStart(2, "0")}/${String(
                                date.getMonth() + 1
                              ).padStart(2, "0")}/${date.getFullYear()}`;
                              const isSelected =
                                currentDateString ===
                                (editingEntry?.purchaseDate || "");
                              const isToday =
                                currentDateString === displayDate(new Date());
                              const isFuture =
                                currentDate > new Date().setHours(0, 0, 0, 0);
                              return (
                                <div
                                  key={i}
                                  onClick={() =>
                                    !isFuture &&
                                    handleEditDateSelect(currentDate)
                                  }
                                  style={{
                                    padding: "0.5rem",
                                    textAlign: "center",
                                    cursor: isFuture
                                      ? "not-allowed"
                                      : "pointer",
                                    borderRadius: "0.25rem",
                                    backgroundColor: isSelected
                                      ? "#3b82f6"
                                      : isToday
                                      ? "#f3f4f6"
                                      : isFuture
                                      ? "#f9fafb"
                                      : "transparent",
                                    color: isSelected
                                      ? "white"
                                      : isToday
                                      ? "#1f2937"
                                      : isFuture
                                      ? "#d1d5db"
                                      : "#374151",
                                    fontSize: "0.875rem",
                                    fontWeight: isToday ? "600" : "400",
                                    border:
                                      isToday && !isSelected
                                        ? "1px solid #d1d5db"
                                        : "none",
                                    opacity: isFuture ? 0.5 : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected && !isFuture) {
                                      e.currentTarget.style.backgroundColor =
                                        isToday ? "#e5e7eb" : "#f3f4f6";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected && !isFuture) {
                                      e.currentTarget.style.backgroundColor =
                                        isToday ? "#f3f4f6" : "transparent";
                                    }
                                  }}
                                >
                                  {dayNumber}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#6b7280",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: isSubmitting ? "#9ca3af" : "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={{ marginBottom: "2rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
              paddingBottom: "0.75rem",
              borderBottom: "2px solid #e5e7eb",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: "#1f2937",
                fontSize: "1.25rem",
                fontWeight: "600",
              }}
            >
              {isColorTrackingEnabled
                ? "Color Quantities"
                : "All Stock Entries"}
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                color: "#6b7280",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: isColorTrackingEnabled
                    ? spare?.colorQuantity?.length > 0
                      ? "#10b981"
                      : "#f59e0b"
                    : spare?.[stockField]?.length > 0
                    ? "#10b981"
                    : "#f59e0b",
                }}
              ></div>
              {isColorTrackingEnabled
                ? `${
                    spare?.colorQuantity
                      ? new Set(
                          spare.colorQuantity.map((cq) =>
                            (cq.color || "").toLowerCase().trim()
                          )
                        ).size
                      : 0
                  } colors`
                : `${spare?.[stockField]?.length || 0} entries`}
            </div>
          </div>

          {isColorTrackingEnabled ? (
            // Show color quantities when color tracking is enabled
            spare?.colorQuantity &&
            Array.isArray(spare.colorQuantity) &&
            spare.colorQuantity.length > 0 ? (
              <div
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  overflowX: "auto",
                  overflowY: "hidden",
                }}
              >
                <div style={{ padding: "1rem" }}>
                  {groupColorsByDate(spare?.colorQuantity || []).map(
                    (group, groupIndex) => {
                      const dateKey = group.date || "";
                      const activeIndex =
                        activeColorByDate[dateKey] !== undefined
                          ? activeColorByDate[dateKey]
                          : 0;
                      const activeColor =
                        group.colors[activeIndex] || group.colors[0];
                      const firstColor = group.colors[0];
                      const purchasePrice = firstColor?.purchasePrice || 0;
                      return (
                        <div key={groupIndex} style={{ marginBottom: "1rem" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: "0.5rem",
                            }}
                          >
                          <div
                            style={{
                              fontSize: "0.875rem",
                              color: "#374151",
                              fontWeight: 600,
                            }}
                          >
                            {group.date || "No Date"}
                            </div>
                            <button
                              id={`edit-btn-${groupIndex}`}
                              onClick={() => {
                                setClickedButtonId(`edit-btn-${groupIndex}`);
                                // Create entry object from group data
                                const entry = {
                                  purchaseDate: group.date || formatDate(new Date()),
                                  purchasePrice: purchasePrice || 0,
                                  colorQuantities: group.colors.map(cq => ({
                                    color: cq.color || "",
                                    quantity: cq.quantity || "",
                                    minStockLevel: cq.minStockLevel || "",
                                    customColor: cq.customColor || "",
                                  })),
                                };
                                handleEditEntry(groupIndex, entry);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                padding: "0.375rem 0.75rem",
                                backgroundColor: "#3b82f6",
                                color: "white",
                                border: "none",
                                borderRadius: "0.375rem",
                                fontSize: "0.75rem",
                                fontWeight: "500",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                transform:
                                  clickedButtonId === `edit-btn-${groupIndex}`
                                    ? "scale(0.95)"
                                    : "scale(1)",
                                boxShadow:
                                  clickedButtonId === `edit-btn-${groupIndex}`
                                    ? "0 2px 8px rgba(59, 130, 246, 0.4)"
                                    : "0 1px 3px rgba(0, 0, 0, 0.1)",
                              }}
                              onMouseEnter={(e) => {
                                if (clickedButtonId !== `edit-btn-${groupIndex}`) {
                                  e.currentTarget.style.backgroundColor = "#2563eb";
                                  e.currentTarget.style.transform = "scale(1.05)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (clickedButtonId !== `edit-btn-${groupIndex}`) {
                                  e.currentTarget.style.backgroundColor = "#3b82f6";
                                  e.currentTarget.style.transform = "scale(1)";
                                }
                              }}
                              title="Edit this stock entry"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                              Edit
                            </button>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              backgroundColor: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: "0.5rem",
                              overflowX: "auto",
                              overflowY: "hidden",
                              padding: "0.25rem",
                              gap: "0.25rem",
                              flexWrap: "nowrap",
                              WebkitOverflowScrolling: "touch",
                            }}
                          >
                            {group.colors.map((colorQty, i) => {
                              const keyColor = String(
                                colorQty.color || ""
                              ).toLowerCase();
                              const swatch =
                                keyColor === "red"
                                  ? "#dc2626"
                                  : keyColor === "blue"
                                  ? "#2563eb"
                                  : keyColor === "green"
                                  ? "#16a34a"
                                  : keyColor === "yellow"
                                  ? "#ca8a04"
                                  : keyColor === "black"
                                  ? "#000000"
                                  : keyColor === "white"
                                  ? "#ffffff"
                                  : keyColor === "orange"
                                  ? "#ea580c"
                                  : keyColor === "purple"
                                  ? "#9333ea"
                                  : keyColor === "pink"
                                  ? "#ec4899"
                                  : keyColor === "gray" || keyColor === "grey"
                                  ? "#6b7280"
                                  : keyColor === "brown"
                                  ? "#92400e"
                                  : keyColor === "silver"
                                  ? "#94a3b8"
                                  : keyColor === "gold"
                                  ? "#eab308"
                                  : "#6b7280";
                              const selected = i === activeIndex;
                              // Find the actual index in colorQuantity array
                              const actualIndex =
                                spare?.colorQuantity?.findIndex(
                                  (cq) =>
                                    cq.color === colorQty.color &&
                                    displayDate(cq.purchaseDate) === group.date
                                );
                              const isEditing =
                                editingColorIndex !== null &&
                                editingColorIndex === actualIndex;
                              return (
                                <button
                                  key={`${keyColor}-${i}`}
                                  onClick={() =>
                                    setActiveColorByDate((prev) => ({
                                      ...prev,
                                      [dateKey]: i,
                                    }))
                                  }
                                  style={{
                                    flex: "0 0 auto",
                                    minWidth: "9.5rem",
                                    padding: "0.75rem 1rem",
                                    backgroundColor: selected
                                      ? "#3b82f6"
                                      : "transparent",
                                    color: selected ? "white" : "#64748b",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: "0.875rem",
                                    fontWeight: selected ? "600" : "500",
                                    transition: "all 0.2s ease",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "0.5rem",
                                    borderRadius: "0.375rem",
                                    position: "relative",
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!selected)
                                      e.currentTarget.style.backgroundColor =
                                        "#f1f5f9";
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!selected)
                                      e.currentTarget.style.backgroundColor =
                                        "transparent";
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.5rem",
                                      flex: 1,
                                      minWidth: 0,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: "0.75rem",
                                      height: "0.75rem",
                                      borderRadius: "0.25rem",
                                      backgroundColor: swatch,
                                      border:
                                        keyColor === "white"
                                          ? "1px solid #d1d5db"
                                          : "none",
                                        flexShrink: 0,
                                    }}
                                  />
                                    <span
                                      style={{ textTransform: "capitalize" }}
                                    >
                                    {colorQty.color}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "0.7rem",
                                      opacity: 0.85,
                                      textAlign: "left",
                                    }}
                                  >
                                    ({spareLayerPurchasedQty(colorQty)} bought,{" "}
                                    {spareLayerLeftQty(colorQty)} left)
                                  </span>
                                  </div>
                                  {selected &&
                                    actualIndex !== undefined &&
                                    actualIndex !== -1 && (
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: "0.25rem",
                                          flexShrink: 0,
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditColorEntry(actualIndex);
                                          }}
                                          style={{
                                            padding: "0.375rem",
                                            backgroundColor:
                                              "rgba(255, 255, 255, 0.2)",
                                            color: "#ffffff",
                                            border:
                                              "1px solid rgba(255, 255, 255, 0.3)",
                                            borderRadius: "0.25rem",
                                            cursor: "pointer",
                                            fontSize: "0.75rem",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: "28px",
                                            height: "28px",
                                            transition: "all 0.2s ease",
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor =
                                              "rgba(255, 255, 255, 0.3)";
                                            e.currentTarget.style.transform =
                                              "scale(1.1)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor =
                                              "rgba(255, 255, 255, 0.2)";
                                            e.currentTarget.style.transform =
                                              "scale(1)";
                                          }}
                                          title="Edit color entry"
                                        >
                                          <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                          </svg>
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteColorEntry(actualIndex);
                                          }}
                                          style={{
                                            padding: "0.375rem",
                                            backgroundColor:
                                              "rgba(255, 255, 255, 0.2)",
                                            color: "#ffffff",
                                            border:
                                              "1px solid rgba(255, 255, 255, 0.3)",
                                            borderRadius: "0.25rem",
                                            cursor: "pointer",
                                            fontSize: "0.75rem",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: "28px",
                                            height: "28px",
                                            transition: "all 0.2s ease",
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor =
                                              "rgba(255, 255, 255, 0.3)";
                                            e.currentTarget.style.transform =
                                              "scale(1.1)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor =
                                              "rgba(255, 255, 255, 0.2)";
                                            e.currentTarget.style.transform =
                                              "scale(1)";
                                          }}
                                          title="Delete color entry"
                                        >
                                          <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            <line
                                              x1="10"
                                              y1="11"
                                              x2="10"
                                              y2="17"
                                            ></line>
                                            <line
                                              x1="14"
                                              y1="11"
                                              x2="14"
                                              y2="17"
                                            ></line>
                                          </svg>
                                        </button>
                                      </div>
                                    )}
                                </button>
                              );
                            })}
                          </div>
                          {activeColor && (
                            <div
                              style={{
                                padding: "1rem",
                                border: "1px solid #e2e8f0",
                                borderTop: "none",
                                borderRadius: "0 0 0.5rem 0.5rem",
                                background: "white",
                              }}
                            >
                              {editingColorIndex !== null &&
                              spare?.colorQuantity?.[editingColorIndex] &&
                              displayDate(
                                spare.colorQuantity[editingColorIndex]
                                  .purchaseDate
                              ) === group.date &&
                              spare.colorQuantity[editingColorIndex].color ===
                                activeColor.color ? (
                                <form onSubmit={handleSaveColorEntry}>
                                  {(formError || formWarning) && (
                                    <div
                                      style={{
                                        marginBottom: "1rem",
                                        padding: "0.75rem",
                                        backgroundColor: formWarning
                                          ? "#FEF3C7"
                                          : "#fee2e2",
                                        color: formWarning
                                          ? "#92400E"
                                          : "#dc2626",
                                        borderRadius: "0.375rem",
                                        border: formWarning
                                          ? "1px solid #FCD34D"
                                          : "1px solid #fecaca",
                                      }}
                                    >
                                      {formWarning || formError}
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns:
                                        "repeat(auto-fit, minmax(180px, 1fr))",
                                      gap: "1rem",
                                      marginBottom: "1rem",
                                    }}
                                  >
                                    <div>
                                      <label
                                        style={{
                                          display: "block",
                                          marginBottom: "0.5rem",
                                          color: "#374151",
                                          fontWeight: "500",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Color *
                                      </label>
                                      <input
                                        type="text"
                                        value={editingColorEntry?.color || ""}
                                        onChange={(e) =>
                                          setEditingColorEntry((prev) => ({
                                            ...prev,
                                            color: e.target.value,
                                          }))
                                        }
                                        required
                                        style={{
                                          width: "100%",
                                          padding: "0.5rem",
                                          border: "1px solid #d1d5db",
                                          borderRadius: "0.375rem",
                                          fontSize: "0.875rem",
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <label
                                        style={{
                                          display: "block",
                                          marginBottom: "0.5rem",
                                          color: "#374151",
                                          fontWeight: "500",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Purchased (this color) *
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={
                                          editingColorEntry?.originalQuantity ??
                                          ""
                                        }
                                        onChange={(e) =>
                                          setEditingColorEntry((prev) => ({
                                            ...prev,
                                            originalQuantity: e.target.value,
                                          }))
                                        }
                                        required
                                        style={{
                                          width: "100%",
                                          padding: "0.5rem",
                                          border: "1px solid #d1d5db",
                                          borderRadius: "0.375rem",
                                          fontSize: "0.875rem",
                                        }}
                                        onWheel={(e) => e.target.blur()}
                                      />
                                      <small
                                        style={{
                                          color: "#6b7280",
                                          fontSize: "0.72rem",
                                          marginTop: "0.2rem",
                                          display: "block",
                                          lineHeight: 1.35,
                                        }}
                                      >
                                        Record of units bought for this color
                                        batch; quantity left still tracks stock
                                        after sales.
                                      </small>
                                    </div>
                                    <div>
                                      <label
                                        style={{
                                          display: "block",
                                          marginBottom: "0.5rem",
                                          color: "#374151",
                                          fontWeight: "500",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Quantity left (this color) *
                                      </label>
                                      <input
                                        type="number"
                                        value={
                                          editingColorEntry?.quantity || ""
                                        }
                                        onChange={(e) =>
                                          setEditingColorEntry((prev) => ({
                                            ...prev,
                                            quantity: e.target.value,
                                          }))
                                        }
                                        required
                                        min="0"
                                        style={{
                                          width: "100%",
                                          padding: "0.5rem",
                                          border: "1px solid #d1d5db",
                                          borderRadius: "0.375rem",
                                          fontSize: "0.875rem",
                                        }}
                                        onWheel={(e) => e.target.blur()}
                                      />
                                    </div>
                                    <div>
                                      <label
                                        style={{
                                          display: "block",
                                          marginBottom: "0.5rem",
                                          color: "#374151",
                                          fontWeight: "500",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Purchase Price
                                      </label>
                                      {!isPurchasePriceUnlocked ? (
                                        <div
                                          style={{
                                            width: "100%",
                                            padding: "0.75rem",
                                            border: "2px solid #d1d5db",
                                            borderRadius: "0.375rem",
                                            backgroundColor: "#f9fafb",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "0.5rem",
                                            cursor: "pointer",
                                            transition: "all 0.2s ease",
                                          }}
                                          onClick={() => setShowPurchasePriceDialog(true)}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = "#3b82f6";
                                            e.currentTarget.style.backgroundColor = "#eff6ff";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = "#d1d5db";
                                            e.currentTarget.style.backgroundColor = "#f9fafb";
                                          }}
                                        >
                                          <span style={{ fontSize: "1.25rem" }}>🔒</span>
                                          <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                                            Click to unlock with security key
                                          </span>
                                        </div>
                                      ) : (
                                      <input
                                        type="number"
                                        value={
                                          editingColorEntry?.purchasePrice || ""
                                        }
                                        onChange={(e) =>
                                          setEditingColorEntry((prev) => ({
                                            ...prev,
                                            purchasePrice: e.target.value,
                                          }))
                                        }
                                        required
                                        min="0"
                                        step="0.01"
                                          onWheel={(e) => e.target.blur()}
                                        style={{
                                          width: "100%",
                                          padding: "0.5rem",
                                          border: "1px solid #d1d5db",
                                          borderRadius: "0.375rem",
                                          fontSize: "0.875rem",
                                            backgroundColor: "#ffffff",
                                        }}
                                      />
                                      )}
                                    </div>
                                    <div>
                                      <label
                                        style={{
                                          display: "block",
                                          marginBottom: "0.5rem",
                                          color: "#374151",
                                          fontWeight: "500",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Min Stock Level
                                      </label>
                                      <input
                                        type="number"
                                        value={
                                          editingColorEntry?.minStockLevel || ""
                                        }
                                        onChange={(e) =>
                                          setEditingColorEntry((prev) => ({
                                            ...prev,
                                            minStockLevel: e.target.value,
                                          }))
                                        }
                                        min="0"
                                        style={{
                                          width: "100%",
                                          padding: "0.5rem",
                                          border: "1px solid #d1d5db",
                                          borderRadius: "0.375rem",
                                          fontSize: "0.875rem",
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "0.5rem",
                                      justifyContent: "flex-end",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={handleCancelEditColor}
                                      style={{
                                        padding: "0.5rem 1rem",
                                        backgroundColor: "#6b7280",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "0.375rem",
                                        cursor: "pointer",
                                        fontSize: "0.875rem",
                                        fontWeight: "500",
                                      }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="submit"
                                      style={{
                                        padding: "0.5rem 1rem",
                                        backgroundColor: "#3b82f6",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "0.375rem",
                                        cursor: "pointer",
                                        fontSize: "0.875rem",
                                        fontWeight: "500",
                                      }}
                                    >
                                      Save Changes
                                    </button>
                                  </div>
                                </form>
                              ) : (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(2, 1fr)",
                                  gap: "0.5rem",
                                }}
                              >
                                <div style={{ gridColumn: "1 / -1" }}>
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#64748b",
                                      marginBottom: "0.35rem",
                                    }}
                                  >
                                    Quantity
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "1rem",
                                      fontWeight: 600,
                                      fontSize: "0.9rem",
                                    }}
                                  >
                                    <span>
                                      Purchased:{" "}
                                      <strong>
                                        {spareLayerPurchasedQty(activeColor)}
                                      </strong>{" "}
                                      pcs
                                    </span>
                                    <span style={{ color: "#0f766e" }}>
                                      Left:{" "}
                                      <strong>
                                        {spareLayerLeftQty(activeColor)}
                                      </strong>{" "}
                                      pcs
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#64748b",
                                    }}
                                  >
                                    Purchase Price
                                  </div>
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      color: "#059669",
                                    }}
                                  >
                                    {isPurchasePriceUnlocked ? (
                                      <>
                                        ₹
                                    {parseFloat(
                                      activeColor.purchasePrice || 0
                                        ).toLocaleString("en-IN", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setShowPurchasePriceDialog(true)}
                                        style={{
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: "0.5rem",
                                          backgroundColor: "#fee2e2",
                                          border: "1px solid #fecaca",
                                          borderRadius: "0.375rem",
                                          padding: "0.5rem 1rem",
                                          fontSize: "0.875rem",
                                          color: "#dc2626",
                                          fontWeight: "500",
                                          transition: "background-color 0.2s",
                                        }}
                                        title="Click to unlock with security key"
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = "#fecaca";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = "#fee2e2";
                                        }}
                                      >
                                        🔒 Click to unlock
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {activeColor.minStockLevel !== undefined &&
                                  activeColor.minStockLevel !== null && (
                                    <div>
                                      <div
                                        style={{
                                          fontSize: "0.75rem",
                                          color: "#64748b",
                                        }}
                                      >
                                        Min Stock
                                      </div>
                                      <div style={{ fontWeight: 700 }}>
                                        {activeColor.minStockLevel}
                                      </div>
                                    </div>
                                  )}
                                <div>
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#64748b",
                                    }}
                                  >
                                    Total Value
                                  </div>
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      color: "#059669",
                                    }}
                                  >
                                    {isPurchasePriceUnlocked ? (
                                      <>
                                        ₹
                                    {(
                                      parseFloat(activeColor.quantity || 0) *
                                        parseFloat(
                                          activeColor.purchasePrice || 0
                                        )
                                        ).toLocaleString("en-IN", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setShowPurchasePriceDialog(true)}
                                        style={{
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: "0.5rem",
                                          backgroundColor: "#fee2e2",
                                          border: "1px solid #fecaca",
                                          borderRadius: "0.375rem",
                                          padding: "0.5rem 1rem",
                                          fontSize: "0.875rem",
                                          color: "#dc2626",
                                          fontWeight: "500",
                                          transition: "background-color 0.2s",
                                        }}
                                        title="Click to unlock with security key"
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = "#fecaca";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = "#fee2e2";
                                        }}
                                      >
                                        🔒 Click to unlock
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem 1rem",
                  color: "#6b7280",
                  fontSize: "1rem",
                }}
              >
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    margin: "0 auto 1rem",
                    backgroundColor: "#f3f4f6",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <p style={{ margin: 0, fontWeight: "500" }}>
                  No color quantities found
                </p>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
                  Add color quantities to start tracking stock by color
                </p>
              </div>
            )
          ) : // Show stock entries when color tracking is disabled
          spare?.[stockField] &&
            Array.isArray(spare[stockField]) &&
            spare[stockField].length > 0 ? (
            <div
              style={{
                display: "grid",
                gap: "1rem",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              }}
            >
              {getSortedEntriesWithDefault().map((entry, index) => (
                <div
                  key={index}
                  style={{
                    background:
                      "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    padding: "1.25rem",
                    position: "relative",
                    transition: "all 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  }}
                  onMouseEnter={(e) => {
                    setHoveredEntryIndex(index);
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(0, 0, 0, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    setHoveredEntryIndex(null);
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 1px 3px rgba(0, 0, 0, 0.05)";
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "0.75rem",
                      right: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        background: "#3b82f6",
                        color: "white",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "0.375rem",
                      }}
                    >
                      #{index + 1}
                    </div>

                    {hoveredEntryIndex === index && (
                      <button
                        onClick={() => {
                          const originalIndex = getOriginalIndex(index);
                          handleEditEntry(originalIndex, entry);
                        }}
                        style={{
                          background: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "0.375rem",
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#2563eb";
                          e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#3b82f6";
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        title="Edit this stock entry"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                      </button>
                    )}
                    {hoveredEntryIndex === index && (
                      <button
                        onClick={() => {
                          const originalIndex = getOriginalIndex(index);
                          handleDeleteStockEntry(originalIndex);
                        }}
                        style={{
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "0.375rem",
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#dc2626";
                          e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#ef4444";
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        title="Delete stock entry"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Quantity
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.75rem",
                        alignItems: "start",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "#64748b",
                            marginBottom: "0.15rem",
                          }}
                        >
                          Purchased (this entry)
                        </div>
                        <div
                          style={{
                            fontSize: "1.35rem",
                            fontWeight: "700",
                            color: "#334155",
                          }}
                        >
                          {spareLayerPurchasedQty(entry)}
                          <span
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: "400",
                              color: "#64748b",
                              marginLeft: "0.2rem",
                            }}
                          >
                            pcs
                          </span>
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "#64748b",
                            marginBottom: "0.15rem",
                          }}
                        >
                          Left now
                        </div>
                        <div
                          style={{
                            fontSize: "1.35rem",
                            fontWeight: "700",
                            color: "#0f766e",
                          }}
                        >
                          {spareLayerLeftQty(entry)}
                          <span
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: "400",
                              color: "#64748b",
                              marginLeft: "0.2rem",
                            }}
                          >
                            pcs
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isColorTrackingEnabled &&
                  Array.isArray(entry.colorQuantities) &&
                  entry.colorQuantities.length > 0 ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Colors
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                          alignItems: "center",
                        }}
                      >
                        {entry.colorQuantities.map((cq, i) => {
                          const keyColor = String(cq.color || "").toLowerCase();
                          const colorValue =
                            keyColor === "red"
                              ? "#dc2626"
                              : keyColor === "blue"
                              ? "#2563eb"
                              : keyColor === "green"
                              ? "#16a34a"
                              : keyColor === "yellow"
                              ? "#ca8a04"
                              : keyColor === "black"
                              ? "#000000"
                              : keyColor === "white"
                              ? "#ffffff"
                              : keyColor === "orange"
                              ? "#ea580c"
                              : keyColor === "purple"
                              ? "#9333ea"
                              : keyColor === "pink"
                              ? "#ec4899"
                              : keyColor === "gray" || keyColor === "grey"
                              ? "#6b7280"
                              : keyColor === "brown"
                              ? "#92400e"
                              : keyColor === "silver"
                              ? "#94a3b8"
                              : keyColor === "gold"
                              ? "#eab308"
                              : "#6b7280";
                          return (
                            <span
                              key={`${keyColor}-${i}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.375rem",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.375rem",
                                backgroundColor: "#f1f5f9",
                                color: "#374151",
                                fontSize: "0.875rem",
                                fontWeight: 600,
                              }}
                            >
                              <span
                                style={{
                                  width: "1rem",
                                  height: "1rem",
                                  borderRadius: "0.25rem",
                                  backgroundColor: colorValue,
                                  border:
                                    keyColor === "white"
                                      ? "1px solid #d1d5db"
                                      : "none",
                                }}
                              />
                              <span style={{ textTransform: "capitalize" }}>
                                {cq.color}
                              </span>
                              <span
                                style={{ color: "#64748b", fontWeight: 500 }}
                              >
                                ({parseInt(cq.quantity || 0)})
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    isColorTrackingEnabled &&
                    entry.color && (
                      <div style={{ marginBottom: "1rem" }}>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            marginBottom: "0.25rem",
                          }}
                        >
                          Color
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <div
                            style={{
                              width: "1.25rem",
                              height: "1.25rem",
                              borderRadius: "0.25rem",
                              backgroundColor:
                                entry.color.toLowerCase() === "red"
                                  ? "#dc2626"
                                  : entry.color.toLowerCase() === "blue"
                                  ? "#2563eb"
                                  : entry.color.toLowerCase() === "green"
                                  ? "#16a34a"
                                  : entry.color.toLowerCase() === "yellow"
                                  ? "#ca8a04"
                                  : entry.color.toLowerCase() === "black"
                                  ? "#000000"
                                  : entry.color.toLowerCase() === "white"
                                  ? "#ffffff"
                                  : entry.color.toLowerCase() === "orange"
                                  ? "#ea580c"
                                  : entry.color.toLowerCase() === "purple"
                                  ? "#9333ea"
                                  : entry.color.toLowerCase() === "pink"
                                  ? "#ec4899"
                                  : entry.color.toLowerCase() === "gray" ||
                                    entry.color.toLowerCase() === "grey"
                                  ? "#6b7280"
                                  : entry.color.toLowerCase() === "brown"
                                  ? "#92400e"
                                  : entry.color.toLowerCase() === "silver"
                                  ? "#94a3b8"
                                  : entry.color.toLowerCase() === "gold"
                                  ? "#eab308"
                                  : "#6b7280",
                              border:
                                entry.color.toLowerCase() === "white"
                                  ? "1px solid #d1d5db"
                                  : "none",
                            }}
                          />
                          <div
                            style={{
                              fontSize: "1rem",
                              fontWeight: "600",
                              color: "#374151",
                              textTransform: "capitalize",
                            }}
                          >
                            {entry.color}
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  <div style={{ marginBottom: "1rem" }}>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: "0.25rem",
                      }}
                    >
                      Purchase Price
                    </div>
                    {!isPurchasePriceUnlocked ? (
                      <div
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          border: "2px solid #d1d5db",
                          borderRadius: "0.375rem",
                          backgroundColor: "#f9fafb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onClick={() => setShowPurchasePriceDialog(true)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#3b82f6";
                          e.currentTarget.style.backgroundColor = "#eff6ff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#d1d5db";
                          e.currentTarget.style.backgroundColor = "#f9fafb";
                        }}
                      >
                        <span style={{ fontSize: "1.25rem" }}>🔒</span>
                        <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                          Click to unlock
                        </span>
                      </div>
                    ) : (
                    <div
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: "600",
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                        {parseFloat(entry.purchasePrice || 0) > 0
                          ? "₹" +
                            parseFloat(entry.purchasePrice || 0).toLocaleString(
                              "en-IN",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )
                          : "0"}
                    </div>
                    )}
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: "0.25rem",
                      }}
                    >
                      Purchase Date
                    </div>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        color: "#475569",
                        fontWeight: "500",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect
                          x="3"
                          y="4"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        ></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      {displayDate(entry.purchaseDate)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 2rem",
                background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                borderRadius: "0.75rem",
                border: "1px solid #fbbf24",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  margin: "0 auto 1rem",
                  backgroundColor: "#fbbf24",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <path d="M12 2v20M17 7l-5-5-5 5M17 17l-5 5-5-5" />
                </svg>
              </div>
              <h4
                style={{
                  margin: "0 0 0.5rem",
                  color: "#92400e",
                  fontSize: "1.125rem",
                  fontWeight: "600",
                }}
              >
                No Stock Entries Yet
              </h4>
              <p
                style={{
                  margin: 0,
                  color: "#b45309",
                  fontSize: "0.875rem",
                  lineHeight: "1.5",
                }}
              >
                Start by adding your first stock entry to track inventory
              </p>
            </div>
          )}

          {/* Summary Section - Show different summary based on color tracking */}
          {!isColorTrackingEnabled && spare?.[stockField]?.length > 0 && (
            <div
              style={{
                marginTop: "1.5rem",
                padding: "1rem",
                backgroundColor: "#f0f9ff",
                border: "2px solid #0ea5e9",
                borderRadius: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "#0369a1",
                      fontWeight: "600",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Total Stock
                  </div>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: "700",
                      color: "#0284c7",
                      lineHeight: "1",
                    }}
                  >
                    {spare[stockField].reduce(
                      (sum, entry) => sum + parseInt(entry.quantity || 0),
                      0
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      marginTop: "0.25rem",
                    }}
                  >
                    pieces
                  </div>
                </div>
                <div
                  style={{
                    width: "1px",
                    height: "3rem",
                    backgroundColor: "#0ea5e9",
                    margin: "0 1rem",
                  }}
                />
                <div
                  style={{
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "#0369a1",
                      fontWeight: "600",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Total Value
                  </div>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: "700",
                      color: "#059669",
                      lineHeight: "1",
                    }}
                  >
                    {isPurchasePriceUnlocked ? (
                      <>
                    ₹
                    {spare[stockField]
                      .reduce(
                        (sum, entry) =>
                          sum +
                          parseFloat(entry.quantity || 0) *
                            parseFloat(entry.purchasePrice || 0),
                        0
                      )
                      .toFixed(2)}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowPurchasePriceDialog(true)}
                        style={{
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          backgroundColor: "#fee2e2",
                          border: "1px solid #fecaca",
                          borderRadius: "0.5rem",
                          padding: "0.75rem 1.5rem",
                          fontSize: "1.25rem",
                          color: "#dc2626",
                          fontWeight: "600",
                          transition: "background-color 0.2s",
                        }}
                        title="Click to unlock with security key"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#fecaca";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#fee2e2";
                        }}
                      >
                        🔒 Click to unlock
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      marginTop: "0.25rem",
                    }}
                  >
                    inventory value
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Color tracking summary */}
          {isColorTrackingEnabled && (
            <div
              style={{
                marginTop: "1.5rem",
                padding: "1rem",
                backgroundColor: "#f0f9ff",
                border: "2px solid #0ea5e9",
                borderRadius: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "#0369a1",
                      fontWeight: "600",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Total Colors
                  </div>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: "700",
                      color: "#0284c7",
                      lineHeight: "1",
                    }}
                  >
                    {spare.colorQuantity
                      ? new Set(
                          spare.colorQuantity.map((cq) =>
                            (cq.color || "").toLowerCase().trim()
                          )
                        ).size
                      : 0}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      marginTop: "0.25rem",
                    }}
                  >
                    colors tracked
                  </div>
                </div>
                <div
                  style={{
                    width: "1px",
                    height: "3rem",
                    backgroundColor: "#0ea5e9",
                    margin: "0 1rem",
                  }}
                />
                <div
                  style={{
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "#0369a1",
                      fontWeight: "600",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Total Stock
                  </div>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: "700",
                      color: "#0284c7",
                      lineHeight: "1",
                    }}
                  >
                    {spare.colorQuantity.reduce(
                      (sum, colorQty) => sum + parseInt(colorQty.quantity || 0),
                      0
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      marginTop: "0.25rem",
                    }}
                  >
                    pieces
                  </div>
                </div>
                <div
                  style={{
                    width: "1px",
                    height: "3rem",
                    backgroundColor: "#0ea5e9",
                    margin: "0 1rem",
                  }}
                />
                <div
                  style={{
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "#0369a1",
                      fontWeight: "600",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Total Value
                  </div>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: "700",
                      color: "#059669",
                      lineHeight: "1",
                    }}
                  >
                    {isPurchasePriceUnlocked ? (
                      <>
                    ₹
                    {spare.colorQuantity
                      .reduce(
                        (sum, colorQty) =>
                          sum +
                          parseFloat(colorQty.quantity || 0) *
                            parseFloat(colorQty.purchasePrice || 0),
                        0
                      )
                      .toFixed(2)}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowPurchasePriceDialog(true)}
                        style={{
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          backgroundColor: "#fee2e2",
                          border: "1px solid #fecaca",
                          borderRadius: "0.5rem",
                          padding: "0.75rem 1.5rem",
                          fontSize: "1.25rem",
                          color: "#dc2626",
                          fontWeight: "600",
                          transition: "background-color 0.2s",
                        }}
                        title="Click to unlock with security key"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#fecaca";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#fee2e2";
                        }}
                      >
                        🔒 Click to unlock
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      marginTop: "0.25rem",
                    }}
                  >
                    inventory value
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Purchase Price Security Key Dialog */}
      {showPurchasePriceDialog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPurchasePriceDialog(false);
              setPurchasePriceSecurityKey("");
              setPurchasePriceDialogError("");
            }
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "2rem",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
              maxWidth: "400px",
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                marginBottom: "1rem",
                color: "#1f2937",
                fontSize: "1.25rem",
                fontWeight: "600",
              }}
            >
              🔒 Unlock Purchase Price
            </h3>
            <p
              style={{
                marginBottom: "1.5rem",
                color: "#6b7280",
                fontSize: "0.875rem",
                lineHeight: "1.5",
              }}
            >
              Enter the security key to unlock the purchase price field.
            </p>
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#374151",
                  fontWeight: "500",
                  fontSize: "0.875rem",
                }}
              >
                Security Key
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPurchasePriceKey ? "text" : "password"}
                  value={purchasePriceSecurityKey}
                  onChange={(e) => {
                    setPurchasePriceSecurityKey(e.target.value);
                    setPurchasePriceDialogError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUnlockPurchasePrice();
                    } else if (e.key === "Escape") {
                      setShowPurchasePriceDialog(false);
                      setPurchasePriceSecurityKey("");
                      setPurchasePriceDialogError("");
                    }
                  }}
                  placeholder="Enter security key"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "0.75rem 2.5rem 0.75rem 0.75rem",
                    border: purchasePriceDialogError
                      ? "2px solid #dc2626"
                      : "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPurchasePriceKey((prevVisible) => !prevVisible)
                  }
                  title={showPurchasePriceKey ? "Hide key" : "Show key"}
                  style={{
                    position: "absolute",
                    right: "0.5rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#6b7280",
                    padding: "0.25rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "4px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)";
                    e.currentTarget.style.color = "#374151";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#6b7280";
                  }}
                >
                  {showPurchasePriceKey ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {purchasePriceDialogError && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    color: "#dc2626",
                    fontSize: "0.75rem",
                  }}
                >
                  {purchasePriceDialogError}
      </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowPurchasePriceDialog(false);
                  setPurchasePriceSecurityKey("");
                  setPurchasePriceDialogError("");
                }}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnlockPurchasePrice}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                }}
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ask user whether to enter purchase price now or later */}
      {showPurchasePriceDecisionDialog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPurchasePriceDecisionDialog(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "1.75rem",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
              maxWidth: "420px",
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                marginBottom: "0.75rem",
                color: "#1f2937",
                fontSize: "1.1rem",
                fontWeight: "600",
              }}
            >
              Purchase price not entered
            </h3>
            <p
              style={{
                marginBottom: "1.25rem",
                color: "#4b5563",
                fontSize: "0.9rem",
                lineHeight: "1.5",
              }}
            >
              Do you want to enter the purchase price now or later?
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  // Close dialog and show security key unlock to enter purchase price now
                  setShowPurchasePriceDecisionDialog(false);
                  setShowPurchasePriceDialog(true);
                }}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                }}
              >
                Enter Now
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowPurchasePriceDecisionDialog(false);
                  // Proceed with submission allowing missing purchase price
                  await submitStockEntry(true);
                }}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                }}
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Min Stock Level Decision Dialog */}
      {showMinStockLevelDialog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              // Cancel - set color but don't use existing min stock level
              handleMinStockLevelChoice(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "1.75rem",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
              maxWidth: "420px",
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                marginBottom: "0.75rem",
                color: "#1f2937",
                fontSize: "1.1rem",
                fontWeight: "600",
              }}
            >
              Color already exists
            </h3>
            <p
              style={{
                marginBottom: "1rem",
                color: "#4b5563",
                fontSize: "0.9rem",
                lineHeight: "1.5",
              }}
            >
              This color already exists in another stock entry with a min stock level of{" "}
              <strong>{existingMinStockLevel}</strong>.
            </p>
            <p
              style={{
                marginBottom: "1.25rem",
                color: "#4b5563",
                fontSize: "0.9rem",
                lineHeight: "1.5",
              }}
            >
              Do you want to use the same min stock level ({existingMinStockLevel}) or enter a new one?
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
              }}
            >
              <button
                type="button"
                onClick={() => handleMinStockLevelChoice(false)}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                }}
              >
                Enter New
              </button>
              <button
                type="button"
                onClick={() => handleMinStockLevelChoice(true)}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                }}
              >
                Use Existing ({existingMinStockLevel})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddMoreStock;
