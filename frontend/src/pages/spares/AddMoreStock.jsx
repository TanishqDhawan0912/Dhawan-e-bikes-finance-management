import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDate } from "../../utils/dateUtils";

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
    colors: list,
  }));
  const toDate = (s) => {
    const p = String(s || "").split("/");
    if (p.length === 3) return new Date(`${p[2]}-${p[1]}-${p[0]}`);
    return new Date(s || "");
  };
  groups.sort((a, b) => toDate(a.date) - toDate(b.date));
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
  padding: "2rem",
  backgroundColor: "#f9fafb",
  minHeight: "100vh",
  position: "relative",
};

function AddMoreStock() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [spare, setSpare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stockField, setStockField] = useState("stockEntries");

  // State for new stock entry form
  const [newStockEntry, setNewStockEntry] = useState({
    quantity: "",
    purchasePrice: "",
    purchaseDate: formatDate(new Date()),
    color: "",
    minStockLevel: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formWarning, setFormWarning] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredEntryIndex, setHoveredEntryIndex] = useState(null);
  const [editingEntryIndex, setEditingEntryIndex] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  // State for edit entry color management
  const [editEntryColors, setEditEntryColors] = useState([]);
  const [newEditColor, setNewEditColor] = useState("");
  const [newEditColorQuantity, setNewEditColorQuantity] = useState("");
  const [newEditColorPurchasePrice, setNewEditColorPurchasePrice] =
    useState("");

  // Check if color tracking is enabled for this spare
  const isColorTrackingEnabled =
    spare?.hasColors === true
      ? true
      : spare?.hasColors === false
      ? false
      : Array.isArray(spare?.colorQuantity) && spare.colorQuantity.length > 0;

  // State to track if we need to re-scroll
  const [needsRescroll, setNeedsRescroll] = useState(false);

  const [activeColorByDate, setActiveColorByDate] = useState({});

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
        setEditingEntryIndex(index);
        setEditingEntry({
          ...entry,
          purchaseDate: entry.purchaseDate || formatDate(new Date()),
        });

        // Initialize colors if needed
        if (isColorTrackingEnabled) {
          setEditingEntry((prev) => ({ ...prev, quantity: 0 }));
          if (
            Array.isArray(entry.colorQuantities) &&
            entry.colorQuantities.length > 0
          ) {
            setEditEntryColors(
              entry.colorQuantities.map((cq) => ({
                color: cq.color,
                quantity: parseInt(cq.quantity || 0),
              }))
            );
          } else if (entry.color) {
            setEditEntryColors([
              { color: entry.color, quantity: entry.quantity },
            ]);
          } else {
            setEditEntryColors([]);
          }
        }
        setNewEditColor("");
        setNewEditColorQuantity("");
        setNewEditColorPurchasePrice("");
      }, 50);
      return;
    }

    // Normal edit flow
    setEditingEntryIndex(index);
    setEditingEntry({
      ...entry,
      purchaseDate: entry.purchaseDate || formatDate(new Date()),
    });

    // Initialize edit entry colors if color tracking is enabled
    if (isColorTrackingEnabled) {
      // Reset quantity to 0 when color tracking is enabled
      setEditingEntry((prev) => ({ ...prev, quantity: 0 }));

      if (
        Array.isArray(entry.colorQuantities) &&
        entry.colorQuantities.length > 0
      ) {
        setEditEntryColors(
          entry.colorQuantities.map((cq) => ({
            color: cq.color,
            quantity: parseInt(cq.quantity || 0),
          }))
        );
      } else if (entry.color) {
        setEditEntryColors([
          {
            color: entry.color,
            quantity: entry.quantity,
          },
        ]);
      } else {
        setEditEntryColors([]);
      }
    } else {
      setEditEntryColors([]);
    }
    setNewEditColor("");
    setNewEditColorQuantity("");
    setNewEditColorPurchasePrice("");
    setNeedsRescroll(false);
  };

  // Add color to edit entry
  const addEditEntryColor = () => {
    if (
      newEditColor.trim() &&
      newEditColorQuantity.trim() &&
      newEditColorPurchasePrice.trim() &&
      parseInt(newEditColorQuantity) >= 0 &&
      parseFloat(newEditColorPurchasePrice) >= 0
    ) {
      // Check if color already exists
      const existingIndex = editEntryColors.findIndex(
        (cq) => cq.color.toLowerCase() === newEditColor.trim().toLowerCase()
      );

      if (existingIndex !== -1) {
        // Update existing color quantity and purchase price
        setEditEntryColors((prev) =>
          prev.map((cq, index) =>
            index === existingIndex
              ? {
                  ...cq,
                  quantity: parseInt(newEditColorQuantity),
                  purchasePrice: parseFloat(newEditColorPurchasePrice),
                }
              : cq
          )
        );
      } else {
        // Add new color
        setEditEntryColors((prev) => [
          ...prev,
          {
            color: newEditColor.trim(),
            quantity: parseInt(newEditColorQuantity),
            purchasePrice: parseFloat(newEditColorPurchasePrice),
          },
        ]);
      }
      setFormError("");
      setNewEditColor("");
      setNewEditColorQuantity("");
      setNewEditColorPurchasePrice("");
    }
  };

  // Remove color from edit entry
  const removeEditEntryColor = (colorToRemove) => {
    setEditEntryColors((prev) =>
      prev.filter((cq) => cq.color !== colorToRemove)
    );
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    if (isColorTrackingEnabled) {
      const hasPendingTypedInputs =
        (newEditColor || "").trim() ||
        (newEditColorQuantity || "").trim() ||
        (newEditColorPurchasePrice || "").trim();
      if (hasPendingTypedInputs) {
        setFormError(
          "Color, quantity, and purchase price inputs changed. Click Add to save before saving changes"
        );
        return;
      }
      if (editEntryColors.length === 0) {
        setFormError("Add at least one color quantity using Add");
        return;
      }
    }
    await performSaveEdit();
  };

  const performSaveEdit = async () => {
    try {
      const currentStockEntries = spare?.[stockField] || [];
      const currentColorQuantity = spare?.colorQuantity || [];

      // Calculate total quantity based on color tracking
      const totalQuantity = isColorTrackingEnabled
        ? editEntryColors.reduce((total, cq) => total + cq.quantity, 0)
        : parseInt(editingEntry?.quantity || 0);

      // Update the entry with total quantity
      const updatedEntry = {
        ...editingEntry,
        quantity: totalQuantity,
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

      if (!isColorTrackingEnabled) {
        const filteredEntries = currentStockEntries.filter(
          (e, idx) => !isQuantityZero(e.quantity) && idx !== editingEntryIndex
        );
        const newDate = displayDate(updatedEntry.purchaseDate);
        const hasDuplicateDate = filteredEntries.some(
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
        const prevColors =
          Array.isArray(editingEntry.colorQuantities) &&
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

        // Subtract previous entry color quantities from global colorQuantity
        prevColors.forEach((prev) => {
          const idx = updatedColorQuantity.findIndex(
            (cq) => cq.color.toLowerCase() === prev.color.toLowerCase()
          );
          if (idx !== -1) {
            const newQty =
              parseInt(updatedColorQuantity[idx].quantity || 0) - prev.quantity;
            updatedColorQuantity[idx].quantity = newQty > 0 ? newQty : 0;
          }
        });

        editEntryColors.forEach((newCq) => {
          const existingIndex = updatedColorQuantity.findIndex(
            (cq) => cq.color.toLowerCase() === newCq.color.toLowerCase()
          );

          if (existingIndex !== -1) {
            updatedColorQuantity[existingIndex].quantity =
              parseInt(updatedColorQuantity[existingIndex].quantity || 0) +
              newCq.quantity;
            updatedColorQuantity[existingIndex].purchaseDate =
              editingEntry?.purchaseDate ||
              updatedColorQuantity[existingIndex].purchaseDate ||
              "";
          } else if (newCq.quantity > 0) {
            updatedColorQuantity.push({
              color: newCq.color,
              quantity: newCq.quantity,
              purchaseDate: editingEntry?.purchaseDate || "",
            });
          }
        });
      }

      // Check if quantity is zero and handle removal
      if (isQuantityZero(totalQuantity)) {
        // Calculate total value of all other entries (excluding current one)
        const otherEntriesValue = currentStockEntries.reduce(
          (sum, entry, index) => {
            if (index === editingEntryIndex) return sum; // Skip current entry
            return (
              sum +
              parseFloat(entry.quantity || 0) *
                parseFloat(entry.purchasePrice || 0)
            );
          },
          0
        );

        // Remove entry only if there are other entries with value > 0
        if (otherEntriesValue > 0) {
          // Remove the entry
          const updatedStockEntries = currentStockEntries.filter(
            (_, index) => index !== editingEntryIndex
          );

          const response = await fetch(
            `http://localhost:5000/api/spares/${id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                [stockField]: updatedStockEntries,
                ...(isColorTrackingEnabled && {
                  colorQuantity: updatedColorQuantity,
                }),
              }),
            }
          );

          if (response.ok) {
            const updatedSpare = await response.json();
            setSpare(updatedSpare);
            await fetchSpareDetails();
            setEditingEntryIndex(null);
            setEditingEntry(null);
            setEditEntryColors([]);
            setNewEditColor("");
            setNewEditColorQuantity("");
          } else {
            throw new Error("Failed to remove stock entry");
          }
        } else {
          // Keep the entry with zero quantity if it's the only one or no other entries have value
          const updatedStockEntries = currentStockEntries.map((entry, index) =>
            index === editingEntryIndex ? updatedEntry : entry
          );

          const response = await fetch(
            `http://localhost:5000/api/spares/${id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                [stockField]: updatedStockEntries,
                ...(isColorTrackingEnabled && {
                  colorQuantity: updatedColorQuantity,
                }),
              }),
            }
          );

          if (response.ok) {
            const updatedSpare = await response.json();
            setSpare(updatedSpare);
            await fetchSpareDetails();
            setEditingEntryIndex(null);
            setEditingEntry(null);
            setEditEntryColors([]);
            setNewEditColor("");
            setNewEditColorQuantity("");
          } else {
            throw new Error("Failed to update stock entry");
          }
        }
      } else {
        // Normal update
        const updatedStockEntries = currentStockEntries.map((entry, index) =>
          index === editingEntryIndex ? updatedEntry : entry
        );

        const response = await fetch(`http://localhost:5000/api/spares/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            [stockField]: updatedStockEntries,
            ...(isColorTrackingEnabled && {
              colorQuantity: updatedColorQuantity,
            }),
          }),
        });

        if (response.ok) {
          const updatedSpare = await response.json();
          setSpare(updatedSpare);
          await fetchSpareDetails();
          setEditingEntryIndex(null);
          setEditingEntry(null);
          setEditEntryColors([]);
          setNewEditColor("");
          setNewEditColorQuantity("");
        } else {
          throw new Error("Failed to update stock entry");
        }
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
    setNewEditColorQuantity("");
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

  // Helper function to check if quantity is zero
  const isQuantityZero = (quantity) => {
    // Handle different types: string, number, undefined
    const numQuantity = parseInt(quantity);
    return (
      quantity === "0" ||
      quantity === "" ||
      quantity === 0 ||
      numQuantity === 0 ||
      isNaN(numQuantity)
    );
  };

  const fetchSpareDetails = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/spares/${id}`);
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

  // When color tracking is enabled, automatically clear stockEntries on the backend
  useEffect(() => {
    const clearStockEntriesIfNeeded = async () => {
      try {
        if (
          isColorTrackingEnabled &&
          Array.isArray(spare?.[stockField]) &&
          spare[stockField].length > 0
        ) {
          const response = await fetch(
            `http://localhost:5000/api/spares/${id}`,
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

  // Handle date selection from calendar
  const handleDateSelect = (date) => {
    setNewStockEntry((prev) => ({
      ...prev,
      purchaseDate: formatDate(date),
    }));
    setShowDatePicker(false);
  };

  const handleEditDateSelect = (date) => {
    setEditingEntry((prev) => ({
      ...prev,
      purchaseDate: formatDate(date),
    }));
    setShowEditDatePicker(false);
  };

  // Toggle date picker
  const toggleDatePicker = () => {
    setShowDatePicker(!showDatePicker);
  };

  // Navigate to previous month
  const previousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    );
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    );
  };

  // Format month name
  const formatMonthName = (date) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
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
      const response = await fetch(`http://localhost:5000/api/spares/${id}`, {
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
    setEditingColorEntry({
      color: colorEntry.color || "",
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
      const updatedColorQuantity = currentColorQuantity.filter(
        (_, index) => index !== colorIndex
      );

      const response = await fetch(`http://localhost:5000/api/spares/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          colorQuantity: updatedColorQuantity,
          [stockField]: [],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete color entry");
      }

      await fetchSpareDetails();
      setEditingColorIndex(null);
      setEditingColorEntry(null);
      console.log("Color entry deleted successfully");
    } catch (error) {
      console.error("Error deleting color entry:", error);
    }
  };

  // Handle pre-fill form with date and purchase price
  const handlePreFillForm = (date, purchasePrice, buttonId) => {
    // Set button animation state
    setClickedButtonId(buttonId);
    setTimeout(() => setClickedButtonId(null), 300);

    // Set pre-filled state for animation
    setPreFilledFields({
      purchaseDate: true,
      purchasePrice: true,
    });

    setNewStockEntry((prev) => ({
      ...prev,
      purchaseDate: date,
      purchasePrice: purchasePrice?.toString() || "",
      color: "",
      quantity: "",
      minStockLevel: "",
    }));
    setFormError("");
    setFormWarning("");

    // Scroll to form with slight delay for smooth animation
    setTimeout(() => {
      // Use ref first, then fallback to ID selector
      const formElement = formSectionRef.current || document.getElementById("add-stock-form-section");
      
      if (formElement) {
        formElement.scrollIntoView({ 
          behavior: "smooth", 
          block: "start",
          inline: "nearest"
        });
      } else {
        // Fallback: scroll to the first input field
        const firstInput = document.querySelector('input[name="purchasePrice"]') || 
                          document.querySelector('input[name="purchaseDate"]');
        if (firstInput) {
          firstInput.scrollIntoView({ 
            behavior: "smooth", 
            block: "center",
            inline: "nearest"
          });
        }
      }
    }, 200);

    // Remove animation highlight after animation completes
    setTimeout(() => {
      setPreFilledFields({
        purchaseDate: false,
        purchasePrice: false,
      });
    }, 2000);
  };

  // Handle save edited color entry
  const handleSaveColorEntry = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormWarning("");

    if (
      !editingColorEntry?.color ||
      !editingColorEntry?.quantity ||
      !editingColorEntry?.purchasePrice
    ) {
      setFormError("All required fields must be filled");
      return;
    }

    if (
      parseFloat(editingColorEntry.quantity) <= 0 ||
      parseFloat(editingColorEntry.purchasePrice) <= 0
    ) {
      setFormError("Quantity and purchase price must be greater than 0");
      return;
    }

    try {
      const currentColorQuantity = spare?.colorQuantity || [];
      // Get the original purchase date from the entry being edited
      const originalEntry = currentColorQuantity[editingColorIndex];
      const originalPurchaseDate = originalEntry?.purchaseDate || "";

      const updatedColorQuantity = currentColorQuantity.map((cq, index) =>
        index === editingColorIndex
          ? {
              color: editingColorEntry.color.trim(),
              quantity: parseInt(editingColorEntry.quantity),
              minStockLevel: editingColorEntry.minStockLevel
                ? parseInt(editingColorEntry.minStockLevel)
                : 0,
              purchasePrice: parseFloat(editingColorEntry.purchasePrice),
              purchaseDate: originalPurchaseDate, // Keep the original purchase date
            }
          : cq
      );

      const response = await fetch(`http://localhost:5000/api/spares/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          colorQuantity: updatedColorQuantity,
          [stockField]: [],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update color entry");
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

  // Handle form submission for new stock entry
  const handleSubmitStockEntry = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormWarning("");

    // Validate form
    if (
      !newStockEntry.quantity ||
      !newStockEntry.purchasePrice ||
      !newStockEntry.purchaseDate ||
      (isColorTrackingEnabled && !newStockEntry.color)
    ) {
      setFormError(
        isColorTrackingEnabled
          ? "All fields are required"
          : "Quantity, purchase price, and purchase date are required"
      );
      return;
    }

    if (
      parseFloat(newStockEntry.quantity) <= 0 ||
      parseFloat(newStockEntry.purchasePrice) <= 0 ||
      (isColorTrackingEnabled &&
        newStockEntry.minStockLevel &&
        parseFloat(newStockEntry.minStockLevel) < 0)
    ) {
      setFormError(
        "Quantity and purchase price must be greater than 0, and min stock level must be >= 0"
      );
      return;
    }

    // When color tracking is enabled, stock entries do not participate; skip duplicate checks against stock entries
    // Duplicate check for color + purchase date when color tracking is enabled
    if (isColorTrackingEnabled) {
      const newDate = displayDate(newStockEntry.purchaseDate);
      const hasDuplicateColorDate = (spare?.colorQuantity || []).some(
        (cq) =>
          String(cq.color || "").toLowerCase() ===
            String(newStockEntry.color || "").toLowerCase() &&
          displayDate(cq.purchaseDate) === newDate
      );
      if (hasDuplicateColorDate) {
        setFormWarning(
          "A color entry with this purchase date already exists. Please use a different date."
        );
        setIsSubmitting(false);
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
        // Check if there's only one entry and it has zero quantity
        if (
          currentStockEntries.length === 1 &&
          isQuantityZero(currentStockEntries[0].quantity)
        ) {
          // Replace the zero quantity entry with the new entry
          updatedStockEntries = [
            {
              quantity: parseInt(newStockEntry.quantity),
              purchasePrice: parseFloat(newStockEntry.purchasePrice),
              purchaseDate: newStockEntry.purchaseDate,
            },
          ];
          console.log("Replaced single zero entry with new stock");
        } else {
          // Filter out zero quantity entries
          const filteredEntries = currentStockEntries.filter(
            (entry) => !isQuantityZero(entry.quantity)
          );

          // Duplicate check by purchase date when color tracking is disabled
          const newDate = displayDate(newStockEntry.purchaseDate);
          const hasDuplicateDate = filteredEntries.some(
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

          // Add the new entry when no duplicate date
          updatedStockEntries = [
            ...filteredEntries,
            {
              quantity: parseInt(newStockEntry.quantity),
              purchasePrice: parseFloat(newStockEntry.purchasePrice),
              purchaseDate: newStockEntry.purchaseDate,
            },
          ];
          console.log("Filtered zero entries and added new stock");
        }
      }

      // Update colorQuantity array when color tracking is enabled
      if (isColorTrackingEnabled) {
        // Check for duplicate: same color + same purchase date
        const newDate = displayDate(newStockEntry.purchaseDate);
        const duplicateIndex = currentColorQuantity.findIndex(
          (cq) =>
            cq.color.toLowerCase() === newStockEntry.color.toLowerCase() &&
            displayDate(cq.purchaseDate) === newDate
        );

        if (duplicateIndex !== -1) {
          setFormWarning(
            `A ${newStockEntry.color} color entry with purchase date ${newDate} already exists. Each color entry must have a unique purchase date.`
          );
          setTimeout(() => setFormWarning(""), 5000);
          setIsSubmitting(false);
          return;
        }

        // No duplicate found - create a new color entry (same color with different date = different entry)
          updatedColorQuantity = [
            ...currentColorQuantity,
            {
              color: newStockEntry.color.trim(),
              quantity: parseInt(newStockEntry.quantity),
              minStockLevel: newStockEntry.minStockLevel
                ? parseInt(newStockEntry.minStockLevel)
                : 0,
              purchasePrice: parseFloat(newStockEntry.purchasePrice),
              purchaseDate: newStockEntry.purchaseDate,
            },
          ];
      } else {
        updatedColorQuantity = currentColorQuantity;
      }

      console.log("Updated stock entries:", updatedStockEntries);
      console.log("Updated color quantities:", updatedColorQuantity);

      // Update the spare: when color tracking is enabled, only update colorQuantity; otherwise update stockEntries
      const requestBody = isColorTrackingEnabled
        ? { colorQuantity: updatedColorQuantity, [stockField]: [] }
        : { [stockField]: updatedStockEntries };

      const response = await fetch(`http://localhost:5000/api/spares/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error adding stock entry");
      }

      console.log("Stock entry successfully added to database");

      // Refresh spare details
      await fetchSpareDetails();
      console.log("Spare details refreshed");

      // Reset form
      setNewStockEntry({
        quantity: "",
        purchasePrice: "",
        purchaseDate: formatDate(new Date()),
        color: "",
        minStockLevel: "",
      });

      setFormError("");
      setFormWarning("");
    } catch (err) {
      setFormError(err.message || "Error adding stock entry");
    } finally {
      setIsSubmitting(false);
    }
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
    <div style={style}>
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
        style={{
          backgroundColor: "white",
          padding: "2rem",
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
                }}
              />
            </div>
          </div>
        </div>

        {/* Add New Stock Entry Section */}
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
              <h3
                style={{
                  margin: 0,
                  color: "#1f2937",
                  fontSize: "1.25rem",
                  fontWeight: "600",
                }}
              >
                {isColorTrackingEnabled
                  ? "Add New Color Entry"
                  : "Add New Stock Entry"}
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

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                {isColorTrackingEnabled && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        color: "#374151",
                        fontWeight: "500",
                      }}
                    >
                      Color *
                    </label>
                    <input
                      type="text"
                      name="color"
                      value={newStockEntry.color}
                      onChange={handleInputChange}
                      placeholder="Enter color name"
                      required={isColorTrackingEnabled}
                      disabled={isSubmitting}
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
                )}
                {isColorTrackingEnabled && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        color: "#374151",
                        fontWeight: "500",
                      }}
                    >
                      Min Stock Level
                    </label>
                    <input
                      type="number"
                      name="minStockLevel"
                      value={newStockEntry.minStockLevel}
                      onChange={handleInputChange}
                      placeholder="Enter minimum stock level"
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
                )}
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
                      backgroundColor: "#ffffff",
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
                    }}
                  >
                    Purchase Price *
                  </label>
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
                    Purchase Date *
                  </label>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                    }}
                  >
                    <input
                      type="text"
                      name="purchaseDate"
                      value={newStockEntry.purchaseDate}
                      onChange={handleInputChange}
                      placeholder="dd/mm/yyyy"
                      required
                      disabled={isSubmitting}
                      style={{
                        flex: 1,
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0.5rem",
                        backgroundColor: "#f3f4f6",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                        position: "relative",
                      }}
                      title="Calendar"
                      onClick={toggleDatePicker}
                    >
                      <svg
                        width="16"
                        height="16"
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

                      {showDatePicker && (
                        <div
                          id="date-picker-calendar"
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
                          {/* Month Navigation Header */}
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

                              if (!isValidDay) {
                                return (
                                  <div
                                    key={i}
                                    style={{ padding: "0.5rem" }}
                                  ></div>
                                );
                              }

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
                                newStockEntry.purchaseDate;
                              const isToday =
                                currentDateString === displayDate(new Date());
                              const isFuture =
                                currentDate > new Date().setHours(0, 0, 0, 0);

                              return (
                                <div
                                  key={i}
                                  onClick={() =>
                                    !isFuture && handleDateSelect(currentDate)
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
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
                    Total Quantity
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
                  <input
                    type="number"
                    value={editingEntry?.purchasePrice || ""}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        purchasePrice: e.target.value,
                      })
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

                    {/* Current Edit Entry Colors */}
                    <div style={{ marginBottom: "1rem" }}>
                      {editEntryColors.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                          }}
                        >
                          {editEntryColors.map((cq, index) => (
                            <span
                              key={index}
                              style={{
                                backgroundColor: "#10b981",
                                color: "white",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                                fontSize: "0.875rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                            >
                              {cq.color}: {cq.quantity}
                              <button
                                type="button"
                                onClick={() => removeEditEntryColor(cq.color)}
                                style={{
                                  backgroundColor: "#10b981",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "0.25rem",
                                  cursor: "pointer",
                                  padding: "0.125rem 0.375rem",
                                  fontSize: "0.875rem",
                                  fontWeight: "bold",
                                  minWidth: "1.5rem",
                                  height: "1.5rem",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  transition: "background-color 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = "#059669";
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = "#10b981";
                                }}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: "#6b7280", fontStyle: "italic" }}>
                          No color quantities added
                        </p>
                      )}
                    </div>

                    {/* Add Color Quantity */}
                    <div>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "flex-end",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <input
                            type="text"
                            value={newEditColor}
                            onChange={(e) => setNewEditColor(e.target.value)}
                            placeholder="Enter color name"
                            onKeyPress={(e) =>
                              e.key === "Enter" && addEditEntryColor()
                            }
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.375rem",
                              backgroundColor: "#ffffff",
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
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
                        <div style={{ flex: 1 }}>
                          <input
                            type="number"
                            value={newEditColorPurchasePrice}
                            onChange={(e) =>
                              setNewEditColorPurchasePrice(e.target.value)
                            }
                            placeholder="Purchase Price"
                            min="0"
                            step="0.01"
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
                        <button
                          type="button"
                          onClick={addEditEntryColor}
                          disabled={
                            !newEditColor.trim() ||
                            !newEditColorQuantity.trim() ||
                            !newEditColorPurchasePrice.trim() ||
                            parseInt(newEditColorQuantity) < 0 ||
                            parseFloat(newEditColorPurchasePrice) < 0
                          }
                          style={{
                            padding: "0.5rem 1rem",
                            backgroundColor:
                              newEditColor.trim() &&
                              newEditColorQuantity.trim() &&
                              newEditColorPurchasePrice.trim() &&
                              parseInt(newEditColorQuantity) >= 0 &&
                              parseFloat(newEditColorPurchasePrice) >= 0
                                ? "#10b981"
                                : "#9ca3af",
                            color: "white",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor:
                              newEditColor.trim() &&
                              newEditColorQuantity.trim() &&
                              newEditColorPurchasePrice.trim() &&
                              parseInt(newEditColorQuantity) >= 0 &&
                              parseFloat(newEditColorPurchasePrice) >= 0
                                ? "pointer"
                                : "not-allowed",
                          }}
                        >
                          Add
                        </button>
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
                        (newEditColorQuantity || "").trim()) && (
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
                  overflow: "hidden",
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
                              onClick={() =>
                                handlePreFillForm(
                                  group.date,
                                  purchasePrice,
                                  `add-btn-${groupIndex}`
                                )
                              }
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
                                  clickedButtonId === `add-btn-${groupIndex}`
                                    ? "scale(0.95)"
                                    : "scale(1)",
                                boxShadow:
                                  clickedButtonId === `add-btn-${groupIndex}`
                                    ? "0 2px 8px rgba(59, 130, 246, 0.4)"
                                    : "0 1px 3px rgba(0, 0, 0, 0.1)",
                              }}
                              onMouseEnter={(e) => {
                                if (clickedButtonId !== `add-btn-${groupIndex}`) {
                                  e.currentTarget.style.backgroundColor = "#2563eb";
                                  e.currentTarget.style.transform = "scale(1.05)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (clickedButtonId !== `add-btn-${groupIndex}`) {
                                  e.currentTarget.style.backgroundColor = "#3b82f6";
                                  e.currentTarget.style.transform = "scale(1)";
                                }
                              }}
                              title="Add color with same date and purchase price"
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
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                              </svg>
                              Add
                            </button>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              backgroundColor: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: "0.5rem",
                              overflow: "hidden",
                              padding: "0.25rem",
                              gap: "0.25rem",
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
                                    flex: 1,
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
                                      fontSize: "0.75rem",
                                      opacity: 0.8,
                                    }}
                                  >
                                    ({colorQty.quantity})
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
                                        Quantity *
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
                                        min="1"
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
                                        Purchase Price *
                                      </label>
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
                                <div>
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#64748b",
                                    }}
                                  >
                                    Quantity
                                  </div>
                                  <div style={{ fontWeight: 700 }}>
                                    {activeColor.quantity}
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
                                    $
                                    {parseFloat(
                                      activeColor.purchasePrice || 0
                                    ).toFixed(2)}
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
                                    {(
                                      parseFloat(activeColor.quantity || 0) *
                                        parseFloat(
                                          activeColor.purchasePrice || 0
                                        )
                                    ).toFixed(2)}
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
                        marginBottom: "0.25rem",
                      }}
                    >
                      Quantity
                    </div>
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: "700",
                        color: "#1e293b",
                        display: "flex",
                        alignItems: "baseline",
                        gap: "0.25rem",
                      }}
                    >
                      {entry.quantity}
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: "400",
                          color: "#64748b",
                        }}
                      >
                        pieces
                      </span>
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
                      {entry.purchasePrice}
                    </div>
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
      </div>
    </div>
  );
}

export default AddMoreStock;
