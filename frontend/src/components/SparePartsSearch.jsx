import { useState, useEffect, useRef } from "react";

// Mock data - in a real app, this would come from an API
const mockSpareParts = [
  {
    id: 1,
    name: "Brake Pads",
    partNumber: "BP-001",
    price: 24.99,
    inStock: true,
  },
  {
    id: 2,
    name: "Chain Set",
    partNumber: "CS-002",
    price: 49.99,
    inStock: true,
  },
  {
    id: 3,
    name: "Tire Tube",
    partNumber: "TT-003",
    price: 12.99,
    inStock: false,
  },
  {
    id: 4,
    name: "Gear Shifter",
    partNumber: "GS-004",
    price: 34.99,
    inStock: true,
  },
  {
    id: 5,
    name: "Headlight",
    partNumber: "HL-005",
    price: 19.99,
    inStock: true,
  },
];

export default function SparePartsSearch({ onSelectPart }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      // Use timeout to defer state update and prevent cascading renders
      const timeoutId = setTimeout(() => {
        setSearchResults([]);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    const timer = setTimeout(() => {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        const results = mockSpareParts.filter(
          (part) =>
            part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            part.partNumber.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setSearchResults(results);
        setIsLoading(false);
      }, 500);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Preserve focus during re-renders
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchResults]);

  const handleSelectPart = (part) => {
    setSelectedPart(part);
    setSearchTerm(part.name);
    setSearchResults([]);
    if (onSelectPart) {
      onSelectPart(part);
    }
  };

  return (
    <div className="spare-parts-search">
      <div className="search-box">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search for spare parts..."
          className="search-input"
          ref={inputRef}
        />
        {isLoading && <div className="search-loading">Searching...</div>}
      </div>

      {searchResults.length > 0 && (
        <ul className="search-results">
          {searchResults.map((part) => (
            <li
              key={part.id}
              className={`search-result-item ${
                !part.inStock ? "out-of-stock" : ""
              }`}
              onClick={() => handleSelectPart(part)}
            >
              <div className="part-name">{part.name}</div>
              <div className="part-details">
                <span className="part-number">{part.partNumber}</span>
                <span className="part-price">${part.price.toFixed(2)}</span>
                {!part.inStock && (
                  <span className="stock-status">Out of stock</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedPart && (
        <div className="selected-part">
          <h4>Selected Part:</h4>
          <div className="selected-part-details">
            <div>
              <strong>Name:</strong> {selectedPart.name}
            </div>
            <div>
              <strong>Part #:</strong> {selectedPart.partNumber}
            </div>
            <div>
              <strong>Price:</strong> ${selectedPart.price.toFixed(2)}
            </div>
            <div>
              <strong>Status:</strong>
              <span
                className={selectedPart.inStock ? "in-stock" : "out-of-stock"}
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
