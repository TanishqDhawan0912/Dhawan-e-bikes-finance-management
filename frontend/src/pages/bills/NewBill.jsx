import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getTodayForInput } from "../../utils/dateUtils";
import DatePicker from "../../components/DatePicker";

const API = "http://localhost:5000/api";

const MAIN_TABS = [
  { id: "customer", label: "Customer Details" },
  { id: "model", label: "Model Details" },
  { id: "payment", label: "Payment Details" },
];

const MODEL_SUBTABS = [
  { id: "model", label: "Model" },
  { id: "battery", label: "Battery" },
  { id: "charger", label: "Charger" },
];

const COLOR_NAME_TO_HEX = {
  black: "#1a1a1a",
  white: "#f5f5f5",
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  cherry: "#b91c1c",
  peacock: "#0d9488",
  grey: "#6b7280",
  gray: "#6b7280",
  orange: "#f97316",
  pink: "#ec4899",
  purple: "#a855f7",
  brown: "#92400e",
  silver: "#c0c0c0",
  golden: "#eab308",
  gold: "#eab308",
};

function getColorHex(name) {
  if (!name || typeof name !== "string") return "#94a3b8";
  const key = name.trim().toLowerCase();
  return COLOR_NAME_TO_HEX[key] || "#94a3b8";
}

