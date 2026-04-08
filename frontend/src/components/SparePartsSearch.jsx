import { useState, useEffect, useRef } from "react";

import { fetchWithRetry } from "../config/api";
export default function SparePartsSearch({ onSelectPart }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [modelSearchTerm, setModelSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [allSpares, setAllSpares] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const modelInputRef = useRef(null);
  const resultsListRef = useRef(null);

  // Dismiss suggestions on outside click/focus and on scroll (whole app)
  useEffect(() => {
    const dismiss = () => {
      setSearchResults([]);
      setSelectedIndex(-1);
    };

    const dismissIfOutside = (target) => {
      if (rootRef.current && !rootRef.current.contains(target)) {
        dismiss();
      }
    };

    const onMouseDown = (e) => dismissIfOutside(e.target);
    const onTouchStart = (e) => dismissIfOutside(e.target);
    const onFocusIn = (e) => dismissIfOutside(e.target);
    const onScroll = () => dismiss();

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("touchstart", onTouchStart, true);
    document.addEventListener("focusin", onFocusIn, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("focusin", onFocusIn, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  // Fetch all spares from API
  useEffect(() => {
    const fetchSpares = async () => {
      try {
        setIsLoading(true);
        const timestamp = Date.now();
        const response = await fetchWithRetry(
          `/spares?t=${timestamp}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch spares");
        }

        const sparesData = await response.json();
        const sparesArray = Array.isArray(sparesData) ? sparesData : [];
        console.log("SparePartsSearch - Fetched spares:", sparesArray.length);
        setAllSpares(sparesArray);
      } catch (error) {
        console.error("Error fetching spares:", error);
        setAllSpares([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpares();
  }, []);

  // Filter spares based on search term and model search - real-time filtering like model suggestions
  useEffect(() => {
    // Only filter if we have spares loaded
    if (allSpares.length === 0) {
      setSearchResults([]);
      return;
    }

    // If both search terms are empty, clear results
    if (searchTerm.trim() === "" && modelSearchTerm.trim() === "") {
      setSearchResults([]);
      return;
    }

    // First filter by spare name/supplier
    let results = allSpares;
    
    if (searchTerm.trim() !== "") {
      results = results.filter(
        (spare) =>
          spare.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          spare.supplierName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Then apply model filter as an additional layer
    if (modelSearchTerm.trim() !== "") {
      results = results.filter((spare) =>
        spare.models?.some((model) =>
          model?.toLowerCase().includes(modelSearchTerm.toLowerCase())
        )
      );
    }
    
    console.log("Spare search - Spare name term:", searchTerm);
    console.log("Spare search - Model term:", modelSearchTerm);
    console.log("Spare search - Total spares:", allSpares.length);
    console.log("Spare search - Filtered results:", results.length);
    
    // Limit to 10 results for better performance
    setSearchResults(results.slice(0, 10));
    // Reset selected index when results change
    setSelectedIndex(-1);
  }, [searchTerm, modelSearchTerm, allSpares]);

  // Preserve focus during re-renders - don't steal focus if user is typing in model field
  useEffect(() => {
    // Only preserve focus if no input is currently focused
    const activeElement = document.activeElement;
    if (
      activeElement !== inputRef.current &&
      activeElement !== modelInputRef.current &&
      inputRef.current
    ) {
      // Don't auto-focus - let user control which field they're typing in
    }
  }, [searchResults]);

  const handleSelectPart = (spare) => {
    // Transform spare data to match expected format
    const part = {
      id: spare._id || spare.id,
      name: spare.name,
      price: spare.sellingPrice || 0,
      inStock: (spare.quantity || 0) > 0,
      quantity: spare.quantity || 0,
      models: spare.models || [],
      supplierName: spare.supplierName || "",
      // Pass color information through so jobcard can show color dropdown
      hasColors:
        spare.hasColors ||
        (Array.isArray(spare.colorQuantity) && spare.colorQuantity.length > 0),
      colorQuantity: Array.isArray(spare.colorQuantity)
        ? spare.colorQuantity
        : [],
    };
    
    // Clear search fields and results to allow adding more spares
    setSearchTerm("");
    setModelSearchTerm("");
    setSearchResults([]);
    setSelectedIndex(-1);
    setSelectedPart(null);
    
    if (onSelectPart) {
      onSelectPart(part);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsListRef.current) {
      const selectedElement = resultsListRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e, inputType) => {
    if (searchResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        // If no item is selected, select the first one
        if (prev === -1) {
          return 0;
        }
        // If at last item, return focus to search box
        if (prev >= searchResults.length - 1) {
          if (inputType === "spare" && inputRef.current) {
            inputRef.current.focus();
          } else if (inputType === "model" && modelInputRef.current) {
            modelInputRef.current.focus();
          }
          return -1; // Clear selection
        }
        return prev + 1;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        // If at first item, return focus to search box
        if (prev <= 0) {
          if (inputType === "spare" && inputRef.current) {
            inputRef.current.focus();
          } else if (inputType === "model" && modelInputRef.current) {
            modelInputRef.current.focus();
          }
          return -1; // Clear selection
        }
        return prev - 1;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        handleSelectPart(searchResults[selectedIndex]);
      } else if (searchResults.length > 0) {
        // If no item is selected, select the first one
        handleSelectPart(searchResults[0]);
      }
    } else if (e.key === "Escape") {
      setSearchResults([]);
      setSelectedIndex(-1);
    }
  };

  return (
    <div
      ref={rootRef}
      className="spare-parts-search"
      style={{ position: "relative", width: "100%" }}
    >
      <div
        className="spare-parts-search-fields"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.75rem",
          marginBottom: "0.5rem",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <div className="search-box" style={{ position: "relative" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "#374151",
            }}
          >
            Search by Spare Name
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              console.log("Spare name input changed:", e.target.value);
              setSearchTerm(e.target.value);
            }}
            onKeyDown={(e) => handleKeyDown(e, "spare")}
            placeholder="Enter spare name..."
            className="search-input"
            ref={inputRef}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              fontSize: "0.875rem",
            }}
          />
        </div>
        <div className="search-box" style={{ position: "relative" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "#374151",
            }}
          >
            Filter by Model
          </label>
          <input
            type="text"
            value={modelSearchTerm}
            onChange={(e) => {
              console.log("Model input changed:", e.target.value);
              setModelSearchTerm(e.target.value);
            }}
            onKeyDown={(e) => handleKeyDown(e, "model")}
            placeholder="Enter model name..."
            className="search-input"
            ref={modelInputRef}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              fontSize: "0.875rem",
            }}
          />
        </div>
      </div>
      {isLoading && (
        <div
          className="search-loading"
          style={{
            padding: "0.5rem",
            fontSize: "0.75rem",
            color: "#6b7280",
            textAlign: "center",
          }}
        >
          Loading spares...
        </div>
      )}

      {(searchTerm.trim() !== "" || modelSearchTerm.trim() !== "") &&
        searchResults.length === 0 &&
        !isLoading &&
        allSpares.length > 0 && (
          <div
            style={{
              marginTop: "0.5rem",
              padding: "0.75rem",
              backgroundColor: "#ffffff",
              border: "2px solid #1a1a1a",
              borderRadius: "6px",
              color: "#6b7280",
              fontSize: "0.875rem",
              textAlign: "center",
            }}
          >
            No spares found
            {searchTerm.trim() !== "" && ` matching "${searchTerm}"`}
            {modelSearchTerm.trim() !== "" &&
              ` with model "${modelSearchTerm}"`}
          </div>
        )}

      {searchResults.length > 0 && (
        <ul
          ref={resultsListRef}
          className="search-results"
          style={{
            position: "relative",
            marginTop: "0.5rem",
            backgroundColor: "#ffffff",
            border: "2px solid #1a1a1a",
            borderRadius: "6px",
            boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
            maxHeight: "400px",
            overflowY: "auto",
            overflowX: "hidden",
            zIndex: 1000,
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {searchResults.map((spare, index) => {
            const inStock = (spare.quantity || 0) > 0;
            const isSelected = selectedIndex === index;
            return (
              <li
                key={spare._id || spare.id}
                className={`search-result-item ${
                  !inStock ? "out-of-stock" : ""
                }`}
                onClick={() => handleSelectPart(spare)}
                onMouseEnter={() => setSelectedIndex(index)}
                style={{
                  padding: "0.5rem 1rem",
                  borderBottom:
                    index !== searchResults.length - 1
                      ? "1px solid #f1f5f9"
                      : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  backgroundColor: isSelected ? "#3b82f6" : "white",
                  transform: isSelected ? "translateX(4px)" : "translateX(0)",
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "white";
                    e.currentTarget.style.transform = "translateX(0)";
                  }
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    width: "100%",
                  }}
                >
                  {isSelected ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ flexShrink: 0 }}
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
                    />
                  )}
                  <span
                    style={{
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? "white" : "#1f2937",
                      fontSize: "0.875rem",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {spare.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: isSelected ? "white" : "#111827",
                      marginRight: "0.5rem",
                      backgroundColor: isSelected
                        ? "rgba(255, 255, 255, 0.2)"
                        : "#f3f4f6",
                      padding: "0.125rem 0.375rem",
                      borderRadius: "0.25rem",
                    }}
                  >
                    ₹{spare.sellingPrice?.toFixed(2) || "0.00"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: isSelected ? "rgba(255, 255, 255, 0.8)" : "#6b7280",
                      marginRight: "0.5rem",
                    }}
                  >
                    Qty: {spare.quantity || 0}
                  </span>
                  {spare.models && spare.models.length > 0 && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.25rem 0.5rem",
                        backgroundColor: isSelected
                          ? "rgba(255, 255, 255, 0.2)"
                          : "#e9ecef",
                        color: isSelected ? "white" : "#6c757d",
                        borderRadius: "12px",
                        fontWeight: 500,
                      }}
                    >
                      {spare.models[0]}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {selectedPart && (
        <div
          className="selected-part"
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "#f9fafb",
            borderRadius: "0.5rem",
            border: "1px solid #e5e7eb",
          }}
        >
          <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem" }}>
            Selected Part:
          </h4>
          <div className="selected-part-details">
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>Name:</strong> {selectedPart.name}
            </div>
            {selectedPart.models && selectedPart.models.length > 0 && (
              <div style={{ marginBottom: "0.5rem" }}>
                <strong>Models:</strong>{" "}
                <span
                  style={{
                    display: "inline-flex",
                    flexWrap: "wrap",
                    gap: "0.25rem",
                    marginLeft: "0.5rem",
                  }}
                >
                  {selectedPart.models.map((model, index) => (
                    <span
                      key={index}
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.125rem 0.375rem",
                        backgroundColor: "#e9ecef",
                        color: "#6c757d",
                        borderRadius: "8px",
                      }}
                    >
                      {model}
                    </span>
                  ))}
                </span>
              </div>
            )}
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>Price:</strong> ₹{selectedPart.price.toFixed(2)}
            </div>
            <div>
              <strong>Status:</strong>
              <span
                className={selectedPart.inStock ? "in-stock" : "out-of-stock"}
                style={{
                  marginLeft: "0.5rem",
                  color: selectedPart.inStock ? "#10b981" : "#ef4444",
                  fontWeight: 500,
                }}
              >
                {selectedPart.inStock ? "In Stock" : "Out of Stock"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
