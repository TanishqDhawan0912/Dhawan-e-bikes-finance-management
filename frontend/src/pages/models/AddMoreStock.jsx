import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../../config/api";
import { formatDate } from "../../utils/dateUtils";

// Helper function to display dd/mm/yyyy dates
const displayDate = (dateString) => {
  if (!dateString) return "";
  const dateStr =
    dateString instanceof Date ? dateString.toString() : String(dateString);
  if (dateStr.includes("/")) {
    return dateStr;
  }
  return formatDate(dateString);
};

// Helper to validate date format (dd/mm/yyyy)
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

// Helper to check if quantity is zero
const isQuantityZero = (quantity) => {
  const numQuantity = parseInt(quantity);
  return (
    quantity === "0" ||
    quantity === "" ||
    quantity === 0 ||
    numQuantity === 0 ||
    isNaN(numQuantity)
  );
};

// Sort entries by date (newest first)
const sortEntriesByDate = (entries) => {
  if (!Array.isArray(entries)) return [];
  return [...entries].sort((a, b) => {
    const dateA = new Date(parseDate(a.purchaseDate || ""));
    const dateB = new Date(parseDate(b.purchaseDate || ""));
    return dateB - dateA;
  });
};

// Group entries by date
const groupEntriesByDate = (entries) => {
  if (!Array.isArray(entries)) return [];
  const grouped = {};
  entries.forEach((entry) => {
    const date = displayDate(entry.purchaseDate || "");
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(entry);
  });
  // Sort dates (newest first)
  return Object.entries(grouped)
    .sort((a, b) => {
      const dateA = parseDate(a[0]);
      const dateB = parseDate(b[0]);
      return dateB - dateA;
    })
    .map(([date, entries]) => ({ date, entries }));
};

// Get color display helper
const getColourDisplay = (color) => {
  const colorMap = {
    red: "#dc2626",
    cherry: "#8B0000",
    blue: "#2563eb",
    green: "#16a34a",
    black: "#000000",
    white: "#ffffff",
    peacock: "#006994",
    grey: "#808080",
    gray: "#808080",
    silver: "#C0C0C0",
    yellow: "#FFFF00",
    "white-black": "#6c757d",
  };
  return colorMap[color?.toLowerCase()] || "#6b7280";
};