export default function NewBill() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("customer");
  const [modelSubTab, setModelSubTab] = useState("model");

  const [models, setModels] = useState([]);
  const [batteries, setBatteries] = useState([]);
  const [chargers, setChargers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectModelWarning, setSelectModelWarning] = useState(null);

  // Customer details (bill date defaults to today)
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(getTodayForInput());
  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");

  // Model details
  const [modelPurchased, setModelPurchased] = useState("");
  const [descriptionVariant, setDescriptionVariant] = useState("");
  const [modelColor, setModelColor] = useState("");
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelSuggestionsOpen, setModelSuggestionsOpen] = useState(false);
  const [modelSelectedIndex, setModelSelectedIndex] = useState(-1);
  const modelSuggestionsRef = useRef(null);
  const modelInputRef = useRef(null);
  const modelSuggestionsListRef = useRef(null);
  const modelSelectedIndexRef = useRef(-1);

  // Battery (selected for this bill)
  const [selectedBatteryId, setSelectedBatteryId] = useState("");
  const [withBattery, setWithBattery] = useState(true);
  const [batteryTypeForBill, setBatteryTypeForBill] = useState(""); // "lead" | "lithium"
  const [batteryVoltage, setBatteryVoltage] = useState(""); // "48" | "60" | "72" → 4, 5, 6 batteries
  const [customLithiumVoltage, setCustomLithiumVoltage] = useState(""); // free text e.g. "72V" for lithium
  const [batteryWarranty, setBatteryWarranty] = useState("with"); // "with" | "without" for battery on this bill
  const [batteryNumbers, setBatteryNumbers] = useState(""); // free text, any characters

  // Charger (selected for this bill)
  const [selectedChargerId, setSelectedChargerId] = useState("");
  const [withCharger, setWithCharger] = useState(true);
  const [chargerTypeForBill, setChargerTypeForBill] = useState(""); // "lead" | "lithium"
  const [customChargerVoltage, setCustomChargerVoltage] = useState("");
  const [chargerWarranty, setChargerWarranty] = useState("with"); // "with" | "without"

  // Payment
  const [sellingPrice, setSellingPrice] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [pendingAmount, setPendingAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [oldScootyAvailable, setOldScootyAvailable] = useState("no"); // "yes" | "no"
  const [oldScootyPmcNo, setOldScootyPmcNo] = useState("");
  const [oldScootyWithBattery, setOldScootyWithBattery] = useState("no"); // "yes" | "no"
  const [oldScootyBatteryType, setOldScootyBatteryType] = useState(""); // "lead" | "lithium"
  const [oldScootyBatteryCount, setOldScootyBatteryCount] = useState("");
  const [oldScootyWithCharger, setOldScootyWithCharger] = useState("no"); // "yes" | "no"
  const [oldScootyChargerType, setOldScootyChargerType] = useState(""); // "lead" | "lithium"
  const [oldScootyChargerLeadVoltage, setOldScootyChargerLeadVoltage] = useState(""); // "48" | "60" | "72"
  const [oldScootyChargerLithiumVoltage, setOldScootyChargerLithiumVoltage] = useState("");
  const [oldScootyExchangePrice, setOldScootyExchangePrice] = useState("");
  const [accessoryQuery, setAccessoryQuery] = useState(""); // optional spare search (name)
  const [accessorySuggestions, setAccessorySuggestions] = useState([]);
  const [showAccessorySuggestions, setShowAccessorySuggestions] = useState(false);
  const [selectedAccessories, setSelectedAccessories] = useState([]); // array of spare objects
  const [accessorySelectedIndex, setAccessorySelectedIndex] = useState(-1);

  // When "Battery available" is unchecked, clear battery type, voltage and selection
  useEffect(() => {
    if (!withBattery) {
      setBatteryTypeForBill("");
      setBatteryVoltage("");
      setCustomLithiumVoltage("");
      setSelectedBatteryId("");
      setBatteryNumbers("");
    }
  }, [withBattery]);

  // When battery type or voltage changes, clear selected battery so user picks again from filtered list
  useEffect(() => {
    setSelectedBatteryId("");
  }, [batteryTypeForBill, batteryVoltage]);

  // When switching from Custom to a specific battery, clear custom voltage
  useEffect(() => {
    if (selectedBatteryId && selectedBatteryId !== "custom") {
      setCustomLithiumVoltage("");
    }
  }, [selectedBatteryId]);

  // Reset battery warranty to default when selection changes
  useEffect(() => {
    if (selectedBatteryId) setBatteryWarranty("with");
  }, [selectedBatteryId]);

  // When switching to Lithium, clear lead voltage; when switching away, clear custom lithium voltage
  useEffect(() => {
    if (batteryTypeForBill === "lithium") setBatteryVoltage("");
    else setCustomLithiumVoltage("");
  }, [batteryTypeForBill]);

  // When "Include charger" is unchecked, clear charger type, selection and related fields
  useEffect(() => {
    if (!withCharger) {
      setChargerTypeForBill("");
      setSelectedChargerId("");
      setCustomChargerVoltage("");
    }
  }, [withCharger]);

  // When battery type is chosen, default charger type to the same (user can still change it)
  useEffect(() => {
    if (batteryTypeForBill && !chargerTypeForBill && withCharger) {
      setChargerTypeForBill(batteryTypeForBill);
    }
  }, [batteryTypeForBill, chargerTypeForBill, withCharger]);

  // When charger type changes, clear selected charger
  useEffect(() => {
    setSelectedChargerId("");
  }, [chargerTypeForBill]);

  // When old scooty is not available, clear its detailed fields
  useEffect(() => {
    if (oldScootyAvailable !== "yes") {
      setOldScootyPmcNo("");
      setOldScootyWithBattery("no");
      setOldScootyBatteryType("");
      setOldScootyBatteryCount("");
      setOldScootyWithCharger("no");
      setOldScootyChargerType("");
      setOldScootyChargerLeadVoltage("");
      setOldScootyChargerLithiumVoltage("");
      setOldScootyExchangePrice("");
    }
  }, [oldScootyAvailable]);

  // When switching from Custom to a specific charger, clear custom voltage
  useEffect(() => {
    if (selectedChargerId && selectedChargerId !== "custom") {
      setCustomChargerVoltage("");
    }
  }, [selectedChargerId]);

  // Reset charger warranty to default when selection changes
  useEffect(() => {
    if (selectedChargerId) setChargerWarranty("with");
  }, [selectedChargerId]);

  useEffect(() => {
    (async () => {
      try {
        const [modelsRes, batteriesRes, chargersRes] = await Promise.all([
          fetch(`${API}/models?limit=2000`, {
            headers: { Referer: `${window.location.origin}/admin` },
          }),
          fetch(`${API}/batteries`),
          fetch(`${API}/chargers`),
        ]);
        if (modelsRes.ok) {
          const data = await modelsRes.json();
          const list = Array.isArray(data)
            ? data
            : (data.data && Array.isArray(data.data)
              ? data.data
              : (data.models && Array.isArray(data.models) ? data.models : []));
          setModels(list);
        }
        if (batteriesRes.ok) {
          const data = await batteriesRes.json();
          setBatteries(Array.isArray(data) ? data : []);
        }
        if (chargersRes.ok) {
          const data = await chargersRes.json();
          setChargers(Array.isArray(data) ? data : []);
        }
      } catch (_) {}
    })();
  }, []);

  // Group by description set: entries with same description tags together; colors = all colors from those entries
  const descriptionVariantGroups = useMemo(() => {
    if (!selectedModel) return [];
    const groups = [];
    const keyToIndex = {};

    const addColors = (target, colorQuantities) => {
      (colorQuantities || []).forEach((cq) => {
        const c = (cq.color || "").trim();
        if (!c) return;
        const existing = target.find((x) => x.color.toLowerCase() === c.toLowerCase());
        if (existing) existing.quantity += cq.quantity || 0;
        else target.push({ color: c, quantity: cq.quantity || 0 });
      });
    };

    if (Array.isArray(selectedModel.description) && selectedModel.description.length > 0) {
      const tags = selectedModel.description.map((d) => (d || "").trim()).filter(Boolean);
      const key = JSON.stringify([...tags].sort());
      const colors = [];
      addColors(colors, selectedModel.colorQuantities);
      groups.push({ tags, colors, key });
      keyToIndex[key] = groups.length - 1;
    }

    (selectedModel.stockEntries || []).forEach((entry) => {
      const entryTags = (entry.description || []).map((d) => (d || "").trim()).filter(Boolean);
      if (entryTags.length === 0) return;
      const key = JSON.stringify([...entryTags].sort());
      if (keyToIndex[key] !== undefined) {
        addColors(groups[keyToIndex[key]].colors, entry.colorQuantities);
      } else {
        const colors = [];
        addColors(colors, entry.colorQuantities);
        groups.push({ tags: entryTags, colors, key });
        keyToIndex[key] = groups.length - 1;
      }
    });

    return groups;
  }, [selectedModel]);

  useEffect(() => {
    if (!selectedModel || !descriptionVariant) return;
    const found = descriptionVariantGroups.some(
      (g) => g.tags.join(", ") === descriptionVariant || g.tags.includes(descriptionVariant)
    );
    if (!found && descriptionVariantGroups.length > 0) {
      const firstKey = descriptionVariantGroups[0].tags.join(", ");
      if (descriptionVariant !== firstKey) setDescriptionVariant("");
    }
  }, [selectedModel, descriptionVariant, descriptionVariantGroups]);

  // Same as spare suggestion: filter models by name/company (client-side)
  const modelSuggestions =
    modelPurchased.trim() === ""
      ? []
      : models
          .filter(
            (m) =>
              (m.modelName && m.modelName.toLowerCase().includes(modelPurchased.trim().toLowerCase())) ||
              (m.company && m.company.toLowerCase().includes(modelPurchased.trim().toLowerCase()))
          )
          .slice(0, 3);

  useEffect(() => {
    setModelSelectedIndex(-1);
    modelSelectedIndexRef.current = -1;
  }, [modelPurchased, modelSuggestions.length]);

  useEffect(() => {
    modelSelectedIndexRef.current = modelSelectedIndex;
  }, [modelSelectedIndex]);

  useEffect(() => {
    if (modelSelectedIndex >= 0 && modelSuggestionsListRef.current) {
      const el = modelSuggestionsListRef.current.children[modelSelectedIndex];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [modelSelectedIndex]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        modelSuggestionsRef.current &&
        !modelSuggestionsRef.current.contains(e.target) &&
        modelInputRef.current &&
        !modelInputRef.current.contains(e.target)
      ) {
        setModelSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectModelSuggestion = (m) => {
    setModelPurchased(m.modelName);
    setDescriptionVariant(m.modelName);
    setSelectedModel(m);
    setModelSuggestionsOpen(false);
    modelSelectedIndexRef.current = -1;
    setModelSelectedIndex(-1);
  };

  const handleModelSuggestionsKeyDown = (e) => {
    const len = modelSuggestions.length;
    if (len === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setModelSuggestionsOpen(true);
      const next = modelSelectedIndexRef.current < 0 ? 0 : (modelSelectedIndexRef.current >= len - 1 ? 0 : modelSelectedIndexRef.current + 1);
      modelSelectedIndexRef.current = next;
      setModelSelectedIndex(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setModelSuggestionsOpen(true);
      const next = modelSelectedIndexRef.current <= 0 ? len - 1 : modelSelectedIndexRef.current - 1;
      modelSelectedIndexRef.current = next;
      setModelSelectedIndex(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = modelSelectedIndexRef.current >= 0 ? modelSelectedIndexRef.current : 0;
      if (modelSuggestions[idx]) {
        handleSelectModelSuggestion(modelSuggestions[idx]);
      }
    } else if (e.key === "Escape") {
      setModelSuggestionsOpen(false);
      modelSelectedIndexRef.current = -1;
      setModelSelectedIndex(-1);
    }
  };

  const selectedBattery = batteries.find((b) => b._id === selectedBatteryId) || null;
  const selectedCharger = chargers.find((c) => c._id === selectedChargerId) || null;

  // Sync selling price from selected model when model details are set
  useEffect(() => {
    if (selectedModel && selectedModel.sellingPrice != null && selectedModel.sellingPrice !== "") {
      setSellingPrice(String(selectedModel.sellingPrice));
    }
  }, [selectedModel?.modelName, selectedModel?.sellingPrice]);

  const netAmount = (Number(paidAmount) || 0) + (Number(pendingAmount) || 0);
  const discount = Math.max(0, (Number(sellingPrice) || 0) - netAmount);

  const isCustomerDetailsComplete =
    billNo.trim() !== "" &&
    billDate.trim() !== "" &&
    customerName.trim() !== "" &&
    mobile.replace(/\D/g, "").length === 10;

  useEffect(() => {
    if (isCustomerDetailsComplete) setSelectModelWarning(null);
  }, [isCustomerDetailsComplete]);

  const getSelectModelWarningReason = () => {
    const reasons = [];
    if (billNo.trim() === "") reasons.push("Bill No. is required.");
    if (billDate.trim() === "") reasons.push("Bill Date is required.");
    if (customerName.trim() === "") reasons.push("Customer Name is required.");
    const mobileDigits = mobile.replace(/\D/g, "");
    if (mobileDigits.length !== 10) {
      if (mobileDigits.length === 0) reasons.push("Mobile No. is required (10 digits).");
      else reasons.push(`Mobile No. must be exactly 10 digits (currently ${mobileDigits.length}).`);
    }
    return reasons.length ? reasons.join(" ") : null;
  };

  const handleSelectModelClick = () => {
    if (isCustomerDetailsComplete) {
      setSelectModelWarning(null);
      setActiveTab("model");
    } else {
      setSelectModelWarning(getSelectModelWarningReason());
    }
  };

  const isModelTabComplete = Boolean(
    modelPurchased.trim() && descriptionVariant.trim() && modelColor.trim()
  );
  const batteryVoltageToCount = { "48": 4, "60": 5, "72": 6 };
  const batteryRequiredCount = batteryVoltage ? batteryVoltageToCount[batteryVoltage] : 0;
  const isLead = batteryTypeForBill === "lead";
  const isBatteryTabComplete =
    !withBattery ||
    (Boolean(batteryTypeForBill) &&
      Boolean(selectedBatteryId) &&
      (batteryTypeForBill === "lithium" || Boolean(batteryVoltage)));
  const isChargerTabComplete =
    !withCharger || (Boolean(chargerTypeForBill) && Boolean(selectedChargerId));

  const isSubtabComplete = (tabId) => {
    if (tabId === "model") return isModelTabComplete;
    if (tabId === "battery") return isBatteryTabComplete;
    if (tabId === "charger") return isChargerTabComplete;
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!customerName.trim()) {
      setError("Customer Name is required.");
      return;
    }
    if (!billDate.trim()) {
      setError("Bill Date is required.");
      return;
    }
    const mobileDigits = mobile.replace(/\D/g, "");
    if (mobileDigits.length !== 10) {
      setError("Mobile No. must be exactly 10 digits.");
      return;
    }
    if (!billNo.trim()) {
      setError("Bill No. is required.");
      return;
    }
    if (!modelPurchased.trim()) {
      setError("Model name is required.");
      return;
    }
    if (!modelColor.trim()) {
      setError("Model Color is required.");
      return;
    }
    setSaving(true);
    try {
      let oldScootyExchange = "";
      if (oldScootyAvailable === "yes") {
        const parts = [];
        if (oldScootyPmcNo.trim()) {
          parts.push(`PMC No.: ${oldScootyPmcNo.trim()}`);
        }
        if (oldScootyWithBattery === "yes") {
          const batteryBits = [];
          batteryBits.push("with battery");
          if (oldScootyBatteryType) {
            batteryBits.push(oldScootyBatteryType === "lead" ? "Lead" : "Lithium");
          }
          if (oldScootyBatteryType === "lead" && oldScootyBatteryCount.trim()) {
            batteryBits.push(`${oldScootyBatteryCount.trim()} batteries`);
          }
          parts.push(`Battery: ${batteryBits.join(", ")}`);
        } else {
          parts.push("Without battery");
        }
        if (oldScootyWithCharger === "yes") {
          const chargerBits = [];
          chargerBits.push("with charger");
          if (oldScootyChargerType) {
            chargerBits.push(oldScootyChargerType === "lead" ? "Lead" : "Lithium");
          }
          if (oldScootyChargerType === "lead" && oldScootyChargerLeadVoltage) {
            chargerBits.push(`${oldScootyChargerLeadVoltage}V`);
          }
          if (oldScootyChargerType === "lithium" && oldScootyChargerLithiumVoltage.trim()) {
            chargerBits.push(oldScootyChargerLithiumVoltage.trim());
          }
          parts.push(`Charger: ${chargerBits.join(", ")}`);
        } else {
          parts.push("Without charger");
        }
        oldScootyExchange = parts.join(" | ");
      }

      const payload = {
        billNo: billNo.trim(),
        billDate: billDate.trim(),
        customerName: customerName.trim(),
        mobile: mobile.replace(/\D/g, ""),
        address: address.trim(),
        modelPurchased: modelPurchased.trim(),
        descriptionVariant: descriptionVariant.trim(),
        modelColor: modelColor.trim(),
        sellingPrice: Number(sellingPrice) || 0,
        discount: Math.max(0, (Number(sellingPrice) || 0) - ((Number(paidAmount) || 0) + (Number(pendingAmount) || 0))),
        netAmount: (Number(paidAmount) || 0) + (Number(pendingAmount) || 0),
        paidAmount: Number(paidAmount) || 0,
        pendingAmount: Number(pendingAmount) || 0,
        paymentMode: paymentMode || "cash",
        oldScootyExchange: oldScootyExchange.trim(),
        oldScootyExchangePrice: Number(oldScootyExchangePrice) || 0,
        accessoryIncluded:
          selectedAccessories.length > 0
            ? selectedAccessories.map((a) => a.name).join(", ")
            : accessoryQuery.trim() || "",
        accessoryDetails:
          selectedAccessories.length > 0
            ? selectedAccessories.map((a) => ({
                id: a._id,
                name: a.name || "",
                sellingPrice: a.sellingPrice || 0,
                sku: a.sku || "",
              }))
            : [],
        withBattery: withBattery,
        withCharger: withCharger,
      };
      const res = await fetch(`${API}/bills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Failed to create bill");
      }
      alert("Bill created successfully.");
      navigate("/bills/all");
    } catch (err) {
      setError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <form onSubmit={handleSubmit} className="bill-form-tabs-wrapper">
        {error && (
          <p className="bill-form-error">{error}</p>
        )}

        {/* Main tabs */}
        <div className="bill-tabs">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`bill-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Customer Details */}
        {activeTab === "customer" && (
          <div className="form-section">
            <h3>Customer & Bill Details</h3>
            <div className="form-section-inner">
              <div className="form-row" style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                <div className="form-group" style={{ flex: "1 1 200px" }}>
                  <label>Bill No. <span className="required">*</span></label>
                  <input
                    type="text"
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                    placeholder="Bill number"
                  />
                </div>
                <div className="form-group" style={{ flex: "1 1 200px" }}>
                  <label>Bill Date <span className="required">*</span></label>
                  <DatePicker
                    value={billDate}
                    onChange={setBillDate}
                    placeholder="Select date"
                    className="date-picker-modern"
                  />
                </div>
              </div>
              <div className="form-row" style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                <div className="form-group" style={{ flex: "1 1 200px" }}>
                  <label>Customer Name <span className="required">*</span></label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name"
                  />
                </div>
                <div className="form-group" style={{ flex: "1 1 200px" }}>
                  <label>Mobile No. <span className="required">*</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setMobile(v);
                    }}
                    placeholder="10 digit mobile number"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Address"
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </div>
              {selectModelWarning && (
                <div className="bill-select-model-warning" role="alert">
                  {selectModelWarning}
                </div>
              )}
              <div className="bill-form-actions" style={{ borderTop: "none", paddingTop: 0 }}>
                <button
                  type="button"
                  className={`btn ${isCustomerDetailsComplete ? "btn-primary" : "btn-primary btn-disabled"}`}
                  onClick={handleSelectModelClick}
                  title={!isCustomerDetailsComplete ? "Fill all required fields to continue" : undefined}
                >
                  Select Model →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Model Details (with subtabs) */}
        {activeTab === "model" && (
          <>
            <div className="bill-subtabs">
              {MODEL_SUBTABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`bill-subtab ${modelSubTab === tab.id ? "active" : ""} ${isSubtabComplete(tab.id) ? "complete" : ""}`}
                  onClick={() => setModelSubTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {modelSubTab === "model" && (
              <div className="form-section">
                <h3>Model Name & Specifications</h3>
                <div className="form-section-inner">
                  <div className="form-group" ref={modelSuggestionsRef}>
                    <label>Model Name <span className="required">*</span></label>
                    <div className="model-name-autocomplete">
                      <input
                        ref={modelInputRef}
                        type="text"
                        value={modelPurchased}
                        onChange={(e) => {
                          const v = e.target.value;
                          setModelPurchased(v);
                          if (selectedModel && v !== selectedModel.modelName) setDescriptionVariant("");
                          setModelSuggestionsOpen(true);
                        }}
                        onFocus={() => setModelSuggestionsOpen(true)}
                        onKeyDown={handleModelSuggestionsKeyDown}
                        placeholder="Type to search models (suggestions from Models section)..."
                        autoComplete="off"
                      />
                      {modelPurchased.trim() !== "" &&
                        modelSuggestions.length === 0 &&
                        models.length > 0 && (
                          <div className="model-suggestions-empty" role="status">
                            No models found matching &quot;{modelPurchased}&quot;
                          </div>
                        )}
                      {modelSuggestionsOpen && modelSuggestions.length > 0 && (
                        <ul
                          ref={modelSuggestionsListRef}
                          className="model-suggestions-list"
                          role="listbox"
                        >
                          {modelSuggestions.map((m, index) => (
                            <li
                              key={m._id}
                              role="option"
                              aria-selected={modelSelectedIndex === index}
                              className={`model-suggestion-item ${modelSelectedIndex === index ? "model-suggestion-item-selected" : ""}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectModelSuggestion(m);
                              }}
                              onMouseEnter={() => setModelSelectedIndex(index)}
                            >
                              <span className="model-suggestion-name">{m.modelName}</span>
                              {m.company && <span className="model-suggestion-company"> ({m.company})</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Description / Variant</label>
                    {selectedModel ? (
                      descriptionVariantGroups.length > 0 ? (
                        <>
                          <select
                            className="bill-description-variant-select"
                            value={descriptionVariant}
                            onChange={(e) => setDescriptionVariant(e.target.value)}
                          >
                            <option value="">Select description variant</option>
                            {descriptionVariantGroups.map((group) => {
                              const groupKey = group.tags.join(", ");
                              return (
                                <option key={group.key} value={groupKey}>
                                  {group.tags.join(", ")}
                                </option>
                              );
                            })}
                          </select>
                          {descriptionVariant ? (
                            <div className="form-group" style={{ marginTop: "0.75rem" }}>
                              <label>Description selected</label>
                              <input
                                type="text"
                                readOnly
                                className="readonly"
                                value={descriptionVariant}
                              />
                            </div>
                          ) : null}
                          {descriptionVariant && (() => {
                            const selectedGroup = descriptionVariantGroups.find(
                              (g) => g.tags.join(", ") === descriptionVariant
                            );
                            if (!selectedGroup || selectedGroup.colors.length === 0) return null;
                            return (
                              <div className="bill-description-group-colors">
                                <span className="bill-description-group-colors-label">Colors available for this variant (click to select):</span>
                                <div className="bill-colors-available">
                                  {selectedGroup.colors.map((c, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      className={`bill-color-chip bill-color-chip-clickable ${modelColor.trim().toLowerCase() === c.color.toLowerCase() ? "bill-color-chip-selected" : ""}`}
                                      onClick={() => setModelColor(c.color)}
                                    >
                                      <span
                                        className="bill-color-swatch"
                                        style={{ backgroundColor: getColorHex(c.color) }}
                                        title={c.color}
                                      />
                                      <span>{c.color} ({c.quantity})</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <p className="bill-specs-empty">No description variants for this model. Add descriptions in model stock entries.</p>
                      )
                    ) : (
                      <p className="bill-colors-hint">Select a model above to see description variants.</p>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Color selected <span className="required">*</span></label>
                    <input
                      type="text"
                      value={modelColor}
                      onChange={(e) => setModelColor(e.target.value)}
                      placeholder="e.g. Black, Red"
                    />
                  </div>
                </div>
              </div>
            )}

            {modelSubTab === "battery" && (
              <div className="form-section battery-details-section">
                <h3>Battery Details</h3>
                <div className="form-section-inner">
                  <div className="form-group">
                    <label className="bill-checkbox-label">
                      <input
                        type="checkbox"
                        checked={withBattery}
                        onChange={(e) => setWithBattery(e.target.checked)}
                      />
                      Battery available
                    </label>
                  </div>
                  {withBattery && (
                    <>
                      <div className="form-group">
                        <label>Battery type</label>
                        <select
                          value={batteryTypeForBill}
                          onChange={(e) => setBatteryTypeForBill(e.target.value)}
                          className="battery-type-select"
                        >
                          <option value="">— Select type —</option>
                          <option value="lead">Lead</option>
                          <option value="lithium">Lithium</option>
                        </select>
                      </div>
                      {batteryTypeForBill && (
                        <>
                          {isLead && (
                            <div className="form-group">
                              <label>Voltage</label>
                              <select
                                value={batteryVoltage}
                                onChange={(e) => setBatteryVoltage(e.target.value)}
                                className="battery-type-select"
                              >
                                <option value="">— Select voltage —</option>
                                <option value="48">48V (4 batteries)</option>
                                <option value="60">60V (5 batteries)</option>
                                <option value="72">72V (6 batteries)</option>
                              </select>
                            </div>
                          )}
                          {(batteryTypeForBill === "lithium" || (isLead && batteryVoltage)) && (
                            <div className="form-group">
                              <label>Select Battery</label>
                              {(() => {
                                const availableBatteries = batteries.filter((b) => {
                                  if (b.batteryType && b.batteryType !== batteryTypeForBill)
                                    return false;
                                  if (batteryTypeForBill === "lithium") {
                                    // Lithium: only show if in stock (total sets > 0)
                                    return (b.totalSets || 0) > 0;
                                  }
                                  const stock =
                                    (b.totalSets || 0) * (b.batteriesPerSet || 0) +
                                    (b.openBatteries || 0);
                                  return stock >= batteryRequiredCount;
                                });
                                return (
                                  <>
                                    <select
                                      value={selectedBatteryId}
                                      onChange={(e) => setSelectedBatteryId(e.target.value)}
                                    >
                                      <option value="">— Select battery —</option>
                                      {batteryTypeForBill === "lithium" && (
                                        <option value="custom">— Custom —</option>
                                      )}
                                      {availableBatteries.map((b) => (
                                        <option key={b._id} value={b._id}>
                                          {b.name}
                                          {b.ampereValue ? ` (${b.ampereValue}A)` : ""}
                                        </option>
                                      ))}
                                    </select>
                                    {availableBatteries.length === 0 && (
                                      <p className="form-help text-muted">
                                        {isLead
                                          ? `No batteries in stock for ${batteryVoltage}V (need ${batteryRequiredCount} batteries). Add stock or choose another voltage.`
                                          : "No lithium batteries in stock. Add stock to show them here."}
                                      </p>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                          {batteryTypeForBill === "lithium" &&
                            (selectedBatteryId === "custom" || selectedBattery) && (
                              <div className="form-group">
                                <label>Voltage {selectedBatteryId === "custom" ? "(optional)" : ""}</label>
                                <input
                                  type="text"
                                  value={
                                    selectedBatteryId === "custom"
                                      ? customLithiumVoltage
                                      : "—"
                                  }
                                  onChange={(e) =>
                                    selectedBatteryId === "custom" &&
                                    setCustomLithiumVoltage(e.target.value)
                                  }
                                  placeholder="e.g. 48V, 60V, 72V"
                                  className="form-control"
                                  disabled={selectedBatteryId !== "custom"}
                                  readOnly={selectedBatteryId !== "custom"}
                                />
                              </div>
                            )}
                          {(selectedBatteryId === "custom" || selectedBattery) && (
                            <div className="form-group">
                              <label>Battery warranty</label>
                              <select
                                value={batteryWarranty}
                                onChange={(e) => setBatteryWarranty(e.target.value)}
                                className="form-control"
                                style={{ maxWidth: "200px" }}
                              >
                                <option value="with">With warranty</option>
                                <option value="without">Without warranty</option>
                              </select>
                            </div>
                          )}
                          {(selectedBatteryId === "custom" || selectedBattery) && (
                            <div className="form-group">
                              <label>Battery numbers</label>
                              <input
                                type="text"
                                value={batteryNumbers}
                                onChange={(e) => setBatteryNumbers(e.target.value)}
                                placeholder="Enter battery numbers"
                                className="form-control"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {selectedBatteryId === "custom" && batteryTypeForBill === "lithium" && (
                    <div className="bill-detail-card">
                      <h4>Battery details</h4>
                      <dl>
                        <dt>Name</dt>
                        <dd>Custom</dd>
                        <dt>Voltage</dt>
                        <dd>{customLithiumVoltage.trim() || "—"}</dd>
                        <dt>Warranty</dt>
                        <dd>{batteryWarranty === "with" ? "With warranty" : "Without warranty"}</dd>
                        <dt>Battery numbers</dt>
                        <dd>{batteryNumbers.trim() || "—"}</dd>
                      </dl>
                    </div>
                  )}
                  {selectedBattery && (
                    <div className="bill-detail-card">
                      <h4>Battery details</h4>
                      <dl>
                        <dt>Name</dt>
                        <dd>{selectedBattery.name}</dd>
                        <dt>Ampere / Type</dt>
                        <dd>{selectedBattery.ampereValue || "—"}</dd>
                        {batteryTypeForBill === "lithium" && customLithiumVoltage.trim() && (
                          <>
                            <dt>Voltage</dt>
                            <dd>{customLithiumVoltage.trim()}</dd>
                          </>
                        )}
                        {isLead && batteryVoltage && (
                          <>
                            <dt>Voltage / Batteries used</dt>
                            <dd>{batteryVoltage}V ({batteryRequiredCount} batteries)</dd>
                          </>
                        )}
                        <dt>Batteries per set</dt>
                        <dd>{selectedBattery.batteriesPerSet ?? "—"}</dd>
                        <dt>Warranty</dt>
                        <dd>{batteryWarranty === "with" ? "With warranty" : "Without warranty"}</dd>
                        <dt>Battery numbers</dt>
                        <dd>{batteryNumbers.trim() || "—"}</dd>
                        <dt>Selling price</dt>
                        <dd>₹{selectedBattery.sellingPrice}</dd>
                        {selectedBattery.supplierName && (
                          <>
                            <dt>Supplier</dt>
                            <dd>{selectedBattery.supplierName}</dd>
                          </>
                        )}
                      </dl>
                    </div>
                  )}
                </div>
              </div>
            )}

            {modelSubTab === "charger" && (
              <div className="form-section charger-details-section">
                <h3>Charger Details</h3>
                <div className="form-section-inner">
                  <div className="form-group">
                    <label className="bill-checkbox-label">
                      <input
                        type="checkbox"
                        checked={withCharger}
                        onChange={(e) => setWithCharger(e.target.checked)}
                      />
                      Include charger with this bill
                    </label>
                  </div>
                  {withCharger && (
                    <>
                      <div className="form-group">
                        <label>Charger type</label>
                        <select
                          value={chargerTypeForBill}
                          onChange={(e) => setChargerTypeForBill(e.target.value)}
                          className="battery-type-select"
                        >
                          <option value="">— Select type —</option>
                          <option value="lead">Lead</option>
                          <option value="lithium">Lithium</option>
                        </select>
                      </div>
                      {chargerTypeForBill && (
                        <div className="form-group">
                          <label>Select Charger</label>
                          <select
                            value={selectedChargerId}
                            onChange={(e) => setSelectedChargerId(e.target.value)}
                          >
                            <option value="">— Select charger —</option>
                            <option value="custom">— Custom —</option>
                            {chargers
                              .filter((c) => {
                                if ((c.quantity || 0) <= 0) return false;
                                const type = (c.batteryType || "").toLowerCase().trim();
                                if (!type) return true; // no type = show in both
                                return type === chargerTypeForBill;
                              })
                              .map((c) => (
                                <option key={c._id} value={c._id}>
                                  {c.name}
                                  {c.voltage ? ` (${c.voltage})` : ""}
                                </option>
                              ))}
                          </select>
                          {chargers.filter((c) => {
                            if ((c.quantity || 0) <= 0) return false;
                            const type = (c.batteryType || "").toLowerCase().trim();
                            if (!type) return true;
                            return type === chargerTypeForBill;
                          }).length === 0 && (
                            <p className="form-help text-muted">
                              No chargers in stock for this type. Add stock or choose another type.
                            </p>
                          )}
                        </div>
                      )}
                      {(selectedChargerId === "custom" || selectedCharger) && (
                        <>
                          <div className="form-group">
                            <label>Voltage {selectedChargerId === "custom" ? "(optional)" : ""}</label>
                            <input
                              type="text"
                              value={
                                selectedChargerId === "custom"
                                  ? customChargerVoltage
                                  : "—"
                              }
                              onChange={(e) =>
                                selectedChargerId === "custom" &&
                                setCustomChargerVoltage(e.target.value)
                              }
                              placeholder="e.g. 48V, 60V, 72V"
                              className="form-control"
                              disabled={selectedChargerId !== "custom"}
                              readOnly={selectedChargerId !== "custom"}
                            />
                          </div>
                          <div className="form-group">
                            <label>Charger warranty</label>
                            <select
                              value={chargerWarranty}
                              onChange={(e) => setChargerWarranty(e.target.value)}
                              className="form-control"
                              style={{ maxWidth: "200px" }}
                            >
                              <option value="with">With warranty</option>
                              <option value="without">Without warranty</option>
                            </select>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {selectedChargerId === "custom" && (
                    <div className="bill-detail-card">
                      <h4>Charger details</h4>
                      <dl>
                        <dt>Name</dt>
                        <dd>Custom</dd>
                        <dt>Voltage</dt>
                        <dd>{customChargerVoltage.trim() || "—"}</dd>
                        <dt>Warranty</dt>
                        <dd>{chargerWarranty === "with" ? "With warranty" : "Without warranty"}</dd>
                      </dl>
                    </div>
                  )}
                  {selectedCharger && (
                    <div className="bill-detail-card">
                      <h4>Charger details</h4>
                      <dl>
                        <dt>Name</dt>
                        <dd>{selectedCharger.name}</dd>
                        <dt>Battery type</dt>
                        <dd>{selectedCharger.batteryType || "—"}</dd>
                        <dt>Voltage</dt>
                        <dd>{selectedCharger.voltage || "—"}</dd>
                        <dt>Warranty</dt>
                        <dd>{chargerWarranty === "with" ? "With warranty" : "Without warranty"}</dd>
                        <dt>Selling price</dt>
                        <dd>₹{selectedCharger.sellingPrice}</dd>
                        {selectedCharger.supplierName && (
                          <>
                            <dt>Supplier</dt>
                            <dd>{selectedCharger.supplierName}</dd>
                          </>
                        )}
                      </dl>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bill-form-actions" style={{ justifyContent: "space-between", marginTop: "1rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveTab("customer")}
              >
                ← Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveTab("payment")}
              >
                Go to Payment →
              </button>
            </div>
          </>
        )}

        {/* Tab 3: Payment Details */}
        {activeTab === "payment" && (
          <div className="form-section payment-section">
            <h3>Payment Details</h3>
            <div className="form-section-inner">
              {selectedModel && (
                <div className="bill-model-price-info" style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px" }}>
                  <div style={{ fontWeight: "600", color: "#0c4a6e", marginBottom: "0.25rem" }}>
                    Model selling price
                  </div>
                  <div style={{ fontSize: "0.95rem", color: "#075985" }}>
                    ₹{(selectedModel.sellingPrice ?? 0).toLocaleString("en-IN")}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#0369a1", marginTop: "0.25rem" }}>
                    Price set for{" "}
                    {selectedModel.batteriesPerSet ??
                      selectedModel.stockEntries?.[0]?.batteriesPerSet ??
                      "—"}{" "}
                    batteries
                  </div>
                </div>
              )}
              <div className="payment-row">
                <div className="form-group">
                  <label>Selling Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder={selectedModel ? (selectedModel.sellingPrice ?? 0).toString() : "0"}
                  />
                </div>
                <div className="form-group" style={{ flex: "1 1 160px" }}>
                  <label>Discount (₹)</label>
                  <input
                    type="text"
                    value={discount}
                    readOnly
                    className="readonly"
                    title="Auto-calculated: Selling price − Net amount"
                  />
                </div>
                <div className="form-group net-amount-group">
                  <label>Net Amount (₹)</label>
                  <input
                    type="text"
                    value={netAmount}
                    readOnly
                    className="readonly"
                  />
                </div>
              </div>
              <div className="payment-row">
                <div className="form-group payment-key-amount">
                  <label>Amount Paid (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="form-group payment-key-amount">
                  <label>Pending (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={pendingAmount}
                    onChange={(e) => setPendingAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>
              </div>
              <div className="payment-row">
                <div className="form-group" style={{ flex: "1 1 180px" }}>
                  <label>Old scooty available?</label>
                  <select
                    value={oldScootyAvailable}
                    onChange={(e) => setOldScootyAvailable(e.target.value)}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: "1 1 160px" }}>
                  <label>Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={oldScootyExchangePrice}
                    onChange={(e) => setOldScootyExchangePrice(e.target.value)}
                    placeholder="0"
                    disabled={oldScootyAvailable !== "yes"}
                  />
                </div>
              </div>

              {oldScootyAvailable === "yes" && (
                <>
                  <div className="payment-row">
                    <div className="form-group" style={{ flex: "1 1 220px" }}>
                      <label>PMC No.</label>
                      <input
                        type="text"
                        value={oldScootyPmcNo}
                        onChange={(e) => setOldScootyPmcNo(e.target.value)}
                        placeholder="e.g. PMC-120"
                      />
                    </div>
                    <div className="form-group" style={{ flex: "1 1 220px" }}>
                      <label>With battery?</label>
                      <select
                        value={oldScootyWithBattery}
                        onChange={(e) => setOldScootyWithBattery(e.target.value)}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: "1 1 220px" }}>
                      <label>With charger?</label>
                      <select
                        value={oldScootyWithCharger}
                        onChange={(e) => setOldScootyWithCharger(e.target.value)}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </div>

                  {oldScootyWithBattery === "yes" && (
                    <div className="payment-row">
                      <div className="form-group" style={{ flex: "1 1 220px" }}>
                        <label>Old scooty battery type</label>
                        <select
                          value={oldScootyBatteryType}
                          onChange={(e) => setOldScootyBatteryType(e.target.value)}
                        >
                          <option value="">— Select type —</option>
                          <option value="lead">Lead</option>
                          <option value="lithium">Lithium</option>
                        </select>
                      </div>
                      {oldScootyBatteryType === "lead" && (
                        <div className="form-group" style={{ flex: "1 1 220px" }}>
                          <label>Number of batteries</label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={oldScootyBatteryCount}
                            onChange={(e) => setOldScootyBatteryCount(e.target.value)}
                            placeholder="e.g. 4"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {oldScootyWithCharger === "yes" && (
                    <div className="payment-row">
                      <div className="form-group" style={{ flex: "1 1 220px" }}>
                        <label>Old scooty charger type</label>
                        <select
                          value={oldScootyChargerType}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOldScootyChargerType(val);
                            if (val !== "lead") setOldScootyChargerLeadVoltage("");
                            if (val !== "lithium") setOldScootyChargerLithiumVoltage("");
                          }}
                        >
                          <option value="">— Select type —</option>
                          <option value="lead">Lead</option>
                          <option value="lithium">Lithium</option>
                        </select>
                      </div>
                      {oldScootyChargerType === "lead" && (
                        <div className="form-group" style={{ flex: "1 1 220px" }}>
                          <label>Voltage (lead)</label>
                          <select
                            value={oldScootyChargerLeadVoltage}
                            onChange={(e) => setOldScootyChargerLeadVoltage(e.target.value)}
                          >
                            <option value="">— Select voltage —</option>
                            <option value="48">48V</option>
                            <option value="60">60V</option>
                            <option value="72">72V</option>
                          </select>
                        </div>
                      )}
                      {oldScootyChargerType === "lithium" && (
                        <div className="form-group" style={{ flex: "1 1 220px" }}>
                          <label>Custom voltage (lithium)</label>
                          <input
                            type="text"
                            value={oldScootyChargerLithiumVoltage}
                            onChange={(e) =>
                              setOldScootyChargerLithiumVoltage(e.target.value)
                            }
                            placeholder="e.g. 60V, 72V"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              <div
                className="form-group"
                style={{ position: "relative", maxWidth: "440px" }}
              >
                <label>
                  Any accessory included{" "}
                  <span className="text-muted" style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={accessoryQuery}
                  onChange={async (e) => {
                    const value = e.target.value;
                    setAccessoryQuery(value);
                    setAccessorySelectedIndex(-1);
                    if (!value.trim()) {
                      setAccessorySuggestions([]);
                      setShowAccessorySuggestions(false);
                      return;
                    }
                    try {
                      const res = await fetch(
                        `${API}/spares/suggestions/names?search=${encodeURIComponent(
                          value.trim()
                        )}`
                      );
                      const data = await res.json();
                      if (res.ok) {
                        const suggestions = (data.suggestions || []).slice(0, 3);
                        setAccessorySuggestions(suggestions);
                        setAccessorySelectedIndex(suggestions.length ? 0 : -1);
                        setShowAccessorySuggestions(suggestions.length > 0);
                      } else {
                        setAccessorySuggestions([]);
                        setAccessorySelectedIndex(-1);
                        setShowAccessorySuggestions(false);
                      }
                    } catch {
                      setAccessorySuggestions([]);
                      setAccessorySelectedIndex(-1);
                      setShowAccessorySuggestions(false);
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (!showAccessorySuggestions || accessorySuggestions.length === 0) return;
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      setAccessorySelectedIndex((prev) => {
                        if (accessorySuggestions.length === 0) return -1;
                        if (prev === -1) return 0;
                        if (e.key === "ArrowDown") {
                          return prev >= accessorySuggestions.length - 1 ? 0 : prev + 1;
                        }
                        // ArrowUp
                        return prev <= 0 ? accessorySuggestions.length - 1 : prev - 1;
                      });
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      const idx =
                        accessorySelectedIndex >= 0
                          ? accessorySelectedIndex
                          : 0;
                      const name = accessorySuggestions[idx];
                      if (!name) return;
                      setAccessoryQuery("");
                      setShowAccessorySuggestions(false);
                      try {
                        const res = await fetch(
                          `${API}/spares?search=${encodeURIComponent(name)}`
                        );
                        const data = await res.json();
                        if (res.ok && Array.isArray(data) && data.length > 0) {
                          const spare = data[0];
                          setSelectedAccessories((prev) => {
                            const exists = prev.some(
                              (p) =>
                                (p._id && spare._id && p._id === spare._id) ||
                                (p.name || "").toLowerCase() ===
                                  (spare.name || "").toLowerCase()
                            );
                            return exists ? prev : [...prev, spare];
                          });
                        } else {
                          setSelectedAccessories((prev) => prev);
                        }
                      } catch {
                        setSelectedAccessories((prev) => prev);
                      }
                    } else if (e.key === "Escape") {
                      setShowAccessorySuggestions(false);
                      setAccessorySelectedIndex(-1);
                    }
                  }}
                  placeholder="Search accessory from spares (e.g. helmet, charger cable)"
                />
                {showAccessorySuggestions && accessorySuggestions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "0.5rem",
                      boxShadow: "0 10px 25px rgba(15, 23, 42, 0.15)",
                      marginTop: 0,
                      zIndex: 1000,
                      maxHeight: "220px",
                      overflowY: "auto",
                    }}
                  >
                    {accessorySuggestions.map((name, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={async () => {
                          setAccessoryQuery("");
                          setShowAccessorySuggestions(false);
                          try {
                            // Fetch full spare details by name via search
                            const res = await fetch(
                              `${API}/spares?search=${encodeURIComponent(name)}`
                            );
                            const data = await res.json();
                            if (res.ok && Array.isArray(data) && data.length > 0) {
                              const spare = data[0];
                              setSelectedAccessories((prev) => {
                                const exists = prev.some(
                                  (p) =>
                                    (p._id && spare._id && p._id === spare._id) ||
                                    (p.name || "").toLowerCase() ===
                                      (spare.name || "").toLowerCase()
                                );
                                return exists ? prev : [...prev, spare];
                              });
                            } else {
                              setSelectedAccessories((prev) => prev);
                            }
                          } catch {
                            setSelectedAccessories((prev) => prev);
                          }
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "0.5rem 0.75rem",
                          border: "none",
                          background:
                            idx === accessorySelectedIndex ? "#eff6ff" : "white",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#eff6ff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedAccessories.length > 0 && (
                <div
                  className="bill-model-price-info"
                  style={{
                    marginTop: "0.5rem",
                    padding: "0.65rem 0.95rem 0.9rem",
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.75rem",
                    maxWidth: "520px",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                    Accessory details
                  </div>
                  {selectedAccessories.map((acc) => (
                    <div
                      key={acc._id || acc.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.35rem 0",
                        borderTop: "1px dashed #e5e7eb",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.9rem", color: "#374151" }}>
                          {acc.name || "—"}
                        </div>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "#4b5563",
                            marginTop: "0.05rem",
                          }}
                        >
                          Price: ₹
                          {(acc.sellingPrice || 0).toLocaleString("en-IN")}
                          {acc.sku ? ` • SKU: ${acc.sku}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAccessories((prev) =>
                            prev.filter(
                              (p) =>
                                (p._id || p.name) !== (acc._id || acc.name)
                            )
                          );
                        }}
                        style={{
                          borderRadius: "999px",
                          border: "1px solid #fecaca",
                          background: "#fef2f2",
                          padding: "0.15rem 0.75rem",
                          fontSize: "0.78rem",
                          color: "#b91c1c",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="bill-form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate("/bills/all")}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Bill"}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
