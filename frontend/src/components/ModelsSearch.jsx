import { useState, useEffect, useRef } from "react";

export default function ModelsSearch({ onSelectModel }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // Handle search logic
  useEffect(() => {
    const searchModels = async () => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `http://localhost:5000/api/models?search=${encodeURIComponent(
            searchTerm
          )}&limit=10`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Error searching models");
        }

        setSearchResults(data.data || []);
        setShowResults(true);
      } catch (err) {
        console.error("Error searching models:", err);
        setSearchResults([]);
        setShowResults(false);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchModels, 300);
    return () => clearTimeout(debounceTimer);
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

  const handleModelClick = (model) => {
    onSelectModel(model);
    setSearchTerm("");
    setSearchResults([]);
    setShowResults(false);
  };

  const getQuantityColor = (quantity) => {
    if (quantity >= 30) return "#10b981"; // Green - good stock
    if (quantity >= 15) return "#f59e0b"; // Yellow - medium stock
    return "#ef4444"; // Red - low stock
  };

  return (
    <div className="models-search" ref={searchRef}>
      <div className="search-box">
        <input
          type="text"
          className="search-input"
          placeholder="Search for models by name, company, or colour..."
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
            {searchResults.map((model) => (
              <div
                key={model._id}
                className="result-item"
                onClick={() => handleModelClick(model)}
              >
                <div className="result-main">
                  <div className="result-name">{model.modelName}</div>
                  <div className="result-company">{model.company}</div>
                </div>
                <div className="result-details">
                  <span
                    className="result-colour"
                    style={{
                      backgroundColor:
                        model.colour.toLowerCase() === "red"
                          ? "#ef4444"
                          : model.colour.toLowerCase() === "blue"
                          ? "#3b82f6"
                          : model.colour.toLowerCase() === "green"
                          ? "#10b981"
                          : model.colour.toLowerCase() === "black"
                          ? "#000000"
                          : model.colour.toLowerCase() === "white"
                          ? "#f3f4f6"
                          : "#6b7280",
                      color:
                        model.colour.toLowerCase() === "white"
                          ? "#000000"
                          : "white",
                      padding: "0.125rem 0.5rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      textTransform: "capitalize",
                      border:
                        model.colour.toLowerCase() === "white"
                          ? "1px solid #d1d5db"
                          : "none",
                    }}
                  >
                    {model.colour}
                  </span>
                  <span
                    className="result-quantity"
                    style={{
                      backgroundColor: getQuantityColor(model.quantity),
                      color: "white",
                      padding: "0.125rem 0.5rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                    }}
                  >
                    Qty: {model.quantity}
                  </span>
                </div>
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
              <div className="no-results-text">No models found</div>
              <div className="no-results-hint">
                Try searching with different keywords or check the spelling
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