// Parse date from dd/mm/yyyy format
const parseDate = (dateString) => {
  if (!dateString) return new Date();
  if (dateString.includes("/")) {
    const [day, month, year] = dateString.split("/");
    return new Date(year, month - 1, day);
  }
  return new Date(dateString);
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
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newStockEntry, setNewStockEntry] = useState({
    purchaseDate: formatDate(new Date()),
    batteriesPerSet: 5,
    sellingPrice: "",
    purchasePrice: "",
    colorQuantities: [{ color: "", quantity: "" }],
    description: [],
    purchasedInWarranty: false,
  });
  const [tagInput, setTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formWarning, setFormWarning] = useState("");
  const [colorQuantityError, setColorQuantityError] = useState("");
  const [editColorQuantityError, setEditColorQuantityError] = useState("");
  const [isPriceVerified, setIsPriceVerified] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredEntryIndex, setHoveredEntryIndex] = useState(null);
  const [editingEntryIndex, setEditingEntryIndex] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState({}); // Track selected color per entry group
  const formSectionRef = useRef(null);
  const editFormSectionRef = useRef(null);
  const datePickerRef = useRef(null);

  // Check session storage on mount for price auth
  useEffect(() => {
    if (sessionStorage.getItem("modelPriceAuth") === "true") {
      setIsPriceVerified(true);
    }

    // Reset admin security when tab is hidden or page is unloaded
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sessionStorage.removeItem("modelPriceAuth");
        setIsPriceVerified(false);
      }
    };

    const handleBeforeUnload = () => {
      sessionStorage.removeItem("modelPriceAuth");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // Component is unmounting: reset security and listeners
      sessionStorage.removeItem("modelPriceAuth");
      setIsPriceVerified(false);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const handleVerifyPassword = async () => {
    if (!password.trim()) {
      setPasswordError("Please enter admin password");
      return;
    }

    setPasswordLoading(true);
    setPasswordError("");

    try {
      const response = await fetch(`${API_BASE}/admin/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ securityKey: password }),
      });

      const data = await response.json();

      if (data.success) {
        setIsPriceVerified(true);
        setShowPasswordModal(false);
        setPassword("");
        setPasswordError("");
        // Store in sessionStorage for this session
        sessionStorage.setItem("modelPriceAuth", "true");
      } else {
        setPasswordError("Invalid password");
      }
    } catch (err) {
      console.error("Password verification error:", err);
      setPasswordError("Verification failed. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRequestPriceAccess = () => {
    // Check if already verified in this session
    if (sessionStorage.getItem("modelPriceAuth") === "true") {
      setIsPriceVerified(true);
      return;
    }
    setShowPasswordModal(true);
  };

  const fetchModelDetails = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/models/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error fetching model details");
      }

      const modelData = data.data || data;
      console.log("Fetched model data:", modelData);
      console.log("colorQuantities:", modelData.colorQuantities);
      console.log("stockEntries:", modelData.stockEntries);
      console.log("stockEntries length:", modelData.stockEntries?.length || 0);
      console.log("colour:", modelData.colour);
      setModel(modelData);
    } catch (err) {
      setError(err.message || "Error loading model details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchModelDetails();
  }, [fetchModelDetails]);

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

  // Predefined color options
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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewStockEntry((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Handle tag input
  const handleTagInputChange = (e) => {
    setTagInput(e.target.value);
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!newStockEntry.description.includes(newTag)) {
        setNewStockEntry((prev) => ({
          ...prev,
          description: [...prev.description, newTag],
        }));
      }
      setTagInput("");
    } else if (
      e.key === "Backspace" &&
      !tagInput &&
      newStockEntry.description.length > 0
    ) {
      setNewStockEntry((prev) => ({
        ...prev,
        description: prev.description.slice(0, -1),
      }));
    }
  };

  const removeTag = (tagToRemove) => {
    setNewStockEntry((prev) => ({
      ...prev,
      description: prev.description.filter((tag) => tag !== tagToRemove),
    }));
  };

  // Handle color-quantity entries
  const addColorQuantityEntry = () => {
    // Check if the last entry has both color and quantity filled
    const lastEntry =
      newStockEntry.colorQuantities[newStockEntry.colorQuantities.length - 1];
    if (
      !lastEntry.color ||
      !lastEntry.quantity ||
      lastEntry.quantity === "" ||
      parseInt(lastEntry.quantity) <= 0
    ) {
      setColorQuantityError(
        "Please fill both color and quantity before adding a new entry"
      );
      setTimeout(() => setColorQuantityError(""), 3000);
      return;
    }
    setColorQuantityError("");
    setNewStockEntry((prev) => ({
      ...prev,
      colorQuantities: [...prev.colorQuantities, { color: "", quantity: "" }],
    }));
  };

  const removeColorQuantityEntry = (index) => {
    if (newStockEntry.colorQuantities.length > 1) {
      setNewStockEntry((prev) => ({
        ...prev,
        colorQuantities: prev.colorQuantities.filter((_, i) => i !== index),
      }));
    }
  };

  const handleColorQuantityChange = (index, field, value) => {
    setNewStockEntry((prev) => {
      const updated = [...prev.colorQuantities];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      // Clear error if both fields are now filled for the last entry
      const lastIndex = updated.length - 1;
      if (
        index === lastIndex &&
        updated[lastIndex].color &&
        updated[lastIndex].quantity &&
        parseInt(updated[lastIndex].quantity) > 0
      ) {
        setColorQuantityError("");
      }
      return {
        ...prev,
        colorQuantities: updated,
      };
    });
  };

  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditingEntry((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Edit form tag handlers
  const [editTagInput, setEditTagInput] = useState("");
  const handleEditTagInputChange = (e) => {
    setEditTagInput(e.target.value);
  };

  const handleEditTagKeyDown = (e) => {
    if (e.key === "Enter" && editTagInput.trim()) {
      e.preventDefault();
      const newTag = editTagInput.trim();
      if (!editingEntry.description.includes(newTag)) {
        setEditingEntry((prev) => ({
          ...prev,
          description: [...prev.description, newTag],
        }));
      }
      setEditTagInput("");
    } else if (
      e.key === "Backspace" &&
      !editTagInput &&
      editingEntry.description.length > 0
    ) {
      setEditingEntry((prev) => ({
        ...prev,
        description: prev.description.slice(0, -1),
      }));
    }
  };

  const removeEditTag = (tagToRemove) => {
    setEditingEntry((prev) => ({
      ...prev,
      description: prev.description.filter((tag) => tag !== tagToRemove),
    }));
  };

  // Edit form color-quantity handlers
  const addEditColorQuantityEntry = () => {
    // Check if the last entry has both color and quantity filled
    const lastEntry =
      editingEntry.colorQuantities[editingEntry.colorQuantities.length - 1];
    if (
      !lastEntry.color ||
      !lastEntry.quantity ||
      lastEntry.quantity === "" ||
      parseInt(lastEntry.quantity) <= 0
    ) {
      setEditColorQuantityError(
        "Please fill both color and quantity before adding a new entry"
      );
      setTimeout(() => setEditColorQuantityError(""), 3000);
      return;
    }
    setEditColorQuantityError("");
    setEditingEntry((prev) => ({
      ...prev,
      colorQuantities: [...prev.colorQuantities, { color: "", quantity: "" }],
    }));
  };

  const removeEditColorQuantityEntry = (index) => {
    if (editingEntry.colorQuantities.length > 1) {
      setEditingEntry((prev) => ({
        ...prev,
        colorQuantities: prev.colorQuantities.filter((_, i) => i !== index),
      }));
    }
  };

  const handleEditColorQuantityChange = (index, field, value) => {
    setEditingEntry((prev) => {
      const updated = [...prev.colorQuantities];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      // Clear error if both fields are now filled for the last entry
      const lastIndex = updated.length - 1;
      if (
        index === lastIndex &&
        updated[lastIndex].color &&
        updated[lastIndex].quantity &&
        parseInt(updated[lastIndex].quantity) > 0
      ) {
        setEditColorQuantityError("");
      }
      return {
        ...prev,
        colorQuantities: updated,
      };
    });
  };

  const handleSubmitStockEntry = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormWarning("");

    if (!newStockEntry.purchaseDate) {
      setFormError("Purchase date is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const currentStockEntries = model?.stockEntries || [];
      let updatedStockEntries;

      // Filter out entries (no need to check quantity since we removed it)
      const filteredEntries = currentStockEntries.filter((entry) => entry);

      // Duplicate check by purchase date
      const newDate = displayDate(newStockEntry.purchaseDate);
      const hasDuplicateDate = filteredEntries.some(
        (entry) => displayDate(entry.purchaseDate) === newDate
      );
      if (hasDuplicateDate) {
        setFormWarning("A stock entry with this purchase date already exists");
        setTimeout(() => setFormWarning(""), 3000);
        setIsSubmitting(false);
        // Scroll to top to show the warning
        window.scrollTo({ top: 0, behavior: "smooth" });
        // Also scroll to form section if ref is available
        setTimeout(() => {
          formSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
        return;
      }

      // Add the new entry
      // Get description - if empty, use latest entry's description
      let finalDescription = newStockEntry.description || [];
      if (finalDescription.length === 0 && filteredEntries.length > 0) {
        // Sort entries by date (newest first) and get the latest entry's description
        const sortedEntries = [...filteredEntries].sort((a, b) => {
          const dateA = new Date(parseDate(a.purchaseDate || ""));
          const dateB = new Date(parseDate(b.purchaseDate || ""));
          return dateB - dateA;
        });
        const latestEntry = sortedEntries[0];
        if (latestEntry && latestEntry.description && latestEntry.description.length > 0) {
          finalDescription = [...latestEntry.description];
        }
      }

      // Create new stock entry with all fields
      const newEntry = {
        purchaseDate: newStockEntry.purchaseDate,
        batteriesPerSet: parseInt(newStockEntry.batteriesPerSet) || 5,
        sellingPrice: parseFloat(newStockEntry.sellingPrice) || 0,
        purchasePrice: parseFloat(newStockEntry.purchasePrice) || 0,
        colorQuantities: newStockEntry.colorQuantities
          .filter((entry) => entry.color && entry.quantity)
          .map((entry) => ({
            color: entry.color,
            quantity: parseInt(entry.quantity) || 0,
          })),
        description: finalDescription,
        purchasedInWarranty: newStockEntry.purchasedInWarranty || false,
      };

      updatedStockEntries = [...filteredEntries, newEntry];

      // Collect all colors with their TOTAL quantities from all stock entries
      const colorTotals = new Map();
      updatedStockEntries.forEach((entry) => {
        if (entry.colorQuantities && Array.isArray(entry.colorQuantities)) {
          entry.colorQuantities.forEach((cq) => {
            if (cq.color && cq.color.trim() !== "") {
              const prev = colorTotals.get(cq.color) || 0;
              colorTotals.set(
                cq.color,
                prev + (parseInt(cq.quantity, 10) || 0)
              );
            }
          });
        }
      });

      // Convert to colorQuantities array format with aggregated quantity
      const updatedColorQuantities = Array.from(colorTotals.entries()).map(
        ([color, quantity]) => ({
          color,
          quantity,
        })
      );

      // Prepare update data
      const updateData = {
        stockEntries: updatedStockEntries,
        colorQuantities: updatedColorQuantities,
      };

      const response = await fetch(`${API_BASE}/models/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        let errorMessage = "Error adding stock entry";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          // If response is not JSON, try to get text
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      await fetchModelDetails();

      // Reset form
      setNewStockEntry({
        purchaseDate: formatDate(new Date()),
        batteriesPerSet: 5,
        sellingPrice: "",
        purchasePrice: "",
        colorQuantities: [{ color: "", quantity: "" }],
        description: [],
        purchasedInWarranty: false,
      });
      setTagInput("");

      setFormError("");
      setFormWarning("");
    } catch (err) {
      setFormError(err.message || "Error adding stock entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditEntry = (index, entry) => {
    console.log("Editing entry:", entry);
    console.log("Entry colorQuantities:", entry.colorQuantities);
    setEditingEntryIndex(index);
    const colorQuantities =
      entry.colorQuantities && entry.colorQuantities.length > 0
        ? entry.colorQuantities.map((cq) => ({
            color: cq.color || "",
            quantity: cq.quantity || "",
          }))
        : [{ color: "", quantity: "" }];
    console.log("Mapped colorQuantities:", colorQuantities);
    setEditingEntry({
      purchaseDate: entry.purchaseDate || formatDate(new Date()),
      batteriesPerSet: entry.batteriesPerSet || model?.batteriesPerSet || 5,
      sellingPrice: entry.sellingPrice || "",
      purchasePrice: entry.purchasePrice || "",
      colorQuantities: colorQuantities,
      description: entry.description || model?.description || [],
      purchasedInWarranty:
        entry.purchasedInWarranty !== undefined
          ? entry.purchasedInWarranty
          : model?.purchasedInWarranty || false,
    });
    setEditTagInput("");
    
    // Scroll to edit form after state is updated
    setTimeout(() => {
      editFormSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    if (!editingEntry.purchaseDate) {
      setFormError("Purchase date is required");
      return;
    }

    try {
      const currentStockEntries = model?.stockEntries || [];
      const filteredEntries = currentStockEntries.filter(
        (_, idx) => idx !== editingEntryIndex
      );

      const newDate = displayDate(editingEntry.purchaseDate);
      const hasDuplicateDate = filteredEntries.some(
        (e) => displayDate(e.purchaseDate) === newDate
      );
      if (hasDuplicateDate) {
        setFormWarning("A stock entry with this purchase date already exists");
        setTimeout(() => setFormWarning(""), 3000);
        // Scroll to top to show the warning
        window.scrollTo({ top: 0, behavior: "smooth" });
        // Also scroll to form section if ref is available
        setTimeout(() => {
          formSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
        return;
      }

      // Get description - if empty, use latest entry's description (excluding current entry)
      let finalDescription = editingEntry.description || [];
      if (finalDescription.length === 0 && filteredEntries.length > 0) {
        // Sort entries by date (newest first) and get the latest entry's description
        const sortedEntries = [...filteredEntries].sort((a, b) => {
          const dateA = new Date(parseDate(a.purchaseDate || ""));
          const dateB = new Date(parseDate(b.purchaseDate || ""));
          return dateB - dateA;
        });
        const latestEntry = sortedEntries[0];
        if (latestEntry && latestEntry.description && latestEntry.description.length > 0) {
          finalDescription = [...latestEntry.description];
        }
      }

      const updatedStockEntries = [...currentStockEntries];
      updatedStockEntries[editingEntryIndex] = {
        purchaseDate: editingEntry.purchaseDate,
        batteriesPerSet: parseInt(editingEntry.batteriesPerSet) || 5,
        sellingPrice: parseFloat(editingEntry.sellingPrice) || 0,
        purchasePrice: parseFloat(editingEntry.purchasePrice) || 0,
        colorQuantities: editingEntry.colorQuantities
          .filter((entry) => entry.color && entry.quantity)
          .map((entry) => ({
            color: entry.color,
            quantity: parseInt(entry.quantity) || 0,
          })),
        description: finalDescription,
        purchasedInWarranty: editingEntry.purchasedInWarranty || false,
      };

      // Collect all colors with their TOTAL quantities from all stock entries
      const colorTotals = new Map();
      updatedStockEntries.forEach((entry) => {
        if (entry.colorQuantities && Array.isArray(entry.colorQuantities)) {
          entry.colorQuantities.forEach((cq) => {
            if (cq.color && cq.color.trim() !== "") {
              const prev = colorTotals.get(cq.color) || 0;
              colorTotals.set(
                cq.color,
                prev + (parseInt(cq.quantity, 10) || 0)
              );
            }
          });
        }
      });

      // Convert to colorQuantities array format with aggregated quantity
      const updatedColorQuantities = Array.from(colorTotals.entries()).map(
        ([color, quantity]) => ({
          color,
          quantity,
        })
      );

      // Prepare update data
      const updateData = {
        stockEntries: updatedStockEntries,
        colorQuantities: updatedColorQuantities,
      };

      const response = await fetch(`${API_BASE}/models/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        let errorMessage = "Failed to update stock entry";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      await fetchModelDetails();
      setEditingEntryIndex(null);
      setEditingEntry(null);
      setFormError("");
      setFormWarning("");
    } catch (error) {
      console.error("Error updating stock entry:", error);
      setFormError(error.message || "Failed to update stock entry");
    }
  };

  const handleCancelEdit = () => {
    setEditingEntryIndex(null);
    setEditingEntry(null);
    setEditTagInput("");
    setFormError("");
    setFormWarning("");
  };

  const handleDeleteStockEntry = async (index) => {
    if (!window.confirm("Are you sure you want to delete this stock entry?")) {
      return;
    }

    try {
      const currentStockEntries = model?.stockEntries || [];
      const updatedStockEntries = currentStockEntries.filter(
        (_, idx) => idx !== index
      );

      // Collect all unique colors from remaining stock entries
      const allColors = new Set();
      updatedStockEntries.forEach((entry) => {
        if (entry.colorQuantities && Array.isArray(entry.colorQuantities)) {
          entry.colorQuantities.forEach((cq) => {
            if (cq.color && cq.color.trim() !== "") {
              const prev = allColors.get(cq.color) || 0;
              allColors.set(
                cq.color,
                prev + (parseInt(cq.quantity, 10) || 0)
              );
            }
          });
        }
      });

      // Convert to colorQuantities array format
      const updatedColorQuantities = Array.from(allColors.entries()).map(
        ([color, quantity]) => ({
          color,
          quantity,
        })
      );

      const response = await fetch(`${API_BASE}/models/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          stockEntries: updatedStockEntries,
          colorQuantities: updatedColorQuantities,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete stock entry");
      }

      await fetchModelDetails();
    } catch (error) {
      console.error("Error deleting stock entry:", error);
      setFormError(error.message || "Failed to delete stock entry");
    }
  };

  const handleDeleteColorFromEntry = async (entryIndex, colorIndex) => {
    const entry = model?.stockEntries?.[entryIndex];
    if (!entry) return;

    const colorToDelete = entry.colorQuantities?.[colorIndex];
    if (!colorToDelete) return;

    // Prevent deleting if it's the last color
    if (entry.colorQuantities.length <= 1) {
      if (!window.confirm("This is the last color in this entry. Deleting it will remove the entire entry. Do you want to continue?")) {
        return;
      }
      // If confirmed, delete the entire entry
      await handleDeleteStockEntry(entryIndex);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${colorToDelete.color} (${colorToDelete.quantity}) from this entry?`)) {
      return;
    }

    try {
      const currentStockEntries = model?.stockEntries || [];
      const updatedStockEntries = [...currentStockEntries];
      
      // Remove the color from the entry's colorQuantities
      updatedStockEntries[entryIndex] = {
        ...updatedStockEntries[entryIndex],
        colorQuantities: updatedStockEntries[entryIndex].colorQuantities.filter(
          (_, idx) => idx !== colorIndex
        ),
      };

      // Collect all unique colors from all stock entries
      const allColors = new Set();
      updatedStockEntries.forEach((entry) => {
        if (entry.colorQuantities && Array.isArray(entry.colorQuantities)) {
          entry.colorQuantities.forEach((cq) => {
            if (cq.color && cq.color.trim() !== "") {
              const prev = allColors.get(cq.color) || 0;
              allColors.set(
                cq.color,
                prev + (parseInt(cq.quantity, 10) || 0)
              );
            }
          });
        }
      });

      // Convert to colorQuantities array format
      const updatedColorQuantities = Array.from(allColors.entries()).map(
        ([color, quantity]) => ({
          color,
          quantity,
        })
      );

      const response = await fetch(`${API_BASE}/models/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          stockEntries: updatedStockEntries,
          colorQuantities: updatedColorQuantities,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete color from entry");
      }

      await fetchModelDetails();
    } catch (error) {
      console.error("Error deleting color from entry:", error);
      setFormError(error.message || "Failed to delete color from entry");
    }
  };

  // Date picker helpers
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handleDateSelect = (day) => {
    const selectedDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    const formattedDate = formatDate(selectedDate);
    setNewStockEntry((prev) => ({ ...prev, purchaseDate: formattedDate }));
    setShowDatePicker(false);
  };

  const handleEditDateSelect = (day) => {
    const selectedDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    const formattedDate = formatDate(selectedDate);
    setEditingEntry((prev) => ({ ...prev, purchaseDate: formattedDate }));
    setShowEditDatePicker(false);
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <div>Loading model details...</div>
      </div>
    );
  }

  if (error && !model) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</div>
        <button
          onClick={() => navigate("/models/all")}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          Back to Models
        </button>
      </div>
    );
  }

  const sortedEntries = sortEntriesByDate(model?.stockEntries || []);
  const groupedEntries = groupEntriesByDate(sortedEntries);

  // Calculate colors with quantities from all stock entries dynamically
  const getColorsWithQuantities = () => {
    const colorMap = new Map();
    if (model?.stockEntries && Array.isArray(model.stockEntries)) {
      model.stockEntries.forEach((entry) => {
        if (entry.colorQuantities && Array.isArray(entry.colorQuantities)) {
          entry.colorQuantities.forEach((cq) => {
            if (cq.color && cq.color.trim() !== "") {
              const currentQuantity = colorMap.get(cq.color) || 0;
              colorMap.set(cq.color, currentQuantity + (parseInt(cq.quantity) || 0));
            }
          });
        }
      });
    }
    // Convert map to array of objects with color and quantity
    return Array.from(colorMap.entries()).map(([color, quantity]) => ({
      color,
      quantity,
    }));
  };

  const colorsWithQuantities = getColorsWithQuantities();

  // Calculate total quantity and total value from all entries
  const calculateTotals = () => {
    let totalQuantity = 0;
    let totalValue = 0;

    if (model?.stockEntries && Array.isArray(model.stockEntries)) {
      model.stockEntries.forEach((entry) => {
        // Calculate quantity from this entry's colorQuantities
        const entryQuantity = entry.colorQuantities
          ? entry.colorQuantities.reduce(
              (sum, cq) => sum + (parseInt(cq.quantity) || 0),
              0
            )
          : 0;
        
        totalQuantity += entryQuantity;

        // Calculate value for this entry
        const entryPurchasePrice = parseFloat(entry.purchasePrice) || 0;
        const entryValue = entryQuantity * entryPurchasePrice;
        totalValue += entryValue;
      });
    }

    return { totalQuantity, totalValue };
  };

  const { totalQuantity: grandTotalQuantity, totalValue: grandTotalValue } = calculateTotals();

  return (
    <div style={style}>
      <button
        onClick={() => navigate("/models/all")}
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
        Back to Models →
      </button>
      <div
        style={{
          backgroundColor: "white",
          padding: "2rem",
          borderRadius: "0.5rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "1rem", color: "#1f2937" }}>
            Model Details
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#374151",
                }}
              >
                Model Name
              </label>
              <input
                type="text"
                value={model?.modelName || ""}
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
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#374151",
                }}
              >
                Company
              </label>
              <input
                type="text"
                value={model?.company || ""}
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
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#374151",
                }}
              >
                Colour
              </label>
              <div
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  backgroundColor: "#f9fafb",
                  minHeight: "2.5rem",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "center",
                }}
              >
                {colorsWithQuantities.length > 0 ? (
                  colorsWithQuantities.map((entry, index) => (
                    <span
                      key={index}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.25rem 0.5rem",
                        backgroundColor: "#e0e7ff",
                        color: "#3730a3",
                        borderRadius: "0.25rem",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                      }}
                    >
                      {entry.color}
                      {entry.quantity > 0 && (
                        <span
                          style={{
                            backgroundColor: "#6366f1",
                            color: "white",
                            padding: "0.125rem 0.375rem",
                            borderRadius: "0.125rem",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                          }}
                        >
                          {entry.quantity}
                        </span>
                      )}
                    </span>
                  ))
                ) : model?.colour && model.colour.trim() !== "" ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.25rem 0.5rem",
                      backgroundColor: "#e0e7ff",
                      color: "#3730a3",
                      borderRadius: "0.25rem",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                    }}
                  >
                    {model.colour}
                  </span>
                ) : (
                  <span style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
                    No colors specified
                  </span>
                )}
              </div>
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
                Add New Stock Entry
              </h3>
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
                  <div style={{ position: "relative" }}>
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
                        border: "1px solid #d1d5db",
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                        backgroundColor: "#ffffff",
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
                </div>

                {/* Purchase Information */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      color: "#374151",
                      fontWeight: "500",
                    }}
                  >
                    Purchase Information
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="purchasedInWarranty"
                      checked={newStockEntry.purchasedInWarranty}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      style={{
                        width: "16px",
                        height: "16px",
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                      }}
                    />
                    <label
                      htmlFor="purchasedInWarranty"
                      style={{
                        margin: 0,
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                        fontSize: "0.9rem",
                        color: "#333",
                      }}
                    >
                      Purchased in Warranty
                    </label>
                  </div>
                  <small
                    style={{
                      display: "block",
                      marginTop: "0.25rem",
                      color: "#666",
                      fontSize: "0.8rem",
                    }}
                  >
                    Check if this model was purchased under warranty
                  </small>
                </div>
              </div>

              {/* Batteries Per Set, Selling Price, and Purchase Price */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
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
                    Batteries Per Set *
                  </label>
                  <select
                    name="batteriesPerSet"
                    value={newStockEntry.batteriesPerSet}
                    onChange={handleInputChange}
                    required
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
                    <option value={5}>5 batteries</option>
                    <option value={6}>6 batteries</option>
                  </select>
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
                    Selling Price (per {newStockEntry.batteriesPerSet} batteries) *
                  </label>
                  <input
                    type="number"
                    name="sellingPrice"
                    value={newStockEntry.sellingPrice}
                    onChange={handleInputChange}
                    placeholder={`Enter selling price for ${newStockEntry.batteriesPerSet} batteries`}
                    min="0"
                    step="0.01"
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
                {isPriceVerified ? (
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        color: "#374151",
                        fontWeight: "500",
                      }}
                    >
                      Purchase Price (per {newStockEntry.batteriesPerSet} batteries) *
                    </label>
                    <input
                      type="number"
                      name="purchasePrice"
                      value={newStockEntry.purchasePrice}
                      onChange={handleInputChange}
                      placeholder={`Enter purchase price for ${newStockEntry.batteriesPerSet} batteries`}
                      min="0"
                      step="0.01"
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
                ) : (
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        color: "#374151",
                        fontWeight: "500",
                      }}
                    >
                      Purchase Price (per {newStockEntry.batteriesPerSet} batteries) *
                    </label>
                    <button
                      type="button"
                      onClick={handleRequestPriceAccess}
                      style={{
                        padding: "0.5rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                        width: "100%",
                        backgroundColor: "#f3f4f6",
                        cursor: "pointer",
                        color: "#6b7280",
                      }}
                    >
                      🔒 Click to enter purchase price
                    </button>
                  </div>
                )}
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
                  Color & Quantity
                </label>
                {newStockEntry.colorQuantities.map((entry, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1 }}>
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
                          // Get all selected colors except the current entry
                          const selectedColors = newStockEntry.colorQuantities
                            .map((e, i) => (i !== index ? e.color : ""))
                            .filter((c) => c && c !== "");
                          const isDisabled = selectedColors.includes(
                            color.value
                          );
                          return (
                            <option
                              key={color.value}
                              value={color.value}
                              disabled={isDisabled}
                            >
                              {color.label}{" "}
                              {isDisabled ? "(already selected)" : ""}
                            </option>
                          );
                        })}
                        <option
                          value="other"
                          disabled={
                            newStockEntry.colorQuantities
                              .map((e, i) => (i !== index ? e.color : ""))
                              .filter((c) => c === "other").length > 0
                          }
                        >
                          Other (specify){" "}
                          {newStockEntry.colorQuantities
                            .map((e, i) => (i !== index ? e.color : ""))
                            .filter((c) => c === "other").length > 0
                            ? "(already selected)"
                            : ""}
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
                                    : colorOptions.find(
                                        (c) => c.value === entry.color
                                      )?.hex || "#f5f5f5",
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
                                ? "Custom"
                                : "No color"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
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

              {/* Description (Tags) Section */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    color: "#374151",
                    fontWeight: "500",
                  }}
                >
                  Description (Tags) *
                </label>
                <div
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    padding: "0.5rem",
                    minHeight: "60px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    alignItems: "center",
                    backgroundColor: "#fff",
                  }}
                >
                  {newStockEntry.description.map((tag, index) => (
                    <span
                      key={index}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.25rem 0.5rem",
                        backgroundColor: "#6366f1",
                        color: "#fff",
                        borderRadius: "0.25rem",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "1rem",
                          padding: "0",
                          marginLeft: "0.25rem",
                          display: "flex",
                          alignItems: "center",
                          lineHeight: "1",
                        }}
                        disabled={isSubmitting}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={handleTagInputChange}
                    onKeyDown={handleTagKeyDown}
                    placeholder={
                      newStockEntry.description.length === 0
                        ? "Type and press Enter to add tags"
                        : "Add more tags..."
                    }
                    disabled={isSubmitting}
                    style={{
                      border: "none",
                      outline: "none",
                      flex: 1,
                      minWidth: "150px",
                      fontSize: "0.9rem",
                      padding: "0.25rem",
                    }}
                  />
                </div>
                <small
                  style={{
                    display: "block",
                    marginTop: "0.25rem",
                    color: "#666",
                    fontSize: "0.8rem",
                  }}
                >
                  Press Enter to add a tag. Press Backspace to remove the last
                  tag.
                </small>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  {isSubmitting ? "Saving..." : "Add Stock Entry"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Stock Entry Section */}
        {editingEntryIndex !== null && editingEntry && (
          <div 
            id="edit-stock-form-section"
            ref={editFormSectionRef}
            style={{ marginBottom: "2rem" }}
          >
            <h3
              style={{
                marginBottom: "1.5rem",
                color: "#1f2937",
                fontSize: "1.25rem",
                fontWeight: "600",
              }}
            >
              Edit Stock Entry
            </h3>
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
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      name="purchaseDate"
                      value={editingEntry.purchaseDate || ""}
                      onChange={handleEditInputChange}
                      onFocus={() => setShowEditDatePicker(true)}
                      placeholder="DD/MM/YYYY"
                      required
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                      }}
                    />
                    {showEditDatePicker && (
                      <div
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
                              currentDateString === editingEntry.purchaseDate;
                            const isToday =
                              currentDateString === formatDate(new Date());
                            const isFuture =
                              currentDate >
                              new Date().setHours(23, 59, 59, 999);
                            return (
                              <div
                                key={i}
                                onClick={() =>
                                  !isFuture && handleEditDateSelect(dayNumber)
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
                </div>

                {/* Purchase Information */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      color: "#374151",
                      fontWeight: "500",
                    }}
                  >
                    Purchase Information
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="purchasedInWarranty"
                      checked={editingEntry.purchasedInWarranty || false}
                      onChange={handleEditInputChange}
                      style={{
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                      }}
                    />
                    <label
                      htmlFor="purchasedInWarranty"
                      style={{
                        margin: 0,
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        color: "#333",
                      }}
                    >
                      Purchased in Warranty
                    </label>
                  </div>
                  <small
                    style={{
                      display: "block",
                      marginTop: "0.25rem",
                      color: "#666",
                      fontSize: "0.8rem",
                    }}
                  >
                    Check if this model was purchased under warranty
                  </small>
                </div>
              </div>

              {/* Batteries Per Set, Selling Price, and Purchase Price */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
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
                    Batteries Per Set *
                  </label>
                  <select
                    name="batteriesPerSet"
                    value={editingEntry.batteriesPerSet || 5}
                    onChange={handleEditInputChange}
                    required
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value={5}>5 batteries</option>
                    <option value={6}>6 batteries</option>
                  </select>
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
                    Selling Price (per {editingEntry.batteriesPerSet || 5} batteries) *
                  </label>
                  <input
                    type="number"
                    name="sellingPrice"
                    value={editingEntry.sellingPrice || ""}
                    onChange={handleEditInputChange}
                    placeholder={`Enter selling price for ${editingEntry.batteriesPerSet || 5} batteries`}
                    min="0"
                    step="0.01"
                    required
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
                {isPriceVerified ? (
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        color: "#374151",
                        fontWeight: "500",
                      }}
                    >
                      Purchase Price (per {editingEntry.batteriesPerSet || 5} batteries) *
                    </label>
                    <input
                      type="number"
                      name="purchasePrice"
                      value={editingEntry.purchasePrice || ""}
                      onChange={handleEditInputChange}
                      placeholder={`Enter purchase price for ${editingEntry.batteriesPerSet || 5} batteries`}
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
                  </div>
                ) : (
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.5rem",
                        color: "#374151",
                        fontWeight: "500",
                      }}
                    >
                      Purchase Price (per {editingEntry.batteriesPerSet || 5} batteries) *
                    </label>
                    <button
                      type="button"
                      onClick={handleRequestPriceAccess}
                      style={{
                        padding: "0.5rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                        width: "100%",
                        backgroundColor: "#f3f4f6",
                        cursor: "pointer",
                        color: "#6b7280",
                      }}
                    >
                      🔒 Click to enter purchase price
                    </button>
                  </div>
                )}
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
                  Color & Quantity
                </label>
                {(editingEntry.colorQuantities || []).map((entry, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1 }}>
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
                        value={entry.color || ""}
                        onChange={(e) =>
                          handleEditColorQuantityChange(
                            index,
                            "color",
                            e.target.value
                          )
                        }
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
                          // Get all selected colors except the current entry
                          const selectedColors = (
                            editingEntry.colorQuantities || []
                          )
                            .map((e, i) => (i !== index ? e.color : ""))
                            .filter((c) => c && c !== "");
                          const isDisabled = selectedColors.includes(
                            color.value
                          );
                          return (
                            <option
                              key={color.value}
                              value={color.value}
                              disabled={isDisabled}
                            >
                              {color.label}{" "}
                              {isDisabled ? "(already selected)" : ""}
                            </option>
                          );
                        })}
                        <option
                          value="other"
                          disabled={
                            (editingEntry.colorQuantities || [])
                              .map((e, i) => (i !== index ? e.color : ""))
                              .filter((c) => c === "other").length > 0
                          }
                        >
                          Other (specify){" "}
                          {(editingEntry.colorQuantities || [])
                            .map((e, i) => (i !== index ? e.color : ""))
                            .filter((c) => c === "other").length > 0
                            ? "(already selected)"
                            : ""}
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
                                    : colorOptions.find(
                                        (c) => c.value === entry.color
                                      )?.hex || "#f5f5f5",
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
                                ? "Custom"
                                : "No color"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
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
                        value={entry.quantity || ""}
                        onChange={(e) =>
                          handleEditColorQuantityChange(
                            index,
                            "quantity",
                            e.target.value
                          )
                        }
                        placeholder="Quantity"
                        min="0"
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
                    {(editingEntry.colorQuantities || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEditColorQuantityEntry(index)}
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
                        title="Remove color entry"
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
                    onClick={addEditColorQuantityEntry}
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
                  {editColorQuantityError && (
                    <span
                      style={{
                        color: "#dc2626",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {editColorQuantityError}
                    </span>
                  )}
                </div>
              </div>

              {/* Description (Tags) Section */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    color: "#374151",
                    fontWeight: "500",
                  }}
                >
                  Description (Tags) *
                </label>
                <div
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    padding: "0.5rem",
                    minHeight: "60px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    alignItems: "center",
                    backgroundColor: "#fff",
                  }}
                >
                  {(editingEntry.description || []).map((tag, index) => (
                    <span
                      key={index}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.25rem 0.5rem",
                        backgroundColor: "#6366f1",
                        color: "#fff",
                        borderRadius: "0.25rem",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeEditTag(tag)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "1rem",
                          padding: "0",
                          marginLeft: "0.25rem",
                          display: "flex",
                          alignItems: "center",
                          lineHeight: "1",
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={editTagInput}
                    onChange={handleEditTagInputChange}
                    onKeyDown={handleEditTagKeyDown}
                    placeholder={
                      (editingEntry.description || []).length === 0
                        ? "Type and press Enter to add tags"
                        : "Add more tags..."
                    }
                    style={{
                      border: "none",
                      outline: "none",
                      flex: 1,
                      minWidth: "150px",
                      fontSize: "0.9rem",
                      padding: "0.25rem",
                    }}
                  />
                </div>
                <small
                  style={{
                    display: "block",
                    marginTop: "0.25rem",
                    color: "#666",
                    fontSize: "0.8rem",
                  }}
                >
                  Press Enter to add a tag. Press Backspace to remove the last
                  tag.
                </small>
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
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* All Stock Entries Section */}
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
              All Stock Entries
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
                  backgroundColor:
                    model?.stockEntries?.length > 0 ? "#10b981" : "#f59e0b",
                }}
              ></div>
              {model?.stockEntries?.length || 0} entries
            </div>
          </div>

          {groupedEntries.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              {groupedEntries.map((group, groupIndex) => {
                const firstEntry = group.entries[0];
                const originalIndex = model.stockEntries.findIndex(
                  (e) => displayDate(e.purchaseDate) === group.date
                );
                // Get data from the specific stock entry
                const entryColorQuantities = firstEntry?.colorQuantities || [];
                const entryBatteriesPerSet = firstEntry?.batteriesPerSet || 5;
                // Ensure purchase price is parsed as a number
                const entryPurchasePrice = parseFloat(firstEntry?.purchasePrice) || 0;
                const entrySellingPrice = parseFloat(firstEntry?.sellingPrice) || 0;
                const entryDescription = firstEntry?.description || [];
                const entryPurchasedInWarranty =
                  firstEntry?.purchasedInWarranty || false;

                // Calculate total quantity from this entry's colorQuantities
                const totalQuantity = entryColorQuantities.reduce(
                  (sum, cq) => sum + (parseInt(cq.quantity) || 0),
                  0
                );
                // Price per piece is the same as purchase price entered
                const pricePerPiece = entryPurchasePrice;
                // Calculate total purchase price (total quantity × purchase price)
                const totalValue = totalQuantity * entryPurchasePrice;

                return (
                  <div
                    key={group.date}
                    style={{
                      backgroundColor: "white",
                      border: "3px solid #e5e7eb",
                      borderRadius: "0.5rem",
                      padding: "1.5rem",
                    }}
                  >
                    {/* Date Header */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1rem",
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "1rem",
                          fontWeight: "600",
                          color: "#1f2937",
                        }}
                      >
                        {group.date}
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "center",
                        }}
                      >
                      <button
                        onClick={() => {
                          if (originalIndex !== -1) {
                            handleEditEntry(originalIndex, firstEntry);
                          }
                        }}
                        style={{
                          backgroundColor: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "0.375rem",
                          padding: "0.5rem 1rem",
                          fontSize: "0.875rem",
                          fontWeight: "500",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>Edit</span>
                      </button>
                        <button
                          onClick={() => {
                            if (originalIndex !== -1) {
                              handleDeleteStockEntry(originalIndex);
                            }
                          }}
                          style={{
                            backgroundColor: "#dc2626",
                            color: "white",
                            border: "none",
                            borderRadius: "0.375rem",
                            padding: "0.5rem 1rem",
                            fontSize: "0.875rem",
                            fontWeight: "500",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                        marginBottom: "1rem",
                        padding: "0.75rem",
                        backgroundColor: "#f9fafb",
                        borderRadius: "0.375rem",
                      }}
                    >
                      {entryBatteriesPerSet && (
                        <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                          <strong>Batteries Per Set:</strong>{" "}
                          {entryBatteriesPerSet}
                        </div>
                      )}
                        <div
                          style={{
                            fontSize: "0.875rem",
                          color: entryPurchasedInWarranty ? "#10b981" : "#dc2626",
                            fontWeight: "500",
                          }}
                        >
                        {entryPurchasedInWarranty ? "✓ Purchased in Warranty" : "✗ Not Purchased in Warranty"}
                        </div>
                    </div>

                    {/* Description Tags */}
                    {entryDescription && entryDescription.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                          marginBottom: "1rem",
                        }}
                      >
                        {entryDescription.map((tag, tagIndex) => (
                          <span
                            key={tagIndex}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "0.25rem 0.5rem",
                              backgroundColor: "#6366f1",
                              color: "#fff",
                              borderRadius: "0.25rem",
                              fontSize: "0.75rem",
                              fontWeight: "500",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Color Bars */}
                    {entryColorQuantities && entryColorQuantities.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                          marginBottom: "1rem",
                        }}
                      >
                        {entryColorQuantities.map((cq, cqIndex) => {
                          const entryKey = `${group.date}-${originalIndex}`;
                          const isSelected =
                            selectedColorIndex[entryKey] === cqIndex ||
                            (selectedColorIndex[entryKey] === undefined &&
                              cqIndex === 0);
                          return (
                            <div
                              key={cqIndex}
                              onClick={() => {
                                setSelectedColorIndex((prev) => ({
                                  ...prev,
                                  [entryKey]: cqIndex,
                                }));
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                backgroundColor: isSelected
                                  ? "#3b82f6"
                                  : "transparent",
                                padding: "0.5rem 0.75rem",
                                borderRadius: "0.375rem",
                                border: isSelected
                                  ? "none"
                                  : "1px solid #e5e7eb",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor =
                                    "#f3f4f6";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor =
                                    "transparent";
                                }
                              }}
                            >
                              <div
                                style={{
                                  width: "24px",
                                  height: "24px",
                                  borderRadius: "50%",
                                  backgroundColor: getColourDisplay(cq.color),
                                  border:
                                    cq.color?.toLowerCase() === "white"
                                      ? "1px solid #d1d5db"
                                      : "none",
                                }}
                              />
                              <span
                                style={{
                                  color: isSelected ? "white" : "#374151",
                                  fontWeight: "500",
                                  fontSize: "0.875rem",
                                }}
                              >
                                {cq.color} ({cq.quantity || 0})
                              </span>
                              {isSelected && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "0.5rem",
                                    marginLeft: "0.5rem",
                                  }}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (originalIndex !== -1) {
                                        handleDeleteColorFromEntry(originalIndex, cqIndex);
                                      }
                                    }}
                                    style={{
                                      background: "rgba(255, 255, 255, 0.2)",
                                      border: "none",
                                      borderRadius: "0.25rem",
                                      padding: "0.25rem",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                    }}
                                    title="Delete Color"
                                  >
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="white"
                                      strokeWidth="2"
                                    >
                                      <polyline points="3 6 5 6 21 6"></polyline>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {/* Details Card */}
                    <div
                      style={{
                        backgroundColor: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        borderRadius: "0.5rem",
                        padding: "1rem",
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#6b7280",
                            marginBottom: "0.25rem",
                          }}
                        >
                          Quantity
                        </div>
                        <div
                          style={{
                            fontWeight: "700",
                            color: "#1f2937",
                            fontSize: "1rem",
                          }}
                        >
                          {totalQuantity}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#6b7280",
                            marginBottom: "0.25rem",
                          }}
                        >
                          Selling Price
                        </div>
                        {entrySellingPrice > 0 ? (
                          <div
                            style={{
                              fontWeight: "700",
                              color: "#3b82f6",
                              fontSize: "1rem",
                            }}
                          >
                            ₹{entrySellingPrice.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            <span
                              style={{
                                fontSize: "0.875rem",
                                fontWeight: "400",
                                color: "#6b7280",
                                marginLeft: "0.5rem",
                              }}
                            >
                              (per pc)
                            </span>
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: "0.875rem",
                              color: "#9ca3af",
                              fontStyle: "italic",
                            }}
                          >
                            Not set
                          </div>
                        )}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#6b7280",
                            marginBottom: "0.25rem",
                          }}
                        >
                          Value
                        </div>
                        {entryPurchasePrice === 0 ? (
                          <div
                            style={{
                              fontSize: "0.875rem",
                              color: "#f59e0b",
                              fontStyle: "italic",
                              padding: "0.5rem",
                              backgroundColor: "#fef3c7",
                              borderRadius: "0.375rem",
                              border: "1px solid #fcd34d",
                            }}
                          >
                            Purchase price not set. Please edit entry to add purchase price.
                          </div>
                        ) : isPriceVerified ? (
                          <div
                            style={{
                              fontWeight: "700",
                              color: "#10b981",
                              fontSize: "1rem",
                            }}
                          >
                            ₹
                            {totalValue.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            {pricePerPiece > 0 && (
                              <span
                                style={{
                                  fontSize: "0.875rem",
                                  fontWeight: "400",
                                  color: "#6b7280",
                                  marginLeft: "0.5rem",
                                }}
                              >
                                (₹{pricePerPiece.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })} per pc)
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleRequestPriceAccess}
                            style={{
                              padding: "0.5rem",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.375rem",
                              fontSize: "0.875rem",
                              width: "100%",
                              backgroundColor: "#f3f4f6",
                              cursor: "pointer",
                              color: "#6b7280",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "0.25rem",
                            }}
                          >
                            <span>🔒</span>
                            <span>Click to view total value</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
                No stock entries found
              </p>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
                Add stock entries to start tracking inventory
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Summary Section - Total Quantity and Total Value */}
      {groupedEntries.length > 0 && (
        <div
          style={{
            marginTop: "2rem",
            marginBottom: "2rem",
            padding: "1.5rem",
            backgroundColor: "#f9fafb",
            border: "2px solid #e5e7eb",
            borderRadius: "0.5rem",
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: "1.5rem",
              color: "#1f2937",
              fontSize: "1.25rem",
              fontWeight: "600",
            }}
          >
            Summary
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2rem",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "#6b7280",
                  marginBottom: "0.5rem",
                }}
              >
                Total Quantity
              </div>
              <div
                style={{
                  fontWeight: "700",
                  color: "#1f2937",
                  fontSize: "1.5rem",
                }}
              >
                {grandTotalQuantity.toLocaleString("en-IN")}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "#6b7280",
                  marginBottom: "0.5rem",
                }}
              >
                Total Value
              </div>
              {isPriceVerified ? (
                <div
                  style={{
                    fontWeight: "700",
                    color: "#10b981",
                    fontSize: "1.5rem",
                  }}
                >
                  ₹
                  {grandTotalValue.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestPriceAccess}
                  style={{
                    padding: "0.75rem 1rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                    width: "100%",
                    backgroundColor: "#f3f4f6",
                    cursor: "pointer",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    fontWeight: "500",
                  }}
                >
                  <span>🔒</span>
                  <span>Enter password to view total value</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
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
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => {
            setShowPasswordModal(false);
            setPassword("");
            setPasswordError("");
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "2rem",
              borderRadius: "0.5rem",
              width: "90%",
              maxWidth: "400px",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: "0 0 1rem 0",
                fontSize: "1.25rem",
                fontWeight: 600,
              }}
            >
              Admin Password Required
            </h3>
            <p style={{ marginBottom: "1.5rem", color: "#6b7280" }}>
              Enter admin password to access purchase price field
            </p>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError("");
                  }}
                  placeholder="Enter admin password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleVerifyPassword();
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "0.75rem 2.5rem 0.75rem 0.75rem",
                    border: passwordError
                      ? "1px solid #dc2626"
                      : "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? "Hide password" : "Show password"}
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
                  {showPassword ? (
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
              {passwordError && (
                <div
                  style={{
                    color: "#dc2626",
                    fontSize: "0.875rem",
                    marginTop: "0.5rem",
                  }}
                >
                  {passwordError}
                </div>
              )}
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
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword("");
                  setPasswordError("");
                }}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyPassword}
                disabled={passwordLoading}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: passwordLoading ? "#9ca3af" : "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: passwordLoading ? "not-allowed" : "pointer",
                }}
              >
                {passwordLoading ? "Verifying..." : "Verify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddMoreStock;
