import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTodayFormatted, formatDate } from "../../utils/dateUtils";
import { useSessionTimeout } from "../../hooks/useSessionTimeout";

// Separate component for portal suggestions to avoid Babel parser issues
// Separate component for portal suggestions to avoid Babel parser issues
import { API_BASE } from "../../config/api";
function SuggestionsPortal({
  suggestions,
  selectedIndex,
  onSelect,
  position,
  inputName,
}) {
  if (!position) return null;

  const style = {
    position: "fixed",
    top: position.bottom + 6,
    left: position.left,
    width: position.width,
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    zIndex: 10000,
    boxShadow: "0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.05)",
    maxHeight: 280,
    overflowY: "auto",
    overflowX: "hidden",
    animation: "slideDown 0.2s ease-out",
  };

  return (
    <div style={style}>
      {suggestions.map((suggestion, idx) => (
        <div
          key={`${inputName}-${
            suggestion.loading ? "loading" : suggestion
          }-${idx}`}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!suggestion.loading) {
              onSelect(suggestion);
            }
          }}
          style={{
            padding: "0.75rem 1rem",
            cursor: suggestion.loading ? "default" : "pointer",
            backgroundColor:
              idx === selectedIndex && !suggestion.loading
                ? "#3b82f6"
                : "white",
            borderBottom:
              idx !== suggestions.length - 1 ? "1px solid #f1f5f9" : "none",
            transition: "all 0.15s ease",
            transform:
              idx === selectedIndex && !suggestion.loading
                ? "translateX(4px)"
                : "translateX(0)",
          }}
          onMouseEnter={(e) => {
            if (!suggestion.loading) {
              e.currentTarget.style.backgroundColor =
                idx === selectedIndex ? "#3b82f6" : "#f8fafc";
              e.currentTarget.style.transform = "translateX(2px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!suggestion.loading) {
              e.currentTarget.style.backgroundColor =
                idx === selectedIndex ? "#3b82f6" : "white";
              e.currentTarget.style.transform = "translateX(0)";
            }
          }}
        >
          <div
            style={{
              fontWeight:
                idx === selectedIndex && !suggestion.loading ? 600 : 500,
              color:
                idx === selectedIndex && !suggestion.loading
                  ? "white"
                  : "#1f2937",
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              width: "100%",
            }}
          >
            {suggestion.loading ? (
              <>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #e5e7eb",
                    borderTop: "2px solid #3b82f6",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                ></div>
                Loading suggestions...
              </>
            ) : (
              <>
                {idx === selectedIndex ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#3b82f6",
                      flexShrink: 0,
                    }}
                  ></div>
                )}
                <span>{suggestion}</span>
                {inputName && (
                  <span
                    style={{
                      marginLeft: "auto",
                      padding: "0.25rem 0.5rem",
                      backgroundColor:
                        idx === selectedIndex && !suggestion.loading
                          ? "rgba(255, 255, 255, 0.2)"
                          : "#f1f5f9",
                      color:
                        idx === selectedIndex && !suggestion.loading
                          ? "white"
                          : "#6b7280",
                      borderRadius: "0.375rem",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                    }}
                  >
                    {inputName === "modelName"
                      ? "Model"
                      : inputName === "company"
                      ? "Company"
                      : inputName === "name"
                      ? "Spare"
                      : inputName === "modelSearch"
                      ? "Model"
                      : inputName === "supplierName"
                      ? "Supplier"
                      : inputName}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default function AddModel() {
  const navigate = useNavigate();
  const suggestionsRef = useRef(null);
  const modelNameInputRef = useRef(null);
  const companyInputRef = useRef(null);
  const [searchParams] = useSearchParams();
  const isAdminAdd = searchParams.get("admin") === "true";
  const modelId = searchParams.get("modelId"); // Get modelId from URL params

  // Initialize session timeout for admin users
  useSessionTimeout();

  // State to track if model name and company should be locked
  const [isAddingColorVariant, setIsAddingColorVariant] = useState(false);

  // Derived state: lock additional fields (date, warranty) for admin color variants
  const shouldLockAdditionalFields = isAdminAdd;

  // Form state
  const [formData, setFormData] = useState({
    modelName: "",
    company: "",
    colour: "",
    quantity: "",
    sellingPrice: "",
    batteriesPerSet: 5, // Default to 5 batteries
    description: [], // Array of tags
    colorQuantities: [{ color: "", quantity: "" }], // Array of color-quantity pairs
    purchasedInWarranty: false,
    purchaseDate: getTodayFormatted(), // Default to today's date in dd/mm/yyyy format
  });

  // State for tag input
  const [tagInput, setTagInput] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [colorQuantityError, setColorQuantityError] = useState("");
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionPosition, setSuggestionPosition] = useState(null);
  const [companyPosition, setCompanyPosition] = useState(null);
  // Model name search state (your way - store search string on every change)
  const [modelSearchString, setModelSearchString] = useState("");
  // Company suggestions state
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [companySuggestionsLoading, setCompanySuggestionsLoading] =
    useState(false);
  const [showPurchasePriceDialog, setShowPurchasePriceDialog] = useState(false);
  const [autoAppliedPrice, setAutoAppliedPrice] = useState(null);

  // Check for existing purchase price for models with same details
  const checkExistingPurchasePrice = useCallback(async (currentFormData) => {
    if (
      !currentFormData.modelName ||
      !currentFormData.company ||
      !currentFormData.purchaseDate
    ) {
      setAutoAppliedPrice(null);
      return;
    }

    try {
      const checkUrl = `${API_BASE}/models/check-purchase-price?modelName=${encodeURIComponent(
        currentFormData.modelName
      )}&company=${encodeURIComponent(
        currentFormData.company
      )}&purchaseDate=${encodeURIComponent(
        parseDate(currentFormData.purchaseDate)
      )}&purchasedInWarranty=${encodeURIComponent(
        currentFormData.purchasedInWarranty
      )}`;

      const response = await fetch(checkUrl);

      if (!response.ok) {
        console.error("Failed to check purchase price");
        return;
      }

      const data = await response.json();

      if (data.hasPrice && data.purchasePrice) {
        setAutoAppliedPrice(data.purchasePrice);
        setReferenceModel(
          data.referenceModel ? { ...data.referenceModel } : null
        );
        console.log(`Auto-applied purchase price: ${data.purchasePrice}`);
        console.log(
          `Reference model: ${data.referenceModel?.modelName} ${
            data.referenceModel?.company
          } (${data.referenceModel?.colour}) - Warranty: ${
            data.referenceModel?.purchasedInWarranty
              ? "In Warranty"
              : "Out of Warranty"
          }`
        );
      } else {
        setAutoAppliedPrice(null);
        setReferenceModel(null);
      }
    } catch (err) {
      console.error("Error checking purchase price:", err);
      setAutoAppliedPrice(null);
    }
  }, []);

  // Effect to fetch model data when adding color variant
  useEffect(() => {
    if (modelId) {
      setIsAddingColorVariant(true);
      const fetchModelData = async () => {
        try {
          const response = await fetch(
            `${API_BASE}/models/${modelId}`
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || "Error fetching model data");
          }

          // Pre-fill form with existing model data
          // For color variants, always start with today's date so new stock entries
          // default to now rather than the original model's date.
          const initialData = {
            modelName: data.data.modelName,
            company: data.data.company,
            colour: "",
            quantity: "",
            sellingPrice: data.data.sellingPrice || "",
            batteriesPerSet: data.data.batteriesPerSet || 5,
            description: data.data.description || [],
            colorQuantities: data.data.colorQuantities && data.data.colorQuantities.length > 0
              ? data.data.colorQuantities
              : [{ color: "", quantity: "" }],
            purchasedInWarranty: data.data.purchasedInWarranty || false,
            purchaseDate: getTodayFormatted(),
          };

          setFormData(initialData);

          // Check for existing purchase price with the pre-filled data
          checkExistingPurchasePrice(initialData);

          setError("");
        } catch (err) {
          setError(err.message || "Error fetching model data");
        }
      };

      fetchModelData();
    }
  }, [modelId, checkExistingPurchasePrice]);
  const [referenceModel, setReferenceModel] = useState(null);
  const suggestionTimeoutRef = useRef(null);
  const companySuggestionTimeoutRef = useRef(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [selectedCompanySuggestionIndex, setSelectedCompanySuggestionIndex] =
    useState(-1);

  // Re-check auto price whenever key purchase identifiers change
  useEffect(() => {
    checkExistingPurchasePrice(formData);
  }, [
    formData.modelName,
    formData.company,
    formData.purchaseDate,
    formData.purchasedInWarranty,
    checkExistingPurchasePrice,
  ]);

  // Predefined color options with hex values
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

  // Date validation and parsing functions
  const isDateDisabled = isSubmitting || shouldLockAdditionalFields;

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

  const parseDate = (dateString) => {
    if (!dateString) return "";
    const [day, month, year] = dateString.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };

  const handleDateChange = (e) => {
    const value = e.target.value;

    // Allow typing in dd/mm/yyyy format
    let formattedValue = value;

    // Auto-format as user types
    if (value.length === 2 && !value.includes("/")) {
      formattedValue = value + "/";
    } else if (value.length === 5 && value.split("/").length === 2) {
      formattedValue = value + "/";
    }

    setFormData((prev) => ({
      ...prev,
      purchaseDate: formattedValue,
    }));
  };

  const handleDateBlur = (e) => {
    const value = e.target.value;
    if (value && validateDateFormat(value)) {
      // Valid format, keep it
      setFormData((prev) => ({
        ...prev,
        purchaseDate: value,
      }));
    } else if (value) {
      // Invalid format, reset to today
      setFormData((prev) => ({
        ...prev,
        purchaseDate: getTodayFormatted(),
      }));
    }
  };

  // Handle tag input
  const handleTagInputChange = (e) => {
    setTagInput(e.target.value);
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!formData.description.includes(newTag)) {
        setFormData((prev) => ({
          ...prev,
          description: [...prev.description, newTag],
        }));
      }
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && formData.description.length > 0) {
      // Remove last tag if input is empty and backspace is pressed
      setFormData((prev) => ({
        ...prev,
        description: prev.description.slice(0, -1),
      }));
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      description: prev.description.filter((tag) => tag !== tagToRemove),
    }));
  };

  // Handle color-quantity entries
  const addColorQuantityEntry = () => {
    // Check if the last entry has both color and quantity filled
    const lastEntry = formData.colorQuantities[formData.colorQuantities.length - 1];
    if (!lastEntry.color || !lastEntry.quantity || lastEntry.quantity === "" || parseInt(lastEntry.quantity) <= 0) {
      setColorQuantityError("Please fill both color and quantity before adding a new entry");
      setTimeout(() => setColorQuantityError(""), 3000);
      return;
    }
    setColorQuantityError("");
    setFormData((prev) => ({
      ...prev,
      colorQuantities: [...prev.colorQuantities, { color: "", quantity: "" }],
    }));
  };

  const removeColorQuantityEntry = (index) => {
    if (formData.colorQuantities.length > 1) {
      setFormData((prev) => ({
        ...prev,
        colorQuantities: prev.colorQuantities.filter((_, i) => i !== index),
      }));
    }
  };

  const handleColorQuantityChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.colorQuantities];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      // Clear error if both fields are now filled for the last entry
      const lastIndex = updated.length - 1;
      if (index === lastIndex && updated[lastIndex].color && updated[lastIndex].quantity && parseInt(updated[lastIndex].quantity) > 0) {
        setColorQuantityError("");
      }
      return {
        ...prev,
        colorQuantities: updated,
      };
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    console.log("=== INPUT CHANGE ===");
    console.log("Field:", name);
    console.log("Value:", value);

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Handle model name autocomplete (YOUR WAY - store search string on every change)
    if (name === "modelName") {
      console.log("Model name changed to:", value);
      console.log("YOUR WAY - Storing search string on every change");

      // Store the search string immediately on every key input
      setModelSearchString(value.trim());
      console.log("STORED SEARCH STRING:", value.trim());

      setSelectedSuggestionIndex(-1); // Reset selection when typing

      // Clear any existing timeout immediately and prevent race conditions
      if (suggestionTimeoutRef.current) {
        console.log("Clearing existing timeout");
        clearTimeout(suggestionTimeoutRef.current);
        suggestionTimeoutRef.current = null;
      }

      // IMMEDIATELY hide suggestions if input is empty
      if (!value.trim()) {
        console.log("IMMEDIATE CLEAR - input empty");
        setModelSearchString(""); // Clear stored search string
        setModelSuggestions([]);
        setShowSuggestions(false);
        // Also clear loading state if it's active to prevent race conditions
        setSuggestionsLoading(false);
        return;
      }

      console.log(
        "Proceeding to fetch suggestions for stored search string:",
        value.trim()
      );
      console.log(
        "This will search for models containing stored string:",
        value.trim()
      );

      setShowSuggestions(false); // Hide suggestions immediately
      setSuggestionsLoading(true);

      // Use a small delay to prevent excessive API calls (works for both typing and backspace)
      suggestionTimeoutRef.current = setTimeout(() => {
        // Use the current value directly since modelSearchString might not be updated yet
        const currentSearchString = value.trim();
        console.log(
          "YOUR WAY - Using current search string:",
          currentSearchString
        );
        console.log("YOUR WAY - modelSearchString state:", modelSearchString);

        if (currentSearchString.length >= 1) {
          console.log(
            "YOUR WAY - Fetching model suggestions for current search string:",
            currentSearchString
          );
          console.log(
            "YOUR WAY - This will find models containing:",
            `"${currentSearchString}"`
          );
          fetchModelSuggestions(currentSearchString);
        } else {
          // Hide loading if search string became empty during delay
          setSuggestionsLoading(false);
        }
      }, 300);
    }

    // Handle company autocomplete
    if (name === "company") {
      console.log("Company changed to:", value);
      console.log("Value length:", value.length);
      console.log("Trimmed value:", value.trim());
      console.log("Previous company value:", formData.company);

      setSelectedCompanySuggestionIndex(-1); // Reset selection when typing

      // Clear any existing timeout immediately and prevent race conditions
      if (companySuggestionTimeoutRef.current) {
        console.log("Clearing existing company timeout");
        clearTimeout(companySuggestionTimeoutRef.current);
        companySuggestionTimeoutRef.current = null;
      }

      // IMMEDIATELY hide suggestions if input is empty
      if (!value.trim()) {
        console.log("IMMEDIATE CLEAR COMPANY - input empty");
        // Clear any pending timeout to prevent delayed API calls
        if (companySuggestionTimeoutRef.current) {
          console.log("CLEARING - Clearing company timeout on empty input");
          clearTimeout(companySuggestionTimeoutRef.current);
          companySuggestionTimeoutRef.current = null;
        }
        // Force immediate clearing of all states
        console.log(
          "CLEARING - Before clear - companySuggestions:",
          companySuggestions.length
        );
        console.log(
          "CLEARING - Before clear - showCompanySuggestions:",
          showCompanySuggestions
        );
        console.log(
          "CLEARING - Before clear - companySuggestionsLoading:",
          companySuggestionsLoading
        );

        setCompanySuggestions([]);
        setShowCompanySuggestions(false);
        setCompanySuggestionsLoading(false);
        setSelectedCompanySuggestionIndex(-1);

        console.log("CLEARING - States cleared immediately");
        // Force a second clear after a short delay to ensure no race conditions
        setTimeout(() => {
          setCompanySuggestions([]);
          setShowCompanySuggestions(false);
          setCompanySuggestionsLoading(false);
          setCompanyPosition(null);
          console.log("CLEARING - Second clear completed");
        }, 50);
        return;
      }

      console.log("Proceeding to fetch company suggestions for:", value.trim());
      console.log(
        "This will search for companies starting with:",
        value.trim()
      );
      console.log("Previous company value:", formData.company);
      console.log(
        "This works for both typing and backspace - same behavior as model name"
      );
      console.log(
        "GOOGLE-STYLE PREFIX MATCHING: Each key input will find company suggestions starting with the input string"
      );

      // Show loading immediately when user starts typing (including backspace)
      setShowCompanySuggestions(false); // Hide suggestions immediately
      setCompanySuggestionsLoading(true);

      // Use a small delay to prevent excessive API calls (works for both typing and backspace)
      companySuggestionTimeoutRef.current = setTimeout(() => {
        // Always use the current input value, not the stale formData state
        const currentValue = value.trim();
        console.log("STORED STRING CHECK - Current input value:", currentValue);
        console.log(
          "STORED STRING CHECK - formData.company (old state):",
          formData.company
        );

        if (currentValue.length >= 1) {
          console.log(
            "STORED STRING - Fetching company suggestions for current input string:",
            currentValue
          );
          console.log(
            "STORED STRING - This will find companies containing:",
            `"${currentValue}"`
          );
          fetchCompanySuggestions(currentValue);
        } else {
          // Hide loading if input became empty during delay
          setCompanySuggestionsLoading(false);
        }
      }, 300);
    }

    // Check for existing purchase price when relevant fields change
    if (
      name === "modelName" ||
      name === "company" ||
      name === "purchaseDate" ||
      name === "purchasedInWarranty"
    ) {
      checkExistingPurchasePrice({
        ...formData,
        [name]: type === "checkbox" ? checked : value,
      });
    }
  };

  // Fetch model name suggestions from database
  const fetchModelSuggestions = async (searchTerm) => {
    console.log("=== FETCHING SUGGESTIONS ===");
    console.log("Search term:", searchTerm);

    if (searchTerm.trim().length < 1) {
      console.log("Search term empty, clearing suggestions");
      setModelSuggestions([]);
      setShowSuggestions(false);
      setSuggestionPosition(null);
      return;
    }

    // Set position immediately before showing loading
    if (modelNameInputRef.current) {
      const rect = modelNameInputRef.current.getBoundingClientRect();
      setSuggestionPosition({
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }

    setShowSuggestions(true);
    setModelSuggestions([{ loading: true }]); // Show loading indicator

    // Add a small delay to ensure loading state is visible
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      console.log("Making API call to suggestions endpoint");
      console.log(
        "API URL:",
        `${API_BASE}/models/suggestions?search=${encodeURIComponent(
          searchTerm.trim()
        )}`
      );

      const response = await fetch(
        `${API_BASE}/models/suggestions?search=${encodeURIComponent(
          searchTerm.trim()
        )}`
      );

      console.log("API Response status:", response.status);
      console.log("API Response ok:", response.ok);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Model API response:", data);

      if (!data.success || !Array.isArray(data.suggestions)) {
        console.error("Invalid response format:", data);
        setModelSuggestions([]);
        setShowSuggestions(false);
        setSuggestionPosition(null);
        return;
      }

      const uniqueSuggestions = [...new Set(data.suggestions || [])]; // Remove duplicates
      console.log("Unique suggestions:", uniqueSuggestions);

      setModelSuggestions(uniqueSuggestions.slice(0, 4)); // Limit to 4 suggestions
      setShowSuggestions(uniqueSuggestions.length > 0);
    } catch (error) {
      console.error("Error fetching model suggestions:", error);
      console.error("Full error details:", error.message);
      setModelSuggestions([]);
      setShowSuggestions(false);
      setSuggestionPosition(null);
    }
  };

  // Fetch company suggestions from database
  const fetchCompanySuggestions = async (searchTerm) => {
    console.log("=== FETCHING COMPANY SUGGESTIONS ===");
    console.log("Search term:", searchTerm);

    if (searchTerm.trim().length < 1) {
      console.log("Search term empty, clearing company suggestions");
      setCompanySuggestions([]);
      setShowCompanySuggestions(false);
      setSelectedCompanySuggestionIndex(-1);
      setCompanyPosition(null);
      return;
    }

    // Set position immediately before showing loading
    if (companyInputRef.current) {
      const rect = companyInputRef.current.getBoundingClientRect();
      setCompanyPosition({
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }

    setShowCompanySuggestions(true);
    setCompanySuggestions([{ loading: true }]); // Show loading indicator

    // Add a small delay to ensure loading state is visible
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      console.log(
        "Making API call to fetch companies using BULLETPROOF endpoint"
      );
      console.log(
        "API URL:",
        `${API_BASE}/models/company-suggestions?search=${encodeURIComponent(
          searchTerm.trim()
        )}`
      );

      // Use the dedicated company suggestions endpoint with bulletproof logic
      const response = await fetch(
        `${API_BASE}/models/company-suggestions?search=${encodeURIComponent(
          searchTerm.trim()
        )}`
      );

      console.log("API Response status:", response.status);
      console.log("API Response ok:", response.ok);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Company API response:", data);

      if (!data.success || !Array.isArray(data.companies)) {
        console.error("Invalid company response format:", data);
        setCompanySuggestions([]);
        setShowCompanySuggestions(false);
        setSelectedCompanySuggestionIndex(-1);
        setCompanyPosition(null);
        return;
      }

      // The bulletproof backend already returns sorted companies directly
      const companies = data.companies;

      console.log("BULLETPROOF - Received companies from backend:", companies);
      console.log("BULLETPROOF - Total companies:", companies.length);

      setCompanySuggestions(companies.slice(0, 4)); // Limit to 4 suggestions
      setShowCompanySuggestions(companies.length > 0);
    } catch (error) {
      console.error("Error fetching company suggestions:", error);
      console.error("Full error details:", error.message);
      setCompanySuggestions([]);
      setShowCompanySuggestions(false);
      setSelectedCompanySuggestionIndex(-1);
      setCompanyPosition(null);
    }
  };

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Handle model name suggestions
      if (
        modelNameInputRef.current &&
        !modelNameInputRef.current.contains(event.target) &&
        !event.target.closest('[data-suggestion-portal]')
      ) {
        // Only hide if not clicking on the input field itself or suggestion portal
        if (event.target.name !== "modelName") {
          setShowSuggestions(false);
          setModelSuggestions([]);
          setSuggestionPosition(null);
          setSelectedSuggestionIndex(-1);
        }
      }

      // Handle company suggestions
      if (
        companyInputRef.current &&
        !companyInputRef.current.contains(event.target) &&
        !event.target.closest('[data-suggestion-portal]')
      ) {
      if (event.target.name !== "company") {
        setShowCompanySuggestions(false);
          setCompanySuggestions([]);
          setSelectedCompanySuggestionIndex(-1);
          setCompanyPosition(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion) => {
    // Don't select if it's a loading indicator
    if (suggestion && typeof suggestion === 'object' && suggestion.loading) {
      return;
    }
    
    setFormData((prev) => ({
      ...prev,
      modelName: suggestion || "",
    }));
    setShowSuggestions(false);
    setModelSuggestions([]);
    setSelectedSuggestionIndex(-1);
    setSuggestionPosition(null);
  };

  const handleCompanySuggestionSelect = (company) => {
    if (company && typeof company === 'object' && company.loading) {
      return; // Don't select loading items
    }
    setFormData((prev) => ({
      ...prev,
      company,
    }));
    setShowCompanySuggestions(false);
    setCompanySuggestions([]);
    setSelectedCompanySuggestionIndex(-1);
    setCompanyPosition(null);
  };

  // Check for duplicate model with same details
  const checkDuplicateModel = async () => {
    try {
      // Duplicate check only considers model name, company, and warranty status
      console.log("=== DUPLICATE CHECK START ===");
      console.log("Checking duplicate for:", {
        modelName: formData.modelName,
        company: formData.company,
        purchasedInWarranty: formData.purchasedInWarranty,
      });

      // First test if backend is accessible
      try {
        const testResponse = await fetch(`${API_BASE}/models`);
        console.log("Backend connectivity test - status:", testResponse.status);
        if (testResponse.status !== 200) {
          throw new Error("Backend not responding correctly");
        }
      } catch (testErr) {
        console.error("Backend server not accessible:", testErr);
        setError("Backend server is not running. Please start the server.");
        return { exists: false }; // Allow creation if backend is down
      }

      // Build the duplicate check URL (only checks model name, company, and warranty)
      const checkUrl = `${API_BASE}/models/check-duplicate?modelName=${encodeURIComponent(
        formData.modelName
      )}&company=${encodeURIComponent(
        formData.company
      )}&purchasedInWarranty=${encodeURIComponent(
        formData.purchasedInWarranty
      )}`;

      console.log("Calling duplicate check URL:", checkUrl);
      console.log("URL parameters:");
      console.log("- modelName:", formData.modelName);
      console.log("- company:", formData.company);
      console.log("- purchasedInWarranty:", formData.purchasedInWarranty);

      const response = await fetch(checkUrl);

      console.log("Duplicate check response status:", response.status);

      const data = await response.json();
      console.log("=== FULL API RESPONSE ===");
      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      console.log("Response data:", data);
      console.log("data.exists:", data.exists);
      console.log("data.model:", data.model);
      console.log("=== END API RESPONSE ===");

      if (!response.ok) {
        console.error("Duplicate check failed:", data);
        return { exists: false }; // Allow creation if check fails
      }

      if (data.exists) {
        console.log("=== DUPLICATE FOUND - BLOCKING CREATION ===");
        console.log(
          "Backend found duplicate with same purchase date:",
          data.model
        );

        // Backend already checked dates, so just block if exists: true
        return {
          exists: true,
          message: `A model with the same details (Model: ${
            formData.modelName
          }, Company: ${
            formData.company
          }, Warranty Status: ${
            data.model.purchasedInWarranty ? "In Warranty" : "Out of Warranty"
          }) already exists. Each combination of name, company, and warranty status should be unique.`,
          existingModel: data.model,
        };
      }

      console.log("=== NO DUPLICATE FOUND - ALLOWING CREATION ===");
      return { exists: false };
    } catch (err) {
      console.error("=== DUPLICATE CHECK ERROR ===", err);
      setError(
        "Network error while checking duplicates. Please check your connection."
      );
      return { exists: false }; // Allow creation if check fails
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (!formData.modelName || !formData.company || !formData.sellingPrice) {
      setError("Model name, company, and selling price are required");
      return;
    }

    if (parseFloat(formData.sellingPrice) <= 0) {
      setError("Selling price must be greater than 0");
      return;
    }

    // Color validation removed - color is optional when creating new models

    // Check for duplicate model with same details
    const duplicateCheck = await checkDuplicateModel();
    if (duplicateCheck.exists) {
      setError(duplicateCheck.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/models`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelName: formData.modelName,
          company: formData.company,
          colour: formData.colour || "", // Color is optional, default to empty string
          quantity: 0, // Quantity will be managed through stock entries
          sellingPrice: parseFloat(formData.sellingPrice),
          batteriesPerSet: parseInt(formData.batteriesPerSet) || 5,
          description: formData.description || [],
          colorQuantities: formData.colorQuantities
            .filter((entry) => entry.color && entry.quantity)
            .map((entry) => ({
              color: entry.color,
              quantity: parseInt(entry.quantity) || 0,
            })),
          purchasedInWarranty: formData.purchasedInWarranty,
          purchasePrice: autoAppliedPrice || 0, // Use auto-applied price if available
          purchaseDate: formData.purchaseDate
            ? new Date(parseDate(formData.purchaseDate))
            : new Date(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error creating model");
      }

      console.log("Model created successfully:", data);

      // Navigate directly without showing purchase price dialog
      // Navigate to appropriate page based on where we came from
      if (isAddingColorVariant && isAdminAdd) {
        // Admin color variant: go back to admin panel
        navigate("/admin?section=models");
      } else if (isAddingColorVariant) {
        // Regular color variant: go back to All Models page
        navigate("/models/all");
      } else if (isAdminAdd) {
        // Admin add model: go back to admin panel
        navigate("/admin?section=models");
      } else {
        // Regular add model: go back to All Models page
        navigate("/models/all");
      }
    } catch (err) {
      console.error("Error creating model:", err);
      setError(err.message || "Error creating model. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePurchasePriceResponse = (wantsToAddPrice) => {
    setShowPurchasePriceDialog(false);
    if (wantsToAddPrice) {
      // Check if admin is already logged in
      const isAdminAuth = sessionStorage.getItem("adminAuth");
      if (isAdminAuth) {
        // Admin is already logged in, go directly to models section
        navigate("/admin?section=models");
      } else {
        // Admin is logged out, go to login page with redirect to models section
        navigate("/admin-login?redirect=/admin?section=models");
      }
    } else {
      // Navigate to appropriate page based on where we came from
      if (isAddingColorVariant && isAdminAdd) {
        // Admin color variant: go back to admin panel
        navigate("/admin?section=models");
      } else if (isAddingColorVariant) {
        // Regular color variant: go back to All Models page
        navigate("/models/all");
      } else if (isAdminAdd) {
        // Admin add model: go back to admin panel
        navigate("/admin?section=models");
      } else {
        // Regular add model: go back to All Models page
        navigate("/models/all");
      }
    }
  };

  return (
    <div className="model-container">
      <h2>{isAddingColorVariant ? "Add Color Variant" : "Add a Model"}</h2>

      {isAddingColorVariant && (
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#e8f5e8",
            border: "1px solid #4caf50",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
            color: "#2e7d32",
            fontSize: "0.875rem",
          }}
        >
          <strong>Adding color variant for:</strong> {formData.modelName} (
          {formData.company})
          <br />
          <small>
            {shouldLockAdditionalFields
              ? "Model name, company, purchase date, and warranty status are locked. You can edit color only."
              : "Model name and company are locked. You can edit color, warranty, and purchase date."}
          </small>
        </div>
      )}

      <div className="model-form">
        {/* Model Details */}
        <div className="form-section">
          <h3>Model Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Model Name *</label>
              <div style={{ position: "relative" }} ref={suggestionsRef}>
                <input
                  ref={modelNameInputRef}
                  type="text"
                  name="modelName"
                  value={formData.modelName}
                  onChange={handleInputChange}
                  placeholder="Enter model name"
                  required
                  autoComplete="off"
                  readOnly={isAddingColorVariant}
                  style={{
                    backgroundColor: isAddingColorVariant ? "#f5f5f5" : "white",
                    cursor: isAddingColorVariant ? "not-allowed" : "text",
                  }}
                  onKeyDown={(e) => {
                    // Handle keyboard navigation for suggestions
                    if (showSuggestions && modelSuggestions.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        // Move to next suggestion with cyclic behavior
                        let newIndex;
                        if (
                          selectedSuggestionIndex >=
                          modelSuggestions.length - 1
                        ) {
                          // If at last suggestion, cycle back to first
                          newIndex = 0;
                        } else {
                          // Otherwise move to next
                          newIndex = selectedSuggestionIndex + 1;
                        }
                        setSelectedSuggestionIndex(newIndex);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        // Move to previous suggestion with cyclic behavior
                        let newIndex;
                        if (selectedSuggestionIndex <= 0) {
                          // If at first suggestion, cycle to last
                          newIndex = modelSuggestions.length - 1;
                        } else {
                          // Otherwise move to previous
                          newIndex = selectedSuggestionIndex - 1;
                        }
                        setSelectedSuggestionIndex(newIndex);
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        // Select the highlighted suggestion (skip loading items)
                        if (selectedSuggestionIndex >= 0) {
                          const selected = modelSuggestions[selectedSuggestionIndex];
                          if (!(selected && typeof selected === 'object' && selected.loading)) {
                            handleSuggestionSelect(selected);
                          }
                        } else if (modelSuggestions.length > 0) {
                          // If no suggestion is highlighted, select the first non-loading one
                          const firstNonLoading = modelSuggestions.find(
                            s => !(s && typeof s === 'object' && s.loading)
                          );
                          if (firstNonLoading) {
                            handleSuggestionSelect(firstNonLoading);
                          }
                        }
                      } else if (e.key === "Escape") {
                        // Hide suggestions on Escape
                        setShowSuggestions(false);
                        setModelSuggestions([]);
                        setSelectedSuggestionIndex(-1);
                        setSuggestionPosition(null);
                      }
                    }
                  }}
                />

                {/* Suggestions Portal */}
                {showSuggestions &&
                  modelSuggestions.length > 0 &&
                  suggestionPosition &&
                  createPortal(
                    <SuggestionsPortal
                      suggestions={modelSuggestions}
                      selectedIndex={selectedSuggestionIndex}
                      onSelect={handleSuggestionSelect}
                      position={suggestionPosition}
                      inputName="modelName"
                    />,
                    document.body
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Company *</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder="Enter company name"
                  required
                  autoComplete="off"
                  readOnly={isAddingColorVariant}
                  ref={companyInputRef}
                  style={{
                    backgroundColor: isAddingColorVariant ? "#f5f5f5" : "white",
                    cursor: isAddingColorVariant ? "not-allowed" : "text",
                  }}
                  onKeyDown={(e) => {
                    // Handle keyboard navigation for company suggestions
                    if (
                      showCompanySuggestions &&
                      companySuggestions.length > 0
                    ) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        // Find next non-loading suggestion
                        let newIndex = selectedCompanySuggestionIndex;
                        let attempts = 0;
                        do {
                          newIndex =
                            newIndex >= companySuggestions.length - 1
                              ? 0
                              : newIndex + 1;
                          attempts++;
                        } while (
                          attempts < companySuggestions.length &&
                          companySuggestions[newIndex] &&
                          typeof companySuggestions[newIndex] === "object" &&
                          companySuggestions[newIndex].loading
                        );
                        setSelectedCompanySuggestionIndex(newIndex);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        // Find previous non-loading suggestion
                        let newIndex = selectedCompanySuggestionIndex;
                        let attempts = 0;
                        do {
                          newIndex =
                            newIndex <= 0
                              ? companySuggestions.length - 1
                              : newIndex - 1;
                          attempts++;
                        } while (
                          attempts < companySuggestions.length &&
                          companySuggestions[newIndex] &&
                          typeof companySuggestions[newIndex] === "object" &&
                          companySuggestions[newIndex].loading
                        );
                        setSelectedCompanySuggestionIndex(newIndex);
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        // Select the highlighted suggestion (skip loading items)
                        if (selectedCompanySuggestionIndex >= 0) {
                          const selected = companySuggestions[selectedCompanySuggestionIndex];
                          if (!(selected && typeof selected === 'object' && selected.loading)) {
                            handleCompanySuggestionSelect(selected);
                          }
                        } else if (companySuggestions.length > 0) {
                          // If no suggestion is highlighted, select the first non-loading one
                          const firstNonLoading = companySuggestions.find(
                            s => !(s && typeof s === 'object' && s.loading)
                          );
                          if (firstNonLoading) {
                            handleCompanySuggestionSelect(firstNonLoading);
                          }
                        }
                      } else if (e.key === "Escape") {
                        // Hide company suggestions on Escape
                        setShowCompanySuggestions(false);
                        setCompanySuggestions([]);
                        setSelectedCompanySuggestionIndex(-1);
                        setCompanyPosition(null);
                      }
                    }
                  }}
                />

                {/* Company Suggestions Portal */}
                {showCompanySuggestions &&
                  companySuggestions.length > 0 &&
                  companyPosition &&
                  createPortal(
                    <SuggestionsPortal
                      suggestions={companySuggestions}
                      selectedIndex={selectedCompanySuggestionIndex}
                      onSelect={handleCompanySuggestionSelect}
                      position={companyPosition}
                      inputName="company"
                    />,
                    document.body
                )}
              </div>
            </div>
          </div>


          <div className="form-row">
            <div className="form-group">
              <label>Batteries Per Set *</label>
              <select
                name="batteriesPerSet"
                value={formData.batteriesPerSet}
                onChange={handleInputChange}
                required
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              >
                <option value={5}>5 batteries</option>
                <option value={6}>6 batteries</option>
              </select>
            </div>

            <div className="form-group">
              <label>Selling Price ({formData.batteriesPerSet} batteries) *</label>
              <input
                type="number"
                name="sellingPrice"
                value={formData.sellingPrice}
                onChange={handleInputChange}
                placeholder={`Enter selling price for ${formData.batteriesPerSet} batteries`}
                min="0"
                step="0.01"
                required
                disabled={isSubmitting}
                onWheel={(e) => e.target.blur()}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>

            <div className="form-group">
              <label>Purchase Date</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  position: "relative",
                }}
              >
                <input
                  type="text"
                  name="purchaseDate"
                  value={formData.purchaseDate}
                  onChange={handleDateChange}
                  onBlur={(e) => {
                    handleDateBlur(e);
                    e.target.style.borderColor = "#e5e7eb";
                    e.target.style.boxShadow = "none";
                  }}
                  placeholder="dd/mm/yyyy"
                  maxLength="10"
                  disabled={isDateDisabled}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.875rem",
                    border: "2px solid #e5e7eb",
                    borderRadius: "0.5rem",
                    fontSize: "0.9rem",
                    fontWeight: "500",
                    color: "#374151",
                    backgroundColor: shouldLockAdditionalFields
                      ? "#f5f5f5"
                      : "#ffffff",
                    transition: "all 0.2s ease",
                    cursor: isDateDisabled ? "not-allowed" : "text",
                  }}
                  onFocus={(e) => {
                    if (!isDateDisabled) {
                      e.target.style.borderColor = "#6366f1";
                      e.target.style.boxShadow =
                        "0 0 0 3px rgba(99, 102, 241, 0.1)";
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isDateDisabled}
                  onClick={(e) => {
                    const button = e.currentTarget;
                    const rect = button.getBoundingClientRect();
                    const input = document.createElement("input");
                    input.type = "date";
                    input.value = parseDate(formData.purchaseDate) || "";
                    input.style.position = "fixed";
                    input.style.left = `${rect.left}px`;
                    input.style.top = `${rect.bottom}px`;
                    input.style.opacity = "0";
                    input.style.pointerEvents = "none";
                    document.body.appendChild(input);
                    requestAnimationFrame(() => {
                      input.showPicker?.();
                    });
                    input.addEventListener("change", (e) => {
                      const isoValue = e.target.value;
                      if (isoValue) {
                        const [year, month, day] = isoValue.split("-");
                        const formatted = `${day.padStart(
                          2,
                          "0"
                        )}/${month.padStart(2, "0")}/${year}`;
                        setFormData((prev) => ({
                          ...prev,
                          purchaseDate: formatted,
                        }));
                      }
                      document.body.removeChild(input);
                    });
                    input.addEventListener("cancel", () => {
                      document.body.removeChild(input);
                    });
                  }}
                  style={{
                    width: "2.2rem",
                    height: "2.2rem",
                    borderRadius: "9999px",
                    border: "1px solid #d1d5db",
                    backgroundColor: isDateDisabled ? "#f3f4f6" : "#ffffff",
                    cursor: isDateDisabled ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1rem",
                  }}
                >
                  📅
                </button>
              </div>
              {autoAppliedPrice && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                    padding: "0.75rem",
                    backgroundColor: "#e8f5e8",
                    border: "1px solid #4caf50",
                    borderRadius: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        color: "#4caf50",
                        fontSize: "0.9rem",
                        fontWeight: "500",
                      }}
                    >
                      ✅ Purchase price automatically applied
                    </span>
                  </div>
                  {referenceModel && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                      }}
                    >
                      <small style={{ color: "#666", fontSize: "0.8rem" }}>
                        Based on existing model: {referenceModel.modelName}{" "}
                        {referenceModel.company} ({referenceModel.colour})
                      </small>
                      <small style={{ color: "#666", fontSize: "0.8rem" }}>
                        Warranty:{" "}
                        {referenceModel.purchasedInWarranty
                          ? "In Warranty"
                          : "Out of Warranty"}
                      </small>
                    </div>
                  )}
                  <small style={{ color: "#666", fontSize: "0.8rem" }}>
                    Same model, company, purchase date, and warranty status
                    found
                  </small>
                </div>
              )}
              <small
                style={{
                  display: "block",
                  marginTop: "0.25rem",
                  color: "#666",
                  fontSize: "0.8rem",
                }}
              >
                Default is today's date. Change if needed.
              </small>
            </div>
          </div>

          {/* Color and Quantity Entries */}
          <div className="form-row">
            <div className="form-group" style={{ width: "100%" }}>
              <label>Color & Quantity</label>
              {formData.colorQuantities.map((entry, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                    alignItems: "flex-start",
                  }}
                >
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: "0.875rem", marginBottom: "0.25rem", display: "block" }}>
                      Color
                    </label>
                    <select
                      value={entry.color}
                      onChange={(e) =>
                        handleColorQuantityChange(index, "color", e.target.value)
                      }
                      disabled={isSubmitting}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <option value="">Select color</option>
                      {colorOptions.map((color) => {
                        // Get all selected colors except the current entry
                        const selectedColors = formData.colorQuantities
                          .map((e, i) => i !== index ? e.color : "")
                          .filter(c => c && c !== "");
                        const isDisabled = selectedColors.includes(color.value);
                        return (
                          <option 
                            key={color.value} 
                            value={color.value}
                            disabled={isDisabled}
                          >
                            {color.label} {isDisabled ? "(already selected)" : ""}
                          </option>
                        );
                      })}
                      <option 
                        value="other"
                        disabled={formData.colorQuantities
                          .map((e, i) => i !== index ? e.color : "")
                          .filter(c => c === "other").length > 0}
                      >
                        Other (specify) {formData.colorQuantities
                          .map((e, i) => i !== index ? e.color : "")
                          .filter(c => c === "other").length > 0 ? "(already selected)" : ""}
                      </option>
                    </select>
                    {/* Color Preview */}
                    <div
                      style={{
                        width: "100%",
                        height: "40px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        position: "relative",
                        overflow: "hidden",
                        backgroundColor: "#f5f5f5",
                      }}
                    >
                      {/* White-Black split background */}
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
                              ? colorOptions.find((c) => c.value === entry.color)
                                  ?.label
                              : entry.color === "other"
                              ? "Custom"
                              : "No color"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: "0.875rem", marginBottom: "0.25rem", display: "block" }}>
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
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                  {formData.colorQuantities.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeColorQuantityEntry(index)}
                      disabled={isSubmitting}
                      style={{
                        padding: "0.5rem",
                        border: "1px solid #dc2626",
                        borderRadius: "4px",
                        backgroundColor: "#fee2e2",
                        color: "#dc2626",
                        cursor: "pointer",
                        fontSize: "1rem",
                        width: "40px",
                        height: "40px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title="Remove entry"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={addColorQuantityEntry}
                  disabled={isSubmitting}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "1px solid #10b981",
                    borderRadius: "4px",
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
          </div>

          <div className="form-row">
            <div className="form-group" style={{ width: "100%" }}>
              <label>Description (Tags) *</label>
              <div
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  padding: "0.5rem",
                  minHeight: "60px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "center",
                  backgroundColor: "#fff",
                }}
              >
                {/* Display existing tags */}
                {formData.description.map((tag, index) => (
                  <span
                    key={index}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.25rem 0.5rem",
                      backgroundColor: "#6366f1",
                      color: "#fff",
                      borderRadius: "4px",
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
                {/* Tag input field */}
                <input
                  type="text"
                  value={tagInput}
                  onChange={handleTagInputChange}
                  onKeyDown={handleTagKeyDown}
                  placeholder={
                    formData.description.length === 0
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
                Press Enter to add a tag. Press Backspace to remove the last tag.
              </small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Purchase Information</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  backgroundColor: "#f9f9f9",
                }}
              >
                <input
                  type="checkbox"
                  name="purchasedInWarranty"
                  checked={formData.purchasedInWarranty}
                  onChange={handleInputChange}
                  disabled={isSubmitting || shouldLockAdditionalFields}
                  style={{
                    width: "16px",
                    height: "16px",
                    cursor:
                      isSubmitting || shouldLockAdditionalFields
                        ? "not-allowed"
                        : "pointer",
                  }}
                />
                <label
                  htmlFor="purchasedInWarranty"
                  style={{
                    margin: 0,
                    cursor:
                      isSubmitting || shouldLockAdditionalFields
                        ? "not-allowed"
                        : "pointer",
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
        </div>

        <div className="form-actions">
          {error && (
            <div
              className="error-message"
              style={{ color: "#dc2626", marginBottom: "1rem" }}
            >
              {error}
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Model"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              isAddingColorVariant && isAdminAdd
                ? navigate("/admin?section=models")
                : isAddingColorVariant
                ? navigate("/models/all")
                : isAdminAdd
                ? navigate("/admin?section=models")
                : navigate("/models/all")
            }
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Purchase Price Confirmation Dialog */}
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
            zIndex: 1000,
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
              textAlign: "center",
            }}
          >
            <h3 style={{ marginBottom: "1rem", color: "#333" }}>
              Model Created Successfully! 🎉
            </h3>
            {autoAppliedPrice ? (
              <div>
                <p
                  style={{
                    marginBottom: "1rem",
                    color: "#4caf50",
                    fontWeight: "500",
                    lineHeight: "1.5",
                  }}
                >
                  ✅ Purchase price automatically applied
                </p>
                {referenceModel && (
                  <div style={{ marginBottom: "1rem" }}>
                    <p
                      style={{
                        color: "#666",
                        fontSize: "0.9rem",
                        lineHeight: "1.5",
                        margin: "0 0 0.5rem 0",
                      }}
                    >
                      Based on existing model: {referenceModel.modelName}{" "}
                      {referenceModel.company} ({referenceModel.colour})
                    </p>
                    <p
                      style={{
                        color: "#666",
                        fontSize: "0.9rem",
                        lineHeight: "1.5",
                        margin: "0",
                      }}
                    >
                      Warranty Status:{" "}
                      {referenceModel.purchasedInWarranty
                        ? "In Warranty"
                        : "Out of Warranty"}
                    </p>
                  </div>
                )}
                <p
                  style={{
                    marginBottom: "1.5rem",
                    color: "#666",
                    lineHeight: "1.5",
                  }}
                >
                  The purchase price was automatically set based on existing
                  models with the same details and warranty status.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    justifyContent: "center",
                  }}
                >
                  <button
                    className="btn btn-primary"
                    onClick={() => handlePurchasePriceResponse(false)}
                    style={{
                      padding: "0.75rem 1.5rem",
                      fontSize: "1rem",
                      cursor: "pointer",
                    }}
                  >
                    OK
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p
                  style={{
                    marginBottom: "1.5rem",
                    color: "#666",
                    lineHeight: "1.5",
                  }}
                >
                  Would you like to enter the purchase price for this model? You
                  can set it for all colors of this model in the admin panel.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    justifyContent: "center",
                  }}
                >
                  <button
                    className="btn btn-primary"
                    onClick={() => handlePurchasePriceResponse(true)}
                    style={{
                      padding: "0.75rem 1.5rem",
                      fontSize: "1rem",
                      cursor: "pointer",
                    }}
                  >
                    Yes, Add Price
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handlePurchasePriceResponse(false)}
                    style={{
                      padding: "0.75rem 1.5rem",
                      fontSize: "1rem",
                      cursor: "pointer",
                    }}
                  >
                    No, Skip
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
