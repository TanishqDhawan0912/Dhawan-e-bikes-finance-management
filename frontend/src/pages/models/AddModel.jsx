import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTodayFormatted, formatDate } from "../../utils/dateUtils";
import { useSessionTimeout } from "../../hooks/useSessionTimeout";

export default function AddModel() {
  const navigate = useNavigate();
  const suggestionsRef = useRef(null);
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
    purchasedInWarranty: false,
    purchaseDate: getTodayFormatted(), // Default to today's date in dd/mm/yyyy format
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  // Model name search state (your way - store search string on every change)
  const [modelSearchString, setModelSearchString] = useState("");
  // Company suggestions state
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [companySuggestionsLoading, setCompanySuggestionsLoading] =
    useState(false);
  const [showPurchasePriceDialog, setShowPurchasePriceDialog] = useState(false);
  const [autoAppliedPrice, setAutoAppliedPrice] = useState(null);

  // Effect to fetch model data when adding color variant
  useEffect(() => {
    if (modelId) {
      setIsAddingColorVariant(true);
      const fetchModelData = async () => {
        try {
          const response = await fetch(
            `http://localhost:5000/api/models/${modelId}`
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || "Error fetching model data");
          }

          // Pre-fill form with existing model data
          setFormData({
            modelName: data.data.modelName,
            company: data.data.company,
            colour: "",
            quantity: "",
            purchasedInWarranty: data.data.purchasedInWarranty || false,
            purchaseDate: data.data.purchaseDate
              ? formatDate(data.data.purchaseDate)
              : getTodayFormatted(),
          });

          setError("");
        } catch (err) {
          setError(err.message || "Error fetching model data");
        }
      };

      fetchModelData();
    }
  }, [modelId]);
  const [referenceModel, setReferenceModel] = useState(null);
  const suggestionTimeoutRef = useRef(null);
  const companySuggestionTimeoutRef = useRef(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [selectedCompanySuggestionIndex, setSelectedCompanySuggestionIndex] =
    useState(-1);

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
      return;
    }

    const startTime = Date.now();
    setSuggestionsLoading(true);

    try {
      console.log("Making API call to suggestions endpoint");
      console.log(
        "API URL:",
        `http://localhost:5000/api/models/suggestions?search=${encodeURIComponent(
          searchTerm.trim()
        )}`
      );

      const response = await fetch(
        `http://localhost:5000/api/models/suggestions?search=${encodeURIComponent(
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
        return;
      }

      const uniqueSuggestions = [...new Set(data.suggestions || [])]; // Remove duplicates
      console.log("Unique suggestions:", uniqueSuggestions);

      // Calculate remaining time to ensure minimum 500ms loading
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 500 - elapsedTime);

      console.log(
        `Elapsed time: ${elapsedTime}ms, Remaining time: ${remainingTime}ms`
      );

      // Wait for remaining time to ensure minimum loading time
      if (remainingTime > 0) {
        console.log("Waiting for minimum loading time...");
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }

      setModelSuggestions(uniqueSuggestions.slice(0, 4)); // Limit to 4 suggestions

      // Only show suggestions if we have results
      if (uniqueSuggestions.length > 0) {
        setShowSuggestions(true);
        console.log("Showing suggestions");
      } else {
        setShowSuggestions(false);
        console.log("No suggestions to show");
      }
    } catch (error) {
      console.error("Error fetching model suggestions:", error);
      console.error("Full error details:", error.message);
      setModelSuggestions([]);
      setShowSuggestions(false);
      setSuggestionsLoading(false);
    } finally {
      // Ensure loading shows for at least 500ms even on error
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 500 - elapsedTime);

      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }

      setSuggestionsLoading(false);
      console.log("Suggestions loading finished");
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
      return;
    }

    const startTime = Date.now();
    setCompanySuggestionsLoading(true);

    try {
      console.log(
        "Making API call to fetch companies using BULLETPROOF endpoint"
      );
      console.log(
        "API URL:",
        `http://localhost:5000/api/models/company-suggestions?search=${encodeURIComponent(
          searchTerm.trim()
        )}`
      );

      // Use the dedicated company suggestions endpoint with bulletproof logic
      const response = await fetch(
        `http://localhost:5000/api/models/company-suggestions?search=${encodeURIComponent(
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
        return;
      }

      // The bulletproof backend already returns sorted companies directly
      const companies = data.companies;

      console.log("BULLETPROOF - Received companies from backend:", companies);
      console.log("BULLETPROOF - Total companies:", companies.length);

      // The bulletproof backend already returns sorted companies directly
      // No need for additional frontend sorting
      console.log("BULLETPROOF - Using backend-sorted companies:", companies);

      console.log("BULLETPROOF - Final companies to display:", companies);
      console.log("BULLETPROOF - Search term was:", searchTerm);

      // Calculate remaining time to ensure minimum 500ms loading for companies
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 500 - elapsedTime);

      console.log(
        `BULLETPROOF - Company search - Elapsed time: ${elapsedTime}ms, Remaining time: ${remainingTime}ms`
      );

      // Wait for remaining time to ensure minimum loading time
      if (remainingTime > 0) {
        console.log(
          "BULLETPROOF - Waiting for minimum company loading time..."
        );
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }

      setCompanySuggestions(companies.slice(0, 4)); // Limit to 4 suggestions

      // Only show suggestions if we have results
      if (companies.length > 0) {
        setShowCompanySuggestions(true);
        console.log("Showing company suggestions");
      } else {
        setShowCompanySuggestions(false);
        console.log("No company suggestions to show");
      }
    } catch (error) {
      console.error("Error fetching company suggestions:", error);
      console.error("Full error details:", error.message);
      setCompanySuggestions([]);
      setShowCompanySuggestions(false);
      setCompanySuggestionsLoading(false);
    } finally {
      setCompanySuggestionsLoading(false);
      console.log("Company suggestions loading finished");
    }
  };

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target)
      ) {
        // Only hide if not clicking on the input field itself
        if (event.target.name !== "modelName") {
          setShowSuggestions(false);
        }
      }

      // Hide company suggestions when clicking outside
      if (event.target.name !== "company") {
        setShowCompanySuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion) => {
    setFormData((prev) => ({
      ...prev,
      modelName: suggestion,
    }));
    setShowSuggestions(false);
    setModelSuggestions([]);
    setSelectedSuggestionIndex(-1);
  };

  const handleCompanySuggestionSelect = (company) => {
    setFormData((prev) => ({
      ...prev,
      company,
    }));
    setShowCompanySuggestions(false);
    setCompanySuggestions([]);
    setSelectedCompanySuggestionIndex(-1);
  };

  // Check for existing purchase price for models with same details
  const checkExistingPurchasePrice = async (currentFormData) => {
    if (
      !currentFormData.modelName ||
      !currentFormData.company ||
      !currentFormData.purchaseDate
    ) {
      setAutoAppliedPrice(null);
      return;
    }

    try {
      const checkUrl = `http://localhost:5000/api/models/check-purchase-price?modelName=${encodeURIComponent(
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
  };

  // Check for duplicate model with same details
  const checkDuplicateModel = async () => {
    try {
      const colour =
        formData.colour === "other" ? formData.customColour : formData.colour;

      console.log("=== DUPLICATE CHECK START ===");
      console.log("Checking duplicate for:", {
        modelName: formData.modelName,
        company: formData.company,
        colour: colour,
        purchaseDate: formData.purchaseDate,
      });

      // First test if backend is accessible
      try {
        const testResponse = await fetch("http://localhost:5000/api/models");
        console.log("Backend connectivity test - status:", testResponse.status);
        if (testResponse.status !== 200) {
          throw new Error("Backend not responding correctly");
        }
      } catch (testErr) {
        console.error("Backend server not accessible:", testErr);
        setError("Backend server is not running. Please start the server.");
        return { exists: false }; // Allow creation if backend is down
      }

      // Build the duplicate check URL
      const checkUrl = `http://localhost:5000/api/models/check-duplicate?modelName=${encodeURIComponent(
        formData.modelName
      )}&company=${encodeURIComponent(
        formData.company
      )}&colour=${encodeURIComponent(colour)}&purchaseDate=${encodeURIComponent(
        parseDate(formData.purchaseDate)
      )}&purchasedInWarranty=${encodeURIComponent(
        formData.purchasedInWarranty
      )}`;

      console.log("Calling duplicate check URL:", checkUrl);
      console.log("URL parameters:");
      console.log("- modelName:", formData.modelName);
      console.log("- company:", formData.company);
      console.log("- colour:", colour);
      console.log("- purchaseDate:", formData.purchaseDate);
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
          }, Colour: ${colour}, Purchase Date: ${new Date(
            data.model.purchaseDate
          ).toLocaleDateString()}, Warranty Status: ${
            data.model.purchasedInWarranty ? "In Warranty" : "Out of Warranty"
          }) already exists. Each combination of name, company, colour, purchase date, and warranty status should be unique.`,
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
    if (!formData.modelName || !formData.company || !formData.quantity) {
      setError("Model name, company, and quantity are required");
      return;
    }

    // Validate color selection
    if (!formData.colour) {
      setError("Please select a colour");
      return;
    }

    if (formData.colour === "other" && !formData.customColour) {
      setError("Please enter a custom colour name");
      return;
    }

    // Check for duplicate model with same details
    const duplicateCheck = await checkDuplicateModel();
    if (duplicateCheck.exists) {
      setError(duplicateCheck.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("http://localhost:5000/api/models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelName: formData.modelName,
          company: formData.company,
          colour:
            formData.colour === "other"
              ? formData.customColour
              : formData.colour,
          quantity: parseInt(formData.quantity),
          purchasedInWarranty: formData.purchasedInWarranty,
          purchasePrice: autoAppliedPrice || 0, // Use auto-applied price if available
          purchaseDate: formData.purchaseDate
            ? new Date(formData.purchaseDate)
            : new Date(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error creating model");
      }

      console.log("Model created successfully:", data);

      // Show purchase price dialog instead of directly navigating
      setShowPurchasePriceDialog(true);
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
      <h2>{isAddingColorVariant ? "Add Color Variant" : "Add New Model"}</h2>

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
              ? "Model name, company, purchase date, and warranty status are locked. You can edit color and quantity only."
              : "Model name and company are locked. You can edit color, quantity, warranty, and purchase date."}
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
                        // Select the highlighted suggestion
                        if (selectedSuggestionIndex >= 0) {
                          handleSuggestionSelect(
                            modelSuggestions[selectedSuggestionIndex]
                          );
                        } else if (modelSuggestions.length > 0) {
                          // If no suggestion is highlighted, select the first one
                          handleSuggestionSelect(modelSuggestions[0]);
                        }
                      } else if (e.key === "Escape") {
                        // Hide suggestions on Escape
                        setShowSuggestions(false);
                        setSelectedSuggestionIndex(-1);
                      }
                    }
                  }}
                />

                {/* Suggestions Dropdown */}
                {showSuggestions && modelSuggestions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      backgroundColor: "#ffffff",
                      border: "2px solid #1a1a1a",
                      borderTop: "2px solid #1a1a1a",
                      height: "auto",
                      maxHeight: "200px", // Height for 4 items (48px each + gaps)
                      overflowY: "auto",
                      zIndex: 1000,
                      boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                      borderRadius: "6px",
                      marginTop: "2px",
                    }}
                  >
                    {modelSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={() => handleSuggestionSelect(suggestion)}
                        style={{
                          padding: "8px 16px",
                          cursor: "pointer",
                          borderBottom:
                            index < modelSuggestions.length - 1
                              ? "1px solid #e8e8e8"
                              : "none",
                          backgroundColor:
                            index === selectedSuggestionIndex
                              ? "#f0f8ff"
                              : "#ffffff",
                          transition: "all 0.2s ease",
                          fontSize: "14px",
                          fontWeight:
                            index === selectedSuggestionIndex ? "500" : "400",
                          color: "#2c3e50",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          margin: index === 0 ? "4px 4px 0 4px" : "0 4px",
                          borderRadius:
                            index === 0
                              ? "4px 4px 0 0"
                              : index === modelSuggestions.length - 1
                              ? "0 0 4px 4px"
                              : "0",
                          borderLeft:
                            index === selectedSuggestionIndex
                              ? "3px solid #007bff"
                              : "none",
                          paddingLeft:
                            index === selectedSuggestionIndex ? "13px" : "16px",
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = "#f8f9fa";
                          e.target.style.borderLeft = "3px solid #007bff";
                          e.target.style.paddingLeft = "13px";
                          setSelectedSuggestionIndex(index);
                        }}
                        onMouseLeave={(e) => {
                          if (index !== selectedSuggestionIndex) {
                            e.target.style.backgroundColor = "#ffffff";
                            e.target.style.borderLeft = "none";
                            e.target.style.paddingLeft = "16px";
                          }
                        }}
                      >
                        <span
                          style={{
                            width: "4px",
                            height: "4px",
                            backgroundColor:
                              index === selectedSuggestionIndex
                                ? "#007bff"
                                : "#6c757d",
                            borderRadius: "50%",
                            flexShrink: 0,
                          }}
                        />
                        <span>{suggestion}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Loading Indicator */}
                {suggestionsLoading && !showSuggestions && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      backgroundColor: "#ffffff",
                      border: "2px solid #1a1a1a",
                      borderTop: "2px solid #1a1a1a",
                      padding: "16px",
                      textAlign: "center",
                      color: "#6c757d",
                      zIndex: 1000,
                      boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                      borderRadius: "6px",
                      marginTop: "2px",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid #e9ecef",
                        borderTop: "2px solid #007bff",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    <span>Loading suggestions...</span>
                  </div>
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
                        // Move to next suggestion with cyclic behavior
                        let newIndex;
                        if (
                          selectedCompanySuggestionIndex >=
                          companySuggestions.length - 1
                        ) {
                          // If at last suggestion, cycle back to first
                          newIndex = 0;
                        } else {
                          // Otherwise move to next
                          newIndex = selectedCompanySuggestionIndex + 1;
                        }
                        setSelectedCompanySuggestionIndex(newIndex);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        // Move to previous suggestion with cyclic behavior
                        let newIndex;
                        if (selectedCompanySuggestionIndex <= 0) {
                          // If at first suggestion, cycle to last
                          newIndex = companySuggestions.length - 1;
                        } else {
                          // Otherwise move to previous
                          newIndex = selectedCompanySuggestionIndex - 1;
                        }
                        setSelectedCompanySuggestionIndex(newIndex);
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        // Select the highlighted company suggestion
                        if (selectedCompanySuggestionIndex >= 0) {
                          handleCompanySuggestionSelect(
                            companySuggestions[selectedCompanySuggestionIndex]
                          );
                        } else if (companySuggestions.length > 0) {
                          // If no suggestion is highlighted, select the first one
                          handleCompanySuggestionSelect(companySuggestions[0]);
                        }
                      } else if (e.key === "Escape") {
                        // Hide company suggestions on Escape
                        setShowCompanySuggestions(false);
                        setSelectedCompanySuggestionIndex(-1);
                      }
                    }
                  }}
                />

                {/* Company Suggestions Dropdown */}
                {showCompanySuggestions && companySuggestions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      backgroundColor: "#ffffff",
                      border: "2px solid #1a1a1a",
                      borderTop: "2px solid #1a1a1a",
                      height: "auto",
                      maxHeight: "200px", // Height for 4 items (48px each + gaps)
                      overflowY: "auto",
                      zIndex: 1000,
                      boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                      borderRadius: "6px",
                      marginTop: "2px",
                    }}
                  >
                    {companySuggestions.map((company, index) => (
                      <div
                        key={company}
                        style={{
                          padding: "8px 16px",
                          cursor: "pointer",
                          borderBottom:
                            index < companySuggestions.length - 1
                              ? "1px solid #e8e8e8"
                              : "none",
                          backgroundColor:
                            index === selectedCompanySuggestionIndex
                              ? "#f0f8ff"
                              : "#ffffff",
                          transition: "all 0.2s ease",
                          fontSize: "14px",
                          fontWeight:
                            index === selectedCompanySuggestionIndex
                              ? "500"
                              : "400",
                          color: "#2c3e50",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          margin: index === 0 ? "4px 4px 0 4px" : "0 4px",
                          borderRadius:
                            index === 0
                              ? "4px 4px 0 0"
                              : index === companySuggestions.length - 1
                              ? "0 0 4px 4px"
                              : "0",
                          borderLeft:
                            index === selectedCompanySuggestionIndex
                              ? "3px solid #007bff"
                              : "none",
                          paddingLeft:
                            index === selectedCompanySuggestionIndex
                              ? "13px"
                              : "16px",
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = "#f8f9fa";
                          e.target.style.borderLeft = "3px solid #007bff";
                          e.target.style.paddingLeft = "13px";
                          setSelectedCompanySuggestionIndex(index);
                        }}
                        onMouseLeave={(e) => {
                          if (index !== selectedCompanySuggestionIndex) {
                            e.target.style.backgroundColor = "#ffffff";
                            e.target.style.borderLeft = "none";
                            e.target.style.paddingLeft = "16px";
                          }
                        }}
                        onClick={() => handleCompanySuggestionSelect(company)}
                      >
                        <span
                          style={{
                            width: "4px",
                            height: "4px",
                            backgroundColor:
                              index === selectedCompanySuggestionIndex
                                ? "#007bff"
                                : "#6c757d",
                            borderRadius: "50%",
                            flexShrink: 0,
                          }}
                        />
                        <span>{company}</span>
                        <span
                          style={{
                            color: "#6c757d",
                            fontSize: "12px",
                            backgroundColor: "#e9ecef",
                            padding: "2px 8px",
                            borderRadius: "12px",
                          }}
                        >
                          Company
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Company Loading Indicator */}
                {companySuggestionsLoading && !showCompanySuggestions && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      backgroundColor: "#ffffff",
                      border: "2px solid #1a1a1a",
                      borderTop: "2px solid #1a1a1a",
                      padding: "16px",
                      textAlign: "center",
                      color: "#6c757d",
                      zIndex: 1000,
                      boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                      borderRadius: "6px",
                      marginTop: "2px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid #f3f3f3",
                        borderTop: "2px solid #007bff",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    <span>Loading suggestions...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Colour</label>
              <select
                name="colour"
                value={formData.colour}
                onChange={handleInputChange}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              >
                <option value="">Select a colour</option>
                {colorOptions.map((color) => (
                  <option key={color.value} value={color.value}>
                    {color.label}
                  </option>
                ))}
                <option value="other">Other (specify)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Colour Preview</label>
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
                }}
              >
                {/* White-Black split background */}
                {formData.colour === "white-black" ? (
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
                          formData.colour === "other" || !formData.colour
                            ? "#f5f5f5"
                            : colorOptions.find(
                                (c) => c.value === formData.colour
                              )?.hex || "#f5f5f5",
                      }}
                    />
                    <span
                      style={{
                        position: "relative",
                        zIndex: 1,
                        color:
                          formData.colour === "white" ||
                          formData.colour === "yellow"
                            ? "#000"
                            : "#fff",
                      }}
                    >
                      {formData.colour && formData.colour !== "other"
                        ? colorOptions.find((c) => c.value === formData.colour)
                            ?.label
                        : formData.colour === "other"
                        ? "Custom"
                        : "No colour"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {formData.colour === "other" && (
            <div className="form-row">
              <div className="form-group">
                <label>Custom Colour *</label>
                <input
                  type="text"
                  name="customColour"
                  value={formData.customColour || ""}
                  onChange={handleInputChange}
                  placeholder="Enter custom colour name"
                  required={formData.colour === "other"}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Quantity (Numbers) *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="Enter quantity"
                min="0"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label>Purchase Date</label>
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
                disabled={isSubmitting || shouldLockAdditionalFields}
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
                  cursor:
                    isSubmitting || shouldLockAdditionalFields
                      ? "not-allowed"
                      : "text",
                }}
                onFocus={(e) => {
                  if (!isSubmitting && !shouldLockAdditionalFields) {
                    e.target.style.borderColor = "#6366f1";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(99, 102, 241, 0.1)";
                  }
                }}
              />
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
