import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import SparePartsSearch from "../../components/SparePartsSearch";

// Helper function to check if a value is a valid MongoDB ObjectId
const isValidObjectId = (id) => {
  if (!id) return false;
  // If it's already an ObjectId object, it's valid
  if (id.toString && typeof id.toString === 'function') {
    const idStr = id.toString();
    return /^[0-9a-fA-F]{24}$/.test(idStr);
  }
  // If it's a string, check if it's 24 hex characters
  if (typeof id === 'string') {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
  return false;
};

export default function EditJobcardModal({ jobcard, onClose, onSuccess }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    customerName: jobcard?.customerName || "",
    place: jobcard?.place || "",
    mobile: jobcard?.mobile || "",
    charger: jobcard?.charger === "yes" ? "yes" : "no",
    mechanic: jobcard?.mechanic || "",
    billNo: jobcard?.billNo || "",
    warrantyType: jobcard?.warrantyType || "none",
    warrantyDate: jobcard?.warrantyDate || "",
    details: jobcard?.details || [],
  });

  const [detailInput, setDetailInput] = useState("");
  const [selectedParts, setSelectedParts] = useState([]);
  const [activeTab, setActiveTab] = useState(jobcard?.jobcardType || "service"); // service | replacement | sales
  const [showPartsList, setShowPartsList] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCustomSpare, setShowCustomSpare] = useState(false);
  const [customSpareData, setCustomSpareData] = useState({
    name: "",
    price: "",
    quantity: "1",
    color: "",
  });
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const errorRef = useRef(null);
  const isAddingPartRef = useRef(false);

  // Load jobcard parts
  useEffect(() => {
    if (jobcard && jobcard.parts) {
      // Fetch full spare details for each part
      const loadParts = async () => {
        const partsWithDetails = await Promise.all(
          jobcard.parts.map(async (part) => {
            // Custom / non-inventory lines (e.g. old charger sale) have no spareId — do not call spares API or fields get dropped.
            if (!part.spareId || part.isCustom) {
              return {
                id: part.spareId || part._id || part.id || `custom-${part.spareName || "part"}`,
                name: part.spareName,
                price: Number(part.price || 0),
                quantity: 0,
                selectedQuantity: Number(part.quantity || 1),
                selectedColor: part.selectedColor || null,
                inventoryQuantity: 0,
                hasColors: false,
                colorQuantity: [],
                availableColors: [],
                isCustom: true,
                partType: part.partType || "sales",
                salesType: part.salesType || null,
                scrapAvailable: part.scrapAvailable || false,
                scrapQuantity: Number(part.scrapQuantity || 0),
                scrapPricePerUnit: Number(part.scrapPricePerUnit || 0),
                batteryOldNew: part.batteryOldNew || null,
                chargerOldNew: part.chargerOldNew || null,
                batteryType: part.batteryType || null,
                voltage: part.voltage || null,
                ampereValue: part.ampereValue || null,
                warrantyStatus: part.warrantyStatus || null,
                replacementType: part.replacementType || null,
                replacementFromCompany: part.replacementFromCompany || false,
                oldChargerName: part.oldChargerName || null,
                oldChargerVoltage: part.oldChargerVoltage || null,
                oldChargerWorking: part.oldChargerWorking || null,
                oldChargerAvailable:
                  part.oldChargerAvailable === true ||
                  part.oldChargerAvailable === "true",
                priceAlreadyNet: true,
              };
            }
            try {
              const response = await fetch(`http://localhost:5000/api/spares/${part.spareId}`);
              if (response.ok) {
                const spare = await response.json();
                const hasColors = spare.hasColors || (spare.colorQuantity && spare.colorQuantity.length > 0);
                
                // Aggregate colors and their quantities from all stock entries
                let aggregatedColorQuantity = [];
                if (hasColors && spare.colorQuantity && Array.isArray(spare.colorQuantity)) {
                  const colorMap = new Map();
                  spare.colorQuantity.forEach((cq) => {
                    if (cq.color) {
                      const normalizedColor = String(cq.color).toLowerCase().trim();
                      const quantity = parseInt(cq.quantity || 0);
                      if (colorMap.has(normalizedColor)) {
                        const existing = colorMap.get(normalizedColor);
                        existing.quantity += quantity;
                      } else {
                        colorMap.set(normalizedColor, {
                          color: cq.color,
                          quantity: quantity,
                        });
                      }
                    }
                  });
                  aggregatedColorQuantity = Array.from(colorMap.values());
                }
                
                const availableColors = aggregatedColorQuantity.length > 0
                  ? aggregatedColorQuantity.map((cq) => cq.color).filter(Boolean)
                  : [];
                
                // For parts with colors, always ensure a color is selected
                // Use saved selectedColor if it exists and is in available colors, otherwise use first available
                let initialColor = null;
                if (hasColors && availableColors.length > 0) {
                  if (part.selectedColor && availableColors.includes(part.selectedColor)) {
                    initialColor = part.selectedColor;
                  } else {
                    initialColor = availableColors[0];
                  }
                }
                
                const initialColorQuantity =
                  hasColors && initialColor && aggregatedColorQuantity.length > 0
                    ? aggregatedColorQuantity.find((cq) => cq.color === initialColor)?.quantity || 0
                    : null;

                const loadedPart = {
                  id: spare._id || part.spareId, // Use spare._id if available, fallback to part.spareId
                  name: spare.name || part.spareName,
                  price: Number(part.price || spare.sellingPrice || 0),
                  quantity: spare.quantity || 0,
                  selectedQuantity: Number(part.quantity || 1), // Ensure it's a number - this is the quantity from database
                  selectedColor: initialColor,
                  inventoryQuantity: hasColors && initialColorQuantity !== null ? initialColorQuantity : (spare.quantity || 0),
                  hasColors: hasColors,
                  colorQuantity: aggregatedColorQuantity,
                  availableColors: availableColors,
                  isCustom: false,
                  partType: part.partType || jobcard?.jobcardType || "service",
                  // Preserve sales-related fields
                  salesType: part.salesType || null,
                  scrapAvailable: part.scrapAvailable || false,
                  scrapQuantity: Number(part.scrapQuantity || 0),
                  scrapPricePerUnit: Number(part.scrapPricePerUnit || 0),
                  batteryOldNew: part.batteryOldNew || null,
                  chargerOldNew: part.chargerOldNew || null,
                  batteryType: part.batteryType || null,
                  voltage: part.voltage || null,
                  ampereValue: part.ampereValue || null,
                  warrantyStatus: part.warrantyStatus || null,
                  replacementType: part.replacementType || null,
                  replacementFromCompany: part.replacementFromCompany || false,
                  oldChargerName: part.oldChargerName || null,
                  oldChargerVoltage: part.oldChargerVoltage || null,
                  oldChargerWorking: part.oldChargerWorking || null,
                  oldChargerAvailable:
                    part.oldChargerAvailable === true ||
                    part.oldChargerAvailable === "true",
                  // Price from DB is already net per unit; don't deduct scrap again
                  priceAlreadyNet: true,
                };

                return loadedPart;
              }
            } catch (error) {
              console.error(`Error loading spare ${part.spareId}:`, error);
            }
            // Fallback if fetch fails
            const fallbackPart = {
              id: part.spareId || part._id || part.id,
              name: part.spareName,
              price: Number(part.price || 0),
              quantity: 0,
              selectedQuantity: Number(part.quantity || 1), // Ensure it's a number - this is the quantity from database
              selectedColor: part.selectedColor || null,
              inventoryQuantity: 0,
              hasColors: false,
              colorQuantity: [],
              availableColors: [],
              isCustom: Boolean(part.isCustom),
              partType: part.partType || jobcard?.jobcardType || "service",
              // Preserve sales-related fields
              salesType: part.salesType || null,
              scrapAvailable: part.scrapAvailable || false,
              scrapQuantity: Number(part.scrapQuantity || 0),
              scrapPricePerUnit: Number(part.scrapPricePerUnit || 0),
              batteryOldNew: part.batteryOldNew || null,
              chargerOldNew: part.chargerOldNew || null,
              batteryType: part.batteryType || null,
              voltage: part.voltage || null,
              ampereValue: part.ampereValue || null,
              warrantyStatus: part.warrantyStatus || null,
              replacementType: part.replacementType || null,
              replacementFromCompany: part.replacementFromCompany || false,
              oldChargerName: part.oldChargerName || null,
              oldChargerVoltage: part.oldChargerVoltage || null,
              oldChargerWorking: part.oldChargerWorking || null,
              oldChargerAvailable:
                part.oldChargerAvailable === true ||
                part.oldChargerAvailable === "true",
              // Price from DB is already net per unit; don't deduct scrap again
              priceAlreadyNet: true,
            };

            return fallbackPart;
          })
        );
        setSelectedParts(partsWithDetails);
      };
      loadParts();
    }
  }, [jobcard]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
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
  const isMobileValid = formData.mobile.trim().length === 10 && /^\d{10}$/.test(formData.mobile.trim());

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
    // Prevent double calls
    if (isAddingPartRef.current) {
      return;
    }
    isAddingPartRef.current = true;

    const hasColors = part.hasColors || (part.colorQuantity && part.colorQuantity.length > 0);
    let aggregatedColorQuantity = [];
    if (hasColors && part.colorQuantity && Array.isArray(part.colorQuantity)) {
      const colorMap = new Map();
      part.colorQuantity.forEach((cq) => {
        if (cq.color) {
          const normalizedColor = String(cq.color).toLowerCase().trim();
          const quantity = parseInt(cq.quantity || 0);
          if (colorMap.has(normalizedColor)) {
            const existing = colorMap.get(normalizedColor);
            existing.quantity += quantity;
          } else {
            colorMap.set(normalizedColor, {
              color: cq.color,
              quantity: quantity,
            });
          }
        }
      });
      aggregatedColorQuantity = Array.from(colorMap.values());
    }
    const availableColors = aggregatedColorQuantity.length > 0
      ? aggregatedColorQuantity.map((cq) => cq.color).filter(Boolean)
      : [];
    
    // For parts with colors, ALWAYS select the first available color
    // If no colors are available, don't add the part (or handle as non-color part)
    const initialColor = hasColors && availableColors.length > 0 ? availableColors[0] : null;
    const initialColorQuantity =
      hasColors && initialColor && aggregatedColorQuantity.length > 0
        ? aggregatedColorQuantity.find((cq) => cq.color === initialColor)?.quantity || 0
        : null;

    // Only add the part if it has colors and we have a color selected, OR if it doesn't have colors
    if (hasColors && !initialColor) {
      // If part has colors but no available colors, don't add it
      alert("This part has color tracking enabled but no colors are available in stock.");
      isAddingPartRef.current = false;
      return;
    }

    // Check if this exact part (with same color if it has colors) already exists
    setSelectedParts((prev) => {
      const newPart = {
        ...part,
        selectedQuantity: 1,
        inventoryQuantity:
          hasColors && initialColorQuantity !== null ? initialColorQuantity : part.quantity,
        hasColors: hasColors,
        availableColors: availableColors,
        selectedColor: initialColor, // This will be null for non-color parts, or the first color for color parts
        colorQuantity: aggregatedColorQuantity,
        partType: activeTab || "service",
      };

      // For parts with colors, check if same part with same color already exists
      if (hasColors && initialColor) {
        const existingPart = prev.find(
          (p) => 
            (p.id === part.id || p.id === part._id) && 
            p.hasColors && 
            p.selectedColor === initialColor &&
            (p.partType || "service") === (activeTab || "service")
        );
        if (existingPart) {
          alert("This part with the selected color is already added. Please increase the quantity instead.");
          isAddingPartRef.current = false;
          return prev;
        }
      } else {
        // For parts without colors, check if same part already exists
        const existingPart = prev.find(
          (p) => 
            (p.id === part.id || p.id === part._id) && 
            !p.hasColors &&
            (p.partType || "service") === (activeTab || "service")
        );
        if (existingPart) {
          alert("This part is already added. Please increase the quantity instead.");
          isAddingPartRef.current = false;
          return prev;
        }
      }

      return [newPart, ...prev];
    });
    
    // Reset the flag after a short delay to allow state update
    setTimeout(() => {
      isAddingPartRef.current = false;
    }, 100);
  };

  const getMaxQuantity = (part) => {
    // Custom spares added only for this jobcard are not limited by stock
    if (part.isCustom) {
      return Number.MAX_SAFE_INTEGER;
    }
    if (part.hasColors && part.selectedColor && part.colorQuantity && Array.isArray(part.colorQuantity)) {
      const colorEntry = part.colorQuantity.find(
        (cq) => String(cq.color).toLowerCase().trim() === String(part.selectedColor).toLowerCase().trim()
      );
      if (colorEntry && colorEntry.quantity !== undefined) {
        return colorEntry.quantity;
      }
    }
    return part.inventoryQuantity || part.quantity || 999;
  };

  const handleColorChange = (partId, color) => {
    setSelectedParts((prev) =>
      prev.map((part) => {
        if (part.id === partId) {
          let newInventoryQuantity = part.quantity;
          if (part.hasColors && color && part.colorQuantity && Array.isArray(part.colorQuantity)) {
            const colorEntry = part.colorQuantity.find(
              (cq) => String(cq.color).toLowerCase().trim() === String(color).toLowerCase().trim()
            );
            if (colorEntry && colorEntry.quantity !== undefined) {
              newInventoryQuantity = colorEntry.quantity;
            }
          }
          return {
            ...part,
            selectedColor: color,
            inventoryQuantity: newInventoryQuantity,
            selectedQuantity: 1,
          };
        }
        return part;
      })
    );
  };

  const removePart = (partId, partType) => {
    setSelectedParts((prev) =>
      prev.filter(
        (part) => !(part.id === partId && (part.partType || "service") === partType)
      )
    );
  };

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showCustomSpare) setShowCustomSpare(false);
  };

  const toggleCustomSpare = () => {
    setShowCustomSpare(!showCustomSpare);
    if (showSearch) setShowSearch(false);
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
      id: `custom-${Date.now()}`,
      name: customSpareData.name.trim(),
      price: parseFloat(customSpareData.price),
      selectedQuantity: qtyNumber,
      hasColors: false,
      selectedColor: customSpareData.color.trim() || null,
      isCustom: true,
      quantity: qtyNumber,
      inventoryQuantity: qtyNumber,
      colorQuantity: [],
      availableColors: [],
      partType: activeTab || "service",
    };

    setSelectedParts((prev) => [customPart, ...prev]);

    setCustomSpareData({
      name: "",
      price: "",
      quantity: "1",
      color: "",
    });
    setShowCustomSpare(false);
  };

  const increaseQuantity = (partId, partType) => {
    setSelectedParts((prev) =>
      prev.map((part) => {
        if (part.id === partId && (part.partType || "service") === partType) {
          const maxQuantity = getMaxQuantity(part);
          const currentSelectedQty = part.selectedQuantity || 1;
          if (currentSelectedQty < maxQuantity) {
            return { ...part, selectedQuantity: currentSelectedQty + 1 };
          }
        }
        return part;
      })
    );
  };

  const decreaseQuantity = (partId, partType) => {
    setSelectedParts((prev) =>
      prev.map((part) => {
        if (part.id === partId && (part.partType || "service") === partType) {
          const currentSelectedQty = part.selectedQuantity || 1;
          if (currentSelectedQty > 1) {
            return { ...part, selectedQuantity: currentSelectedQty - 1 };
          }
        }
        return part;
      })
    );
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
    const detailToRemove = formData.details[index];
    if (window.confirm(`Are you sure you want to remove "${detailToRemove}"?`)) {
      setFormData((prev) => ({
        ...prev,
        details: prev.details.filter((_, i) => i !== index),
      }));
    }
  };

  const handleSubmit = async () => {
    // Validate customer name is required
    if (!formData.customerName || formData.customerName.trim() === "") {
      setValidationError("Customer Name is required");
      // Scroll to error message after state update
      setTimeout(() => {
        if (errorRef.current) {
          errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return;
    }

    // Clear any previous validation errors
    setValidationError("");

    try {
      setLoading(true);
      const submitData = {
        customerName: formData.customerName.trim(),
        place: formData.place.trim() || "N/A",
        mobile: formData.mobile.trim() || "N/A",
        charger: formData.charger || "no",
        mechanic: formData.mechanic?.trim() || "",
        billNo: formData.billNo?.trim() || "",
        warrantyType: formData.warrantyType || "none",
        warrantyDate: formData.warrantyDate.trim() || (formData.warrantyType === "none" ? "NA" : "N/A"),
        details: formData.details.length > 0 ? formData.details : [],
        parts: selectedParts.map((part) => {
          // Only use part.id as spareId if it's a valid ObjectId, otherwise use null
          // Also check if id starts with 'part-' which indicates a temporary ID
          let spareId = null;
          if (!part.isCustom && part.id) {
            // Check if it's a valid ObjectId (24 hex characters)
            if (isValidObjectId(part.id)) {
              spareId = part.id;
            } else if (typeof part.id === 'string' && part.id.startsWith('part-')) {
              // Temporary IDs like 'part-0' should be null
              spareId = null;
            } else {
              spareId = null;
            }
          }
          
          const basePart = {
            spareId: spareId,
            spareName: part.name,
            quantity: part.selectedQuantity || 1,
            price: part.price,
            selectedColor: part.selectedColor || null,
            isCustom: part.isCustom || false,
            partType: part.partType || "service",
          };
          
          // Add sales-related fields if they exist and have values
          if (part.salesType) basePart.salesType = part.salesType;
          if (part.scrapAvailable !== undefined && part.scrapAvailable !== null) basePart.scrapAvailable = part.scrapAvailable;
          if (part.scrapQuantity !== undefined && part.scrapQuantity !== null) basePart.scrapQuantity = part.scrapQuantity;
          if (part.scrapPricePerUnit !== undefined && part.scrapPricePerUnit !== null) basePart.scrapPricePerUnit = part.scrapPricePerUnit;
          if (part.batteryOldNew) basePart.batteryOldNew = part.batteryOldNew;
          if (part.chargerOldNew) basePart.chargerOldNew = part.chargerOldNew;
          if (part.ampereValue) basePart.ampereValue = part.ampereValue;
          if (part.warrantyStatus) basePart.warrantyStatus = part.warrantyStatus;
          
          // Add replacement-related fields if they exist and have values
          if (part.replacementType) basePart.replacementType = part.replacementType;
          if (part.replacementFromCompany !== undefined && part.replacementFromCompany !== null) basePart.replacementFromCompany = part.replacementFromCompany;
          if (part.batteryType) basePart.batteryType = part.batteryType;
          if (part.voltage) basePart.voltage = part.voltage;
          if (part.oldChargerName) basePart.oldChargerName = part.oldChargerName;
          if (part.oldChargerVoltage) basePart.oldChargerVoltage = part.oldChargerVoltage;
          if (part.oldChargerWorking) basePart.oldChargerWorking = part.oldChargerWorking;
          if (part.oldChargerAvailable !== undefined && part.oldChargerAvailable !== null) basePart.oldChargerAvailable = part.oldChargerAvailable;
          
          return basePart;
        }),
        status: "pending", // Keep as pending
      };

      const response = await fetch(`http://localhost:5000/api/jobcards/${jobcard._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update jobcard");
      }

      alert("Jobcard updated successfully!");
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error updating jobcard:", error);
      alert(`Error updating jobcard: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Total for a part (battery sales with scrap: gross - scrap deduction)
  // When part is loaded from saved jobcard, price is already net per unit — do not deduct scrap again.
  const getPartTotal = (part) => {
    const qty = part.selectedQuantity !== undefined && part.selectedQuantity !== null && part.selectedQuantity > 0
      ? Number(part.selectedQuantity)
      : (part.quantity !== undefined && part.quantity !== null && part.quantity > 0 ? Number(part.quantity) : 1);
    if (part.priceAlreadyNet) {
      return (Number(part.price) || 0) * qty;
    }
    const unitPrice = Number(part.price) || 0;
    const gross = unitPrice * qty;
    const hasScrapDeduction = part.salesType === "battery" && part.scrapAvailable && part.scrapQuantity > 0 && (part.scrapPricePerUnit ?? 0) > 0;
    const deduction = hasScrapDeduction ? Number(part.scrapQuantity) * Number(part.scrapPricePerUnit ?? 0) : 0;
    return gross - deduction;
  };

  const calculateTotal = () => {
    return selectedParts
      .reduce((sum, part) => sum + part.price * (part.selectedQuantity || 1), 0)
      .toFixed(2);
  };

  const hasParts = (type) =>
    selectedParts.some((part) => (part.partType || "service") === type);

  const filteredParts = selectedParts.filter(
    (part) => (part.partType || "service") === activeTab
  );

  const handleTypeClick = (type) => {
    setActiveTab(type);
    setShowSearch(false);
    setShowCustomSpare(false);
  };

  if (!jobcard) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onWheelCapture={handleNumberInputWheel}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "0.5rem",
          width: "100%",
          maxWidth: "900px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "2rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ margin: 0 }}>Edit Jobcard - {jobcard.jobcardNumber}</h2>
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem",
              border: "none",
              backgroundColor: "transparent",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            ×
          </button>
        </div>

        {/* Customer Information */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Customer Information</h3>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
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
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.375rem",
                  border: validationError && !formData.customerName.trim() ? "1px solid #ef4444" : "1px solid #d1d5db",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Place</label>
              <input
                type="text"
                name="place"
                value={formData.place}
                onChange={handleInputChange}
                placeholder="Enter place"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
                Mobile Number
                {isMobileValid && (
                  <span style={{ color: "#10b981", fontSize: "1rem" }} title="Valid 10-digit mobile number">
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
                style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
              />
              {formData.mobile.trim().length > 0 && !isMobileValid && (
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem", color: "#ef4444" }}>
                  Mobile number must be exactly 10 digits
                </p>
              )}
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Charger</label>
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginTop: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
                  <input
                    type="radio"
                    name="charger"
                    value="yes"
                    checked={formData.charger === "yes"}
                    onChange={handleInputChange}
                  />
                  Yes
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
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
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Jobcard Details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Date</label>
              <input
                type="text"
                value={jobcard?.date || ""}
                readOnly
                disabled
                style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", backgroundColor: "#f9fafb" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>E-Bike Details</label>
              <input
                type="text"
                name="ebikeDetails"
                value={jobcard?.ebikeDetails || ""}
                readOnly
                disabled
                style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", backgroundColor: "#f9fafb" }}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Warranty Type</label>
              <select
                name="warrantyType"
                value={formData.warrantyType}
                onChange={handleInputChange}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
              >
                <option value="none">No Warranty</option>
                <option value="full">Full Warranty</option>
                <option value="battery">Battery Only</option>
                <option value="charger">Charger Only</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Warranty Date/Code</label>
              <input
                type="text"
                name="warrantyDate"
                value={formData.warrantyDate}
                onChange={handleInputChange}
                placeholder="Select warranty date"
                readOnly={formData.warrantyType === "none"}
                disabled={formData.warrantyType === "none"}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #d1d5db",
                  backgroundColor: formData.warrantyType === "none" ? "#f3f4f6" : "white",
                }}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Bill No.</label>
              <input
                type="text"
                name="billNo"
                value={formData.billNo}
                onChange={handleInputChange}
                placeholder="Enter bill no."
                style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Mechanic</label>
              <input
                type="text"
                name="mechanic"
                value={formData.mechanic}
                onChange={handleInputChange}
                placeholder="Enter mechanic name"
                style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
              />
            </div>
          </div>
        </div>

        {/* Work Details Section */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Work Details</h3>
          <input
            type="text"
            value={detailInput}
            onChange={(e) => setDetailInput(e.target.value)}
            onKeyPress={handleDetailKeyPress}
            placeholder="Enter work detail and press Enter to add..."
            style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", marginBottom: "0.75rem" }}
          />
          {formData.details.length > 0 && (
            <div style={{ padding: "0.75rem", backgroundColor: "#f9fafb", borderRadius: "0.375rem", border: "1px solid #e5e7eb" }}>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {formData.details.map((detail, index) => (
                  <li
                    key={index}
                    style={{
                      padding: "0.5rem 0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                      borderBottom: index < formData.details.length - 1 ? "1px solid #e5e7eb" : "none",
                    }}
                  >
                    <span style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ color: "#6b7280", fontWeight: 500, minWidth: "1.5rem" }}>{index + 1})</span>
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

        {/* Spare Parts Section - with custom spare support */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ margin: "0 0 0.75rem 0" }}>Part Sections</h3>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {[
                { key: "service", label: "🔧 Service" },
                { key: "replacement", label: "🔄 Replacement" },
                { key: "sales", label: "💰 Sales" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTypeClick(tab.key)}
                  style={{
                    padding: "0.6rem 1rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    borderRadius: "0.5rem",
                    border:
                      activeTab === tab.key
                        ? "2px solid #3b82f6"
                        : hasParts(tab.key)
                        ? "2px solid #10b981"
                        : "2px solid #d1d5db",
                    backgroundColor:
                      activeTab === tab.key
                        ? "#eff6ff"
                        : hasParts(tab.key)
                        ? "#d1fae5"
                        : "#ffffff",
                    color:
                      activeTab === tab.key
                        ? "#1d4ed8"
                        : hasParts(tab.key)
                        ? "#065f46"
                        : "#374151",
                    cursor: "pointer",
                  }}
                >
                  {tab.label} {hasParts(tab.key) ? "✓" : ""}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>
              {activeTab === "service"
                ? "Service"
                : activeTab === "replacement"
                ? "Replacement"
                : "Sales"}{" "}
              Parts
            </h3>
            <button
              type="button"
              onClick={toggleSearch}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {showSearch ? "Cancel" : "+ Add Part"}
            </button>
            <button
              type="button"
              onClick={toggleCustomSpare}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                backgroundColor: showCustomSpare ? "#6b7280" : "#10b981",
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

          {showSearch && (
            <div style={{ marginBottom: "1rem" }}>
              <SparePartsSearch onSelectPart={handlePartSelect} />
            </div>
          )}

          {showCustomSpare && (
            <div
              style={{
                padding: "1.25rem",
                marginBottom: "1rem",
                backgroundColor: "#f9fafb",
                borderRadius: "0.5rem",
                border: "1px solid #e5e7eb",
              }}
            >
              <h4 style={{ marginBottom: "1rem", fontSize: "1rem", fontWeight: 600 }}>Add Custom Spare Part</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.25rem",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                    }}
                  >
                    Spare Part Name <span style={{ color: "#ef4444" }}>*</span>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "0.25rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                      }}
                    >
                      Price for 1 Quantity (₹) <span style={{ color: "#ef4444" }}>*</span>
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
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
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

          {selectedParts.length > 0 && filteredParts.length === 0 && (
            <div
              style={{
                padding: "0.75rem",
                marginBottom: "0.75rem",
                backgroundColor: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: "0.375rem",
                color: "#64748b",
                fontSize: "0.875rem",
              }}
            >
              No parts added in this section yet.
            </div>
          )}

          {filteredParts.length > 0 && (
            <div className="selected-parts">
              <h4>Selected Parts</h4>
              <div className="parts-list">
                {filteredParts.map((part, index) => {
                // Create a unique key that includes part ID and color (if applicable)
                const uniqueKey = part.isCustom 
                  ? `custom-${part.id}-${index}` 
                  : `${part.id || part._id}-${part.selectedColor || 'no-color'}-${index}`;
                return (
                <div
                  key={uniqueKey}
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
                    e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
                    e.currentTarget.style.borderColor = "#d1d5db";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
                    e.currentTarget.style.borderColor = "#e5e7eb";
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
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
                            backgroundColor: part.replacementType === "battery" ? "#dbeafe" : 
                                            part.replacementType === "charger" ? "#fef3c7" :
                                            part.replacementType === "controller" ? "#e0e7ff" :
                                            part.replacementType === "motor" ? "#fce7f3" : "#f3f4f6",
                            color: part.replacementType === "battery" ? "#1e40af" : 
                                   part.replacementType === "charger" ? "#92400e" :
                                   part.replacementType === "controller" ? "#3730a3" :
                                   part.replacementType === "motor" ? "#9f1239" : "#374151",
                            borderRadius: "4px",
                            fontWeight: 600,
                            textTransform: "capitalize",
                            border: "1px solid",
                            borderColor: part.replacementType === "battery" ? "#93c5fd" : 
                                        part.replacementType === "charger" ? "#fde68a" :
                                        part.replacementType === "controller" ? "#c7d2fe" :
                                        part.replacementType === "motor" ? "#fbcfe8" : "#d1d5db",
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
                            backgroundColor: part.salesType === "battery" ? "#dbeafe" : 
                                            part.salesType === "charger" ? "#fef3c7" :
                                            part.salesType === "oldScooty" ? "#fce7f3" :
                                            part.salesType === "spare" ? "#e0e7ff" : "#f3f4f6",
                            color: part.salesType === "battery" ? "#1e40af" : 
                                   part.salesType === "charger" ? "#92400e" :
                                   part.salesType === "oldScooty" ? "#9f1239" :
                                   part.salesType === "spare" ? "#3730a3" : "#374151",
                            borderRadius: "4px",
                            fontWeight: 600,
                            textTransform: "capitalize",
                            border: "1px solid",
                            borderColor: part.salesType === "battery" ? "#93c5fd" : 
                                        part.salesType === "charger" ? "#fde68a" :
                                        part.salesType === "oldScooty" ? "#fbcfe8" :
                                        part.salesType === "spare" ? "#c7d2fe" : "#d1d5db",
                          }}
                        >
                          {part.salesType === "oldScooty" ? "Old Scooty" : part.salesType}
                        </span>
                      )}
                    </div>
                    {/* Show details for replacement parts */}
                    {part.partType === "replacement" && (
                      <div style={{ marginBottom: "0.75rem" }}>
                        {part.replacementType === "battery" && (
                          <div style={{ fontSize: "0.875rem", color: "#374151", marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            {part.ampereValue && part.ampereValue.trim() !== "" ? (
                              <span style={{ fontWeight: 500 }}>
                                Ampere: <span style={{ fontWeight: 600, color: "#111827" }}>{part.ampereValue} A</span>
                              </span>
                            ) : (
                              <span style={{ fontWeight: 500, color: "#9ca3af" }}>Ampere: Not specified</span>
                            )}
                            {part.replacementFromCompany !== undefined && (
                              <span style={{ fontWeight: 500 }}>
                                Replacement: <span style={{ fontWeight: 600, color: part.replacementFromCompany ? "#059669" : "#dc2626" }}>
                                  {part.replacementFromCompany ? "From Company" : "Not from Company"}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                        {part.replacementType === "charger" && (
                          <div style={{ fontSize: "0.875rem", color: "#374151", marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                              {part.batteryType && (
                                <span style={{ fontWeight: 500 }}>
                                  <span style={{ fontWeight: 400 }}>Batt. Type:</span> <span style={{ fontWeight: 600, color: "#111827" }}>{part.batteryType}</span>
                                </span>
                              )}
                              {part.voltage && (
                                <span style={{ fontWeight: 500 }}>
                                  <span style={{ fontWeight: 400 }}>Voltage-Ampere:</span> <span style={{ fontWeight: 600, color: "#111827" }}>{part.voltage}</span>
                                </span>
                              )}
                            </div>
                            {part.oldChargerName && (
                              <span style={{ fontWeight: 500 }}>
                                Old Charger: <span style={{ fontWeight: 600, color: "#111827" }}>{part.oldChargerName}</span>
                                {part.oldChargerVoltage && (
                                  <span style={{ fontWeight: 400, color: "#6b7280" }}> ({part.oldChargerVoltage})</span>
                                )}
                              </span>
                            )}
                            {part.replacementFromCompany !== undefined && (
                              <span style={{ fontWeight: 500 }}>
                                Replacement: <span style={{ fontWeight: 600, color: part.replacementFromCompany ? "#059669" : "#dc2626" }}>
                                  {part.replacementFromCompany ? "From Company" : "Not from Company"}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                        {part.replacementType === "controller" && (
                          <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.5rem" }}>
                            Controller
                          </div>
                        )}
                        {part.replacementType === "motor" && (
                          <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.5rem" }}>
                            Motor
                          </div>
                        )}
                      </div>
                    )}
                    {/* Show details for sales parts */}
                    {part.partType === "sales" && (
                      <div style={{ marginBottom: "0.75rem" }}>
                        {part.salesType === "battery" && (
                          <div style={{ fontSize: "0.875rem", color: "#374151", marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            {(part.batteryOldNew === "old" || part.batteryOldNew === "new") && (
                              <span style={{ fontWeight: 500 }}>Type: <span style={{ fontWeight: 600, color: "#111827" }}>{part.batteryOldNew === "old" ? "Old Battery" : "New Battery"}</span></span>
                            )}
                            {part.batteryOldNew !== "old" && part.ampereValue && part.ampereValue.trim() !== "" ? (
                              <span style={{ fontWeight: 500 }}>
                                Ampere: <span style={{ fontWeight: 600, color: "#111827" }}>{part.ampereValue} A</span>
                              </span>
                            ) : part.batteryOldNew !== "old" ? (
                              <span style={{ fontWeight: 500, color: "#9ca3af" }}>Ampere: Not specified</span>
                            ) : null}
                            {part.batteryOldNew !== "old" && part.warrantyStatus !== undefined && (
                              <span style={{ fontWeight: 500 }}>
                                Warranty: <span style={{ fontWeight: 600, color: part.warrantyStatus === "warranty" ? "#059669" : "#6b7280" }}>
                                  {part.warrantyStatus === "warranty" ? "Warranty" : "No Warranty"}
                                </span>
                              </span>
                            )}
                            {part.scrapAvailable !== undefined && (
                              <span style={{ fontWeight: 500 }}>
                                Scrap Available: <span style={{ fontWeight: 600, color: part.scrapAvailable ? "#059669" : "#dc2626" }}>
                                  {part.scrapAvailable ? "Yes" : "No"}
                                </span>
                                {part.scrapAvailable && part.scrapQuantity != null && part.scrapQuantity > 0 && (
                                  <span style={{ marginLeft: "0.5rem", fontWeight: 600, color: "#111827" }}>
                                    (Qty: {part.scrapQuantity})
                                  </span>
                                )}
                              </span>
                            )}
                            {part.scrapAvailable && part.scrapQuantity > 0 && (part.scrapPricePerUnit ?? 0) > 0 && (
                              <span style={{ fontWeight: 500, display: "block", marginTop: "0.25rem" }}>
                                Scrap deduction: <span style={{ fontWeight: 600, color: "#059669" }}>
                                  ₹{(part.scrapQuantity * (part.scrapPricePerUnit ?? 0)).toFixed(2)}
                                </span>
                                <span style={{ color: "#6b7280", marginLeft: "0.25rem" }}>
                                  ({part.scrapQuantity} × ₹{(part.scrapPricePerUnit ?? 0).toFixed(2)})
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                        {part.salesType === "charger" && (
                          <div style={{ fontSize: "0.875rem", color: "#374151", marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            {(part.chargerOldNew === "old" || part.chargerOldNew === "new") && (
                              <span style={{ fontWeight: 500 }}>Type: <span style={{ fontWeight: 600, color: "#111827" }}>{part.chargerOldNew === "old" ? "Old Charger" : "New Charger"}</span></span>
                            )}
                            {part.chargerOldNew === "old" && part.voltage && (
                              <span style={{ fontWeight: 500 }}>Voltage: <span style={{ fontWeight: 600, color: "#111827" }}>{part.voltage}</span></span>
                            )}
                            {part.chargerOldNew !== "old" && part.warrantyStatus !== undefined && (
                              <span style={{ fontWeight: 500 }}>
                                Warranty: <span style={{ fontWeight: 600, color: "#111827" }}>
                                  {part.warrantyStatus === "noWarranty" ? "No warranty" : part.warrantyStatus === "6months" ? "6 months" : part.warrantyStatus === "1year" ? "1 year" : part.warrantyStatus}
                                </span>
                              </span>
                            )}
                            {part.chargerOldNew !== "old" && (
                              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                {part.batteryType && (
                                  <span style={{ fontWeight: 500 }}>
                                    <span style={{ fontWeight: 400 }}>Batt. Type:</span> <span style={{ fontWeight: 600, color: "#111827" }}>{part.batteryType}</span>
                                  </span>
                                )}
                                {part.voltage && (
                                  <span style={{ fontWeight: 500 }}>
                                    <span style={{ fontWeight: 400 }}>Voltage-Ampere:</span> <span style={{ fontWeight: 600, color: "#111827" }}>{part.voltage}</span>
                                  </span>
                                )}
                              </div>
                            )}
                            {part.chargerOldNew !== "old" && part.oldChargerAvailable && (part.oldChargerVoltage || part.oldChargerWorking != null) && (
                              <span style={{ fontWeight: 500 }}>
                                Old Charger:
                                {part.oldChargerVoltage && (
                                  <span style={{ fontWeight: 600, color: "#111827", marginLeft: "0.25rem" }}>{part.oldChargerVoltage}</span>
                                )}
                                {part.oldChargerWorking != null && (
                                  <span style={{ marginLeft: "0.5rem", fontWeight: 600, color: part.oldChargerWorking === "working" ? "#059669" : "#dc2626" }}>
                                    • {part.oldChargerWorking === "working" ? "Working" : "Not working"}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        )}
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
                            onChange={(e) => handleColorChange(part.id, e.target.value)}
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
                              e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = "#d1d5db";
                              e.target.style.boxShadow = "none";
                            }}
                          >
                            {part.availableColors.map((color, index) => (
                              <option key={index} value={color}>
                                {color}
                              </option>
                            ))}
                          </select>
                          {part.selectedColor && (
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "6px",
                                border: "2px solid #d1d5db",
                                backgroundColor: getColorHex(part.selectedColor).includes("gradient")
                                  ? "transparent"
                                  : getColorHex(part.selectedColor),
                                background: getColorHex(part.selectedColor),
                                backgroundImage: getColorHex(part.selectedColor).includes("gradient")
                                  ? getColorHex(part.selectedColor)
                                  : "none",
                                flexShrink: 0,
                                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
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
                        fontFamily: "system-ui, -apple-system, sans-serif",
                      }}
                    >
                      {part.partType === "replacement" && part.replacementType === "battery" ? (
                        // For battery replacement, show total price (price per battery × quantity)
                        <>₹{(part.price * (part.selectedQuantity || 1)).toFixed(2)}</>
                      ) : part.partType === "sales" && part.salesType === "battery" ? (
                        // For sales battery: price from DB is already net; getPartTotal uses priceAlreadyNet
                        <>₹{getPartTotal(part).toFixed(2)}</>
                      ) : part.partType === "sales" && part.salesType === "charger" ? (
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
                              decreaseQuantity(part.id, part.partType || "service");
                            }
                          }}
                          disabled={(part.selectedQuantity || 1) <= 1}
                          title={(part.selectedQuantity || 1) <= 1 ? "Quantity cannot be less than 1" : ""}
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
                              e.target.style.backgroundColor = "#2563eb";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if ((part.selectedQuantity || 1) > 1) {
                              e.target.style.backgroundColor = "#3b82f6";
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
                            if ((part.selectedQuantity || 1) >= maxQty) {
                              alert(`Maximum quantity reached. Available: ${maxQty}`);
                            } else {
                              increaseQuantity(part.id, part.partType || "service");
                            }
                          }}
                          disabled={
                            (part.selectedQuantity || 1) >= getMaxQuantity(part)
                          }
                          title={
                            (part.selectedQuantity || 1) >= getMaxQuantity(part)
                              ? `Maximum quantity reached. Available: ${getMaxQuantity(part)}`
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
                              (part.selectedQuantity || 1) >= getMaxQuantity(part)
                                ? "#cbd5e1"
                                : "#3b82f6",
                            color: "#ffffff",
                            border: "none",
                            borderLeft: "1px solid #d1d5db",
                            cursor:
                              (part.selectedQuantity || 1) >= getMaxQuantity(part)
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
                              (part.selectedQuantity || 1) >= getMaxQuantity(part)
                                ? 0.5
                                : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (
                              (part.selectedQuantity || 1) < getMaxQuantity(part)
                            ) {
                              e.target.style.backgroundColor = "#2563eb";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (
                              (part.selectedQuantity || 1) < getMaxQuantity(part)
                            ) {
                              e.target.style.backgroundColor = "#3b82f6";
                            }
                          }}
                        >
                          +
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePart(part.id, part.partType || "service")}
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
                );
              })}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              backgroundColor: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

