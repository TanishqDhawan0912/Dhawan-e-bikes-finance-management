import { useState, useEffect, useRef } from "react";

export default function CompanySearch({ onSelectCompany }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // Handle search logic for companies
  useEffect(() => {
    const searchCompanies = async () => {
      console.log("Company search triggered for:", searchTerm);

      if (searchTerm.trim().length < 2) {
        console.log("Search term too short, clearing results");
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsLoading(true);
      try {
        // Use the existing models API endpoint to search for companies
        const apiUrl = `http://localhost:5000/api/models?search=${encodeURIComponent(
          searchTerm.trim()
        )}&limit=50`;

        console.log("Making API call to:", apiUrl);

        const response = await fetch(apiUrl);

        console.log("Response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("API Error:", errorData);
          throw new Error(
            errorData.message ||
              `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data = await response.json();
        console.log("API Response:", data);

        // Validate response structure
        if (!data.success || !Array.isArray(data.data)) {
          console.error("Invalid response structure:", data);
          throw new Error("Invalid response format from server");
        }

        // Extract unique companies from the search results
        const companies = [
          ...new Set(
            data.data
              .map((model) => model?.company)
              .filter((company) => company && typeof company === "string")
              .sort()
          ),
        ];

        console.log("Extracted companies:", companies);

        setSearchResults(companies);
        setShowResults(true);
      } catch (err) {
        console.error("Error searching companies:", err);
        setSearchResults([]);
        setShowResults(false);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchCompanies, 300);
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

  const handleCompanyClick = (company) => {
    onSelectCompany(company);
    setSearchTerm("");
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <div className="models-search" ref={searchRef}>
      <div className="search-box">
        <input
          type="text"
          className="search-input"
          placeholder="Search for companies..."
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
            Found {searchResults.length} company
            {searchResults.length !== 1 ? "ies" : ""}
          </div>
          <div className="results-list">
            {searchResults.map((company, index) => (
              <div
                key={`${company}-${index}`}
                className="result-item"
                onClick={() => handleCompanyClick(company)}
              >
                <div className="result-main">
                  <div className="result-name">{company}</div>
                  <div className="result-company">Company</div>
                </div>
                <div className="result-details">
                  <span
                    className="result-badge"
                    style={{
                      backgroundColor: "#3b82f6",
                      color: "white",
                      padding: "0.125rem 0.5rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                    }}
                  >
                    Select
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
              <div className="no-results-icon">🏢</div>
              <div className="no-results-text">No companies found</div>
              <div className="no-results-hint">
                Try searching with different keywords or check the spelling
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
