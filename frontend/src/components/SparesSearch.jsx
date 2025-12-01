import { useState, useEffect, useRef } from "react";

// Mock data for demonstration
const mockSpares = [
  {
    id: 1,
    name: "Engine Oil Filter",
    sku: "ENG-0001",
    category: "engine",
    quantity: 25,
    description: "High-quality engine oil filter for all e-bike models",
  },
  {
    id: 2,
    name: "Brake Pads",
    sku: "BRK-0001",
    category: "brakes",
    quantity: 8,
    description: "High-performance brake pads for all models",
  },
  {
    id: 3,
    name: "Headlight Bulb",
    sku: "ELC-0001",
    category: "electrical",
    quantity: 50,
    description: "LED headlight bulb with high brightness",
  },
  {
    id: 4,
    name: "Shock Absorber",
    sku: "SUS-0001",
    category: "suspension",
    quantity: 15,
    description: "Front shock absorber for smooth ride",
  },
  {
    id: 5,
    name: "Battery Charger",
    sku: "ELC-0002",
    category: "electrical",
    quantity: 30,
    description: "Fast battery charger for all e-bike models",
  },
];

export default function SparesSearch({ onSelectSpare }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // Handle search logic
  useEffect(() => {
    const trimmedSearchTerm = searchTerm.trim();

    if (trimmedSearchTerm === "") {
      // Use a timeout to avoid synchronous state updates
      const timeoutId = setTimeout(() => {
        setSearchResults([]);
        setShowResults(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    // Use a timeout to defer all state updates
    const timeoutId = setTimeout(() => {
      setIsLoading(true);
      setShowResults(true);

      // Simulate API call delay
      const timer = setTimeout(() => {
        const filtered = mockSpares.filter(
          (spare) =>
            spare.name
              .toLowerCase()
              .includes(trimmedSearchTerm.toLowerCase()) ||
            spare.sku.toLowerCase().includes(trimmedSearchTerm.toLowerCase()) ||
            spare.category
              .toLowerCase()
              .includes(trimmedSearchTerm.toLowerCase())
        );
        setSearchResults(filtered);
        setIsLoading(false);
      }, 300);

      return () => clearTimeout(timer);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Preserve focus during re-renders
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchResults, showResults]);

  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSpareClick = (spare) => {
    onSelectSpare(spare);
    setSearchTerm("");
    setSearchResults([]);
    setShowResults(false);
  };

  const getCategoryColor = (category) => {
    const colors = {
      engine: "#2563eb",
      electrical: "#7c3aed",
      suspension: "#dc2626",
      brakes: "#ea580c",
      interior: "#059669",
      exterior: "#0891b2",
      other: "#6b7280",
    };
    return colors[category] || "#6b7280";
  };

  return (
    <div className="spares-search" ref={searchRef}>
      <div className="search-box">
        <input
          type="text"
          className="search-input"
          placeholder="Search for spare parts by name, SKU, or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchTerm && setShowResults(true)}
          ref={inputRef}
        />
        {isLoading && <div className="search-loading">Searching...</div>}
      </div>

      {showResults && searchResults.length > 0 && (
        <div className="search-results">
          <div className="results-header">
            Found {searchResults.length} result
            {searchResults.length !== 1 ? "s" : ""}
          </div>
          <div className="results-list">
            {searchResults.map((spare) => (
              <div
                key={spare.id}
                className="result-item"
                onClick={() => handleSpareClick(spare)}
              >
                <div className="result-main">
                  <div className="result-name">{spare.name}</div>
                  <div className="result-sku">{spare.sku}</div>
                </div>
                <div className="result-details">
                  <span
                    className="result-category"
                    style={{
                      backgroundColor: getCategoryColor(spare.category),
                      color: "white",
                      padding: "0.125rem 0.5rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      textTransform: "capitalize",
                    }}
                  >
                    {spare.category}
                  </span>
                  <span className="result-quantity">Qty: {spare.quantity}</span>
                </div>
                <div className="result-description">{spare.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showResults &&
        searchTerm &&
        searchResults.length === 0 &&
        !isLoading && (
          <div className="search-results">
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <div className="no-results-text">No spares found</div>
              <div className="no-results-hint">
                Try searching with different keywords or check the spelling
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
