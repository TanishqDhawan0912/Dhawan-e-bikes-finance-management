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

/** Lead pack size by voltage — matches finance model purchase adjustment (per-battery ₹2k there). */
const LEAD_VOLTAGE_TO_BATTERY_COUNT = { 48: 4, 60: 5, 72: 6 };
const SELLING_PRICE_DELTA_PER_BATTERY_VS_CATALOG = 3000;

function catalogBatteriesPerSetFromModel(model) {
  if (!model) return 0;
  return (
    Number(
      model.batteriesPerSet ?? model.stockEntries?.[0]?.batteriesPerSet
    ) || 0
  );
}

function leadSoldBatteryCount(voltageStr) {
  const n = Number.parseInt(String(voltageStr || ""), 10);
  return LEAD_VOLTAGE_TO_BATTERY_COUNT[n] || 0;
}

/** Same idea as Admin model cost: (sold − catalog) × delta for lead batteries on the bill. */
function sellingBatteryAdjustment(
  withBattery,
  batteryTypeForBill,
  batteryVoltage,
  catalogBatteriesPerSet
) {
  if (
    !withBattery ||
    batteryTypeForBill !== "lead" ||
    !batteryVoltage ||
    catalogBatteriesPerSet <= 0
  ) {
    return { soldCount: 0, deltaBatteries: 0, adjustment: 0 };
  }
  const soldCount = leadSoldBatteryCount(batteryVoltage);
  if (!soldCount) return { soldCount: 0, deltaBatteries: 0, adjustment: 0 };
  const deltaBatteries = soldCount - catalogBatteriesPerSet;
  return {
    soldCount,
    deltaBatteries,
    adjustment: deltaBatteries * SELLING_PRICE_DELTA_PER_BATTERY_VS_CATALOG,
  };
}

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

export default function NewBill({
  mode = "create",
  initialBill = null,
  billId = null,
} = {}) {
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
  const [modelWarranty, setModelWarranty] = useState(false); // true = With warranty, false = Without warranty
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
  const [batteryNumbers, setBatteryNumbers] = useState(""); // free text, any characters

  // Charger (selected for this bill)
  const [selectedChargerId, setSelectedChargerId] = useState("");
  const [withCharger, setWithCharger] = useState(true);
  const [chargerTypeForBill, setChargerTypeForBill] = useState(""); // "lead" | "lithium"
  const [customChargerVoltage, setCustomChargerVoltage] = useState("");

  // Payment
  const [sellingPrice, setSellingPrice] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [pendingAmount, setPendingAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [bankDetail, setBankDetail] = useState("");
  const [oldScootyAvailable, setOldScootyAvailable] = useState("no"); // "yes" | "no"
  const [oldScootyPmcNo, setOldScootyPmcNo] = useState("");
  const [oldScootyWithBattery, setOldScootyWithBattery] = useState("no"); // "yes" | "no"
  const [oldScootyBatteryType, setOldScootyBatteryType] = useState(""); // "lead" | "lithium"
  const [oldScootyBatteryCount, setOldScootyBatteryCount] = useState("");
  const [oldScootyWithCharger, setOldScootyWithCharger] = useState("no"); // "yes" | "no"
  const [oldScootyChargerType, setOldScootyChargerType] = useState(""); // "lead" | "lithium"
  const [oldScootyChargerLeadVoltage, setOldScootyChargerLeadVoltage] =
    useState(""); // "48" | "60" | "72"
  const [oldScootyChargerLithiumVoltage, setOldScootyChargerLithiumVoltage] =
    useState("");
   const [oldScootyChargerWorking, setOldScootyChargerWorking] =
    useState("working"); // "working" | "notWorking"
  const [oldScootyExchangePrice, setOldScootyExchangePrice] = useState("");
  const [accessoryQuery, setAccessoryQuery] = useState(""); // optional spare search (name)
  const [accessorySuggestions, setAccessorySuggestions] = useState([]);
  const [showAccessorySuggestions, setShowAccessorySuggestions] =
    useState(false);
  const [selectedAccessories, setSelectedAccessories] = useState([]); // array of spare objects
  const [accessorySelectedIndex, setAccessorySelectedIndex] = useState(-1);

  // Guard so edit prefill values don't get overwritten by "clear fields" effects.
  const prefillInProgressRef = useRef(false);

  // Prevent accidental value changes when user scrolls over focused inputs
  // (e.g., mouse wheel incrementing number fields).
  const handleWheelCapture = (e) => {
    const t = e.target;
    if (!t || typeof t !== "object") return;
    const tag = t.tagName ? String(t.tagName).toLowerCase() : "";
    if (tag === "input" || tag === "select" || tag === "textarea") {
      if (typeof t.blur === "function") t.blur();
    }
  };

  // If payment mode is not UPI, clear bank detail so we don't accidentally submit it.
  useEffect(() => {
    if (paymentMode !== "upi") {
      setBankDetail("");
    }
  }, [paymentMode]);

  // Prefill form fields when editing an existing bill.
  useEffect(() => {
    if (mode !== "edit" || !initialBill) return;

    prefillInProgressRef.current = true;

    const b = initialBill;

    setBillNo(b.billNo || "");
    setBillDate(b.billDate || "");
    setCustomerName(b.customerName || "");
    setMobile(b.mobile || "");
    setAddress(b.address || "");

    setModelPurchased(b.modelPurchased || "");
    setDescriptionVariant(b.descriptionVariant || "");
    setModelColor(b.modelColor || "");

    // Warranty is stored as string in backend: "With warranty" or "No warranty"
    const warrantyStr = (b.warranty || "").toString().toLowerCase();
    setModelWarranty(warrantyStr.includes("with warranty"));

    setWithBattery(b.withBattery !== undefined ? b.withBattery : true);
    setWithCharger(b.withCharger !== undefined ? b.withCharger : true);

    // Prefill new battery / charger snapshot (used for edit mode + All Bills display)
    setSelectedBatteryId(b.batteryId || "");
    setSelectedChargerId(b.chargerId || "");

    setBatteryTypeForBill(b.batteryTypeForBill || "");
    setChargerTypeForBill(b.chargerTypeForBill || "");

    const leadVoltageMatch =
      (b.batteryVoltageForBill || "").toString().match(/\b(48|60|72)\b/i);
    if (leadVoltageMatch && leadVoltageMatch[1]) {
      setBatteryVoltage(leadVoltageMatch[1]);
    } else {
      setBatteryVoltage("");
    }
    // Lithium voltage can be a free-text field like "72V"
    setCustomLithiumVoltage(b.batteryVoltageForBill || "");
    setBatteryNumbers(
      b.batteryNumbersForBill ||
        b.batteryNumbers ||
        (b.batteryName && b.batteryName.toLowerCase() !== "custom"
          ? b.batteryName
          : "")
    );

    setCustomChargerVoltage(b.chargerVoltageForBill || "");

    setSellingPrice(String(b.sellingPrice ?? 0));
    setPaidAmount(String(b.paidAmount ?? 0));
    setPendingAmount(String(b.pendingAmount ?? 0));
    setPaymentMode(b.paymentMode || "cash");

    setBankDetail(
      b.bankDetail ||
        [b.upiId, b.upiTransactionId, b.upiTransactionDate]
          .filter(Boolean)
          .join(" | ")
    );

    const oldScootyText = (b.oldScootyExchange || "").toString().trim();
    const oldScootyPrice = Number(b.oldScootyExchangePrice ?? 0);
    const hasOldScooty = !!oldScootyText || oldScootyPrice > 0;
    setOldScootyAvailable(hasOldScooty ? "yes" : "no");
    setOldScootyExchangePrice(String(oldScootyPrice ?? 0));

    // If this bill already has payment/old-scooty info, show Payment tab by default in edit mode.
    const hasPayment =
      (Number(b.pendingAmount) || 0) > 0 ||
      (Number(b.paidAmount) || 0) > 0 ||
      (Array.isArray(b.paymentHistory) && b.paymentHistory.length > 0);
    if (hasOldScooty || hasPayment) setActiveTab("payment");

    // Parse old scooty exchange string built by handleSubmit in this same component.
    // Example:
    // "PMC No.: 101 | Battery: with battery, Lead, 5 batteries | Charger: with charger, Lead, 60V, Working"
    if (hasOldScooty) {
      // More tolerant: match first number after "PMC"
      const pmcMatch = oldScootyText.match(/PMC[^0-9]*([0-9]+)/i);
      setOldScootyPmcNo(pmcMatch ? pmcMatch[1].trim() : "");

      // Split into segments using markers (more tolerant than lookaheads)
      const batterySegMatch = oldScootyText.match(
        /Battery:\s*([\s\S]*?)(?=Charger:|$)/i
      );
      const batterySeg = batterySegMatch ? batterySegMatch[1].trim() : "";

      const chargerSegMatch = oldScootyText.match(
        /Charger:\s*([\s\S]*?)(?=Price\s*₹|Price\s*:|$)/i
      );
      const chargerSeg = chargerSegMatch ? chargerSegMatch[1].trim() : "";

      // Avoid being too strict on "Battery:" formatting; the exchange string
      // always contains either "with battery" or "without battery".
      const batteryWith =
        /with\s*battery/i.test(oldScootyText) &&
        !/without\s*battery/i.test(oldScootyText);
      const batterySrcForParsing = batterySeg || oldScootyText;
      setOldScootyWithBattery(batteryWith ? "yes" : "no");

      const batteryType = /Lead/i.test(batterySrcForParsing)
        ? "lead"
        : /Lithium/i.test(batterySrcForParsing)
        ? "lithium"
        : "";
      setOldScootyBatteryType(batteryWith ? batteryType : "");

      // Match "5 battery" or "5 batteries"
      const countMatch = batterySrcForParsing.match(/(\d+)\s+batter(?:y|ies)/i);
      setOldScootyBatteryCount(
        batteryWith && countMatch ? countMatch[1].trim() : ""
      );

      const chargerWith =
        /with\s*charger/i.test(oldScootyText) &&
        !/without\s*charger/i.test(oldScootyText);
      const chargerSrcForParsing = chargerSeg || oldScootyText;
      setOldScootyWithCharger(chargerWith ? "yes" : "no");

      const chargerType = /Lead/i.test(chargerSrcForParsing)
        ? "lead"
        : /Lithium/i.test(chargerSrcForParsing)
        ? "lithium"
        : "";
      setOldScootyChargerType(chargerWith ? chargerType : "");

      setOldScootyChargerWorking(
        chargerWith
          ? /Not working/i.test(chargerSrcForParsing)
            ? "notWorking"
            : "working"
          : "working"
      );

      const leadVoltageMatch = chargerSrcForParsing.match(/(\d+)\s*V/i);
      setOldScootyChargerLeadVoltage(
        chargerWith && chargerType === "lead" && leadVoltageMatch
          ? leadVoltageMatch[1].trim()
          : ""
      );

      const lithiumVoltageMatch = chargerSrcForParsing.match(/(\d+\s*V)/i);
      setOldScootyChargerLithiumVoltage(
        chargerWith && chargerType === "lithium" && lithiumVoltageMatch
          ? lithiumVoltageMatch[1].replace(/\s+/g, "")
          : ""
      );
    }

    // Accessories: API stores `accessoryDetails` with `id`; UI uses spare-shaped `_id`.
    if (Array.isArray(b.accessoryDetails) && b.accessoryDetails.length > 0) {
      setSelectedAccessories(
        b.accessoryDetails.map((row) => ({
          _id: row.id || "",
          name: row.name || "",
          sellingPrice: Number(row.sellingPrice) || 0,
          sku: row.sku || "",
        }))
      );
      setAccessoryQuery("");
    } else {
      setSelectedAccessories([]);
      const legacy = (b.accessoryIncluded || "").toString().trim();
      setAccessoryQuery(legacy);
    }

    // Release guard on next tick so the "clear fields" effect
    // doesn't overwrite prefilled values in the same commit.
    setTimeout(() => {
      prefillInProgressRef.current = false;
    }, 0);
  }, [mode, initialBill]);

  // After models are fetched, try to re-create selectedModel for a nicer edit experience.
  useEffect(() => {
    if (mode !== "edit" || !initialBill) return;
    if (!Array.isArray(models) || models.length === 0) return;

    const match =
      models.find((m) => m._id === initialBill.modelId) ||
      models.find((m) => m.modelName === initialBill.modelPurchased) ||
      null;

    setSelectedModel(match);
  }, [mode, initialBill, models]);

  // Edit-mode fallback: older bills may not have batteryId saved.
  // Resolve selection from batteryName so edit prefill still works.
  useEffect(() => {
    if (mode !== "edit" || !initialBill) return;
    if (!withBattery) return;
    if (!Array.isArray(batteries) || batteries.length === 0) return;
    if (selectedBatteryId) return;

    const savedName = String(initialBill.batteryName || "").trim();
    if (!savedName) return;

    if (savedName.toLowerCase() === "custom") {
      setSelectedBatteryId("custom");
      return;
    }

    const match = batteries.find(
      (b) =>
        String(b?.name || "")
          .trim()
          .toLowerCase() === savedName.toLowerCase()
    );
    if (match?._id) {
      setSelectedBatteryId(match._id);
      if (!batteryTypeForBill && match.batteryType) {
        setBatteryTypeForBill(String(match.batteryType).toLowerCase());
      }
    }
  }, [
    mode,
    initialBill,
    withBattery,
    batteries,
    selectedBatteryId,
    batteryTypeForBill,
  ]);

  // Edit-mode fallback: older bills may not have chargerId saved.
  // Resolve selection from chargerName so edit prefill still works.
  useEffect(() => {
    if (mode !== "edit" || !initialBill) return;
    if (!withCharger) return;
    if (!Array.isArray(chargers) || chargers.length === 0) return;
    if (selectedChargerId) return;

    const savedName = String(initialBill.chargerName || "").trim();
    if (!savedName) return;

    if (savedName.toLowerCase() === "custom") {
      setSelectedChargerId("custom");
      return;
    }

    const match = chargers.find(
      (c) =>
        String(c?.name || "")
          .trim()
          .toLowerCase() === savedName.toLowerCase()
    );
    if (match?._id) {
      setSelectedChargerId(match._id);
      if (!chargerTypeForBill && match.batteryType) {
        setChargerTypeForBill(String(match.batteryType).toLowerCase());
      }
    }
  }, [
    mode,
    initialBill,
    withCharger,
    chargers,
    selectedChargerId,
    chargerTypeForBill,
  ]);

  // If lead voltage is missing in older bills, infer from selected battery set size.
  useEffect(() => {
    if (mode !== "edit") return;
    if (batteryTypeForBill !== "lead") return;
    if (batteryVoltage) return;
    if (!selectedBatteryId || !Array.isArray(batteries) || batteries.length === 0)
      return;
    const matchedBattery =
      batteries.find((b) => b._id === selectedBatteryId) || null;
    if (!matchedBattery || !matchedBattery.batteriesPerSet) return;
    const setSize = Number(matchedBattery.batteriesPerSet) || 0;
    if (setSize === 4) setBatteryVoltage("48");
    else if (setSize === 5) setBatteryVoltage("60");
    else if (setSize === 6) setBatteryVoltage("72");
  }, [mode, batteryTypeForBill, batteryVoltage, selectedBatteryId, batteries]);

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
    if (prefillInProgressRef.current) return;
    setSelectedBatteryId("");
  }, [batteryTypeForBill, batteryVoltage]);

  // When switching from Custom to a specific battery, clear custom voltage
  useEffect(() => {
    if (selectedBatteryId && selectedBatteryId !== "custom") {
      setCustomLithiumVoltage("");
    }
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
    // Auto-sync charger type with battery type.
    // User can override manually; this will re-sync only when battery type changes again.
    if (prefillInProgressRef.current) return;
    if (batteryTypeForBill && withCharger && !chargerTypeForBill) {
      setChargerTypeForBill(batteryTypeForBill);
    }
  }, [batteryTypeForBill, chargerTypeForBill, withCharger]);

  // When charger type changes, clear selected charger
  useEffect(() => {
    if (prefillInProgressRef.current) return;
    setSelectedChargerId("");
  }, [chargerTypeForBill]);

  // When old scooty is not available, clear its detailed fields
  useEffect(() => {
    if (prefillInProgressRef.current) return;
    if (oldScootyAvailable !== "yes") {
      setOldScootyPmcNo("");
      setOldScootyWithBattery("no");
      setOldScootyBatteryType("");
      setOldScootyBatteryCount("");
      setOldScootyWithCharger("no");
      setOldScootyChargerType("");
      setOldScootyChargerLeadVoltage("");
      setOldScootyChargerLithiumVoltage("");
      setOldScootyChargerWorking("working");
      setOldScootyExchangePrice("");
    }
  }, [oldScootyAvailable]);

  // When switching from Custom to a specific charger, clear custom voltage
  useEffect(() => {
    if (selectedChargerId && selectedChargerId !== "custom") {
      setCustomChargerVoltage("");
    }
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
            : data.data && Array.isArray(data.data)
            ? data.data
            : data.models && Array.isArray(data.models)
            ? data.models
            : [];
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
        const existing = target.find(
          (x) => x.color.toLowerCase() === c.toLowerCase()
        );
        if (existing) existing.quantity += cq.quantity || 0;
        else target.push({ color: c, quantity: cq.quantity || 0 });
      });
    };

    if (
      Array.isArray(selectedModel.description) &&
      selectedModel.description.length > 0
    ) {
      const tags = selectedModel.description
        .map((d) => (d || "").trim())
        .filter(Boolean);
      const key = JSON.stringify([...tags].sort());
      const colors = [];
      addColors(colors, selectedModel.colorQuantities);
      groups.push({ tags, colors, key });
      keyToIndex[key] = groups.length - 1;
    }

    (selectedModel.stockEntries || []).forEach((entry) => {
      const entryTags = (entry.description || [])
        .map((d) => (d || "").trim())
        .filter(Boolean);
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
      (g) =>
        g.tags.join(", ") === descriptionVariant ||
        g.tags.includes(descriptionVariant)
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
              (m.modelName &&
                m.modelName
                  .toLowerCase()
                  .includes(modelPurchased.trim().toLowerCase())) ||
              (m.company &&
                m.company
                  .toLowerCase()
                  .includes(modelPurchased.trim().toLowerCase()))
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
      const next =
        modelSelectedIndexRef.current < 0
          ? 0
          : modelSelectedIndexRef.current >= len - 1
          ? 0
          : modelSelectedIndexRef.current + 1;
      modelSelectedIndexRef.current = next;
      setModelSelectedIndex(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setModelSuggestionsOpen(true);
      const next =
        modelSelectedIndexRef.current <= 0
          ? len - 1
          : modelSelectedIndexRef.current - 1;
      modelSelectedIndexRef.current = next;
      setModelSelectedIndex(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx =
        modelSelectedIndexRef.current >= 0 ? modelSelectedIndexRef.current : 0;
      if (modelSuggestions[idx]) {
        handleSelectModelSuggestion(modelSuggestions[idx]);
      }
    } else if (e.key === "Escape") {
      setModelSuggestionsOpen(false);
      modelSelectedIndexRef.current = -1;
      setModelSelectedIndex(-1);
    }
  };

  const selectedBattery =
    batteries.find((b) => b._id === selectedBatteryId) || null;
  const selectedCharger =
    chargers.find((c) => c._id === selectedChargerId) || null;

  const modelSellingBatteryBreakdown = useMemo(() => {
    const catalog = catalogBatteriesPerSetFromModel(selectedModel);
    const base =
      selectedModel != null &&
      selectedModel.sellingPrice != null &&
      selectedModel.sellingPrice !== ""
        ? Number(selectedModel.sellingPrice) || 0
        : 0;
    const { soldCount, deltaBatteries, adjustment } = sellingBatteryAdjustment(
      withBattery,
      batteryTypeForBill,
      batteryVoltage,
      catalog
    );
    return {
      base,
      catalogBatteriesPerSet: catalog,
      soldCount,
      deltaBatteries,
      adjustment,
      suggested: base + adjustment,
    };
  }, [
    selectedModel,
    withBattery,
    batteryTypeForBill,
    batteryVoltage,
  ]);

  // New bill: selling price = model list price + ₹3,000 × (bill batteries − catalog set), like purchase ₹2,000 rule.
  useEffect(() => {
    if (mode === "edit") return;
    if (
      !selectedModel ||
      selectedModel.sellingPrice == null ||
      selectedModel.sellingPrice === ""
    ) {
      return;
    }
    setSellingPrice(String(modelSellingBatteryBreakdown.suggested));
  }, [
    mode,
    selectedModel?.modelName,
    selectedModel?.sellingPrice,
    modelSellingBatteryBreakdown.suggested,
  ]);

  const oldScootyPriceNumber = Number(oldScootyExchangePrice) || 0;
  const paidNum = Number(paidAmount) || 0;
  const sellNum = Number(sellingPrice) || 0;
  // Discount = list price minus (cash paid + trade-in value). Pending is balance due, not part of this sum.
  const discount = Math.max(0, sellNum - (paidNum + oldScootyPriceNumber));
  const netAmount = sellNum - discount;

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
      if (mobileDigits.length === 0)
        reasons.push("Mobile No. is required (10 digits).");
      else
        reasons.push(
          `Mobile No. must be exactly 10 digits (currently ${mobileDigits.length}).`
        );
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
  const batteryRequiredCount = batteryVoltage
    ? LEAD_VOLTAGE_TO_BATTERY_COUNT[
        Number.parseInt(String(batteryVoltage), 10)
      ] || LEAD_VOLTAGE_TO_BATTERY_COUNT[batteryVoltage]
    : 0;
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
    if (e?.preventDefault) e.preventDefault();
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
    if (mode === "edit" && !billId) {
      setError("Bill id is missing for edit.");
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
            batteryBits.push(
              oldScootyBatteryType === "lead" ? "Lead" : "Lithium"
            );
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
            chargerBits.push(
              oldScootyChargerType === "lead" ? "Lead" : "Lithium"
            );
          }
          if (oldScootyChargerType === "lead" && oldScootyChargerLeadVoltage) {
            chargerBits.push(`${oldScootyChargerLeadVoltage}V`);
          }
          if (
            oldScootyChargerType === "lithium" &&
            oldScootyChargerLithiumVoltage.trim()
          ) {
            chargerBits.push(oldScootyChargerLithiumVoltage.trim());
          }
          chargerBits.push(
            oldScootyChargerWorking === "working" ? "Working" : "Not working"
          );
          parts.push(`Charger: ${chargerBits.join(", ")}`);
        } else {
          parts.push("Without charger");
        }
        oldScootyExchange = parts.join(" | ");
      }

      const getVoltageFromName = (name) => {
        if (!name) return "";
        const str = String(name);
        // Try to capture patterns like "60V" from battery/chgaer names
        const m = str.match(/(\d+\s*V)/i);
        if (m && m[1]) return m[1].replace(/\s+/g, "");
        // Fallback: capture just 48/60/72 and append V
        const n = str.match(/\b(48|60|72)\b/i);
        if (n && n[1]) return `${n[1]}V`;
        return "";
      };

      const batteryVoltageForBillValue =
        batteryTypeForBill === "lead"
          ? batteryVoltage
            ? `${batteryVoltage}V`
            : ""
          : customLithiumVoltage.trim() ||
            getVoltageFromName(selectedBattery?.name || "");

      const chargerVoltageForBillValue =
        selectedChargerId === "custom"
          ? customChargerVoltage.trim()
          : selectedCharger?.voltage || "";

      const batteryNameForBill =
        selectedBatteryId === "custom" ? "Custom" : selectedBattery?.name || "";

      const chargerNameForBill =
        selectedChargerId === "custom" ? "Custom" : selectedCharger?.name || "";

      const sellP = Number(sellingPrice) || 0;
      const paidP = Number(paidAmount) || 0;
      const oldP = Number(oldScootyExchangePrice) || 0;
      const billDiscount = Math.max(0, sellP - (paidP + oldP));
      const billNet = sellP - billDiscount;

      const payload = {
        billNo: billNo.trim(),
        billDate: billDate.trim(),
        customerName: customerName.trim(),
        mobile: mobile.replace(/\D/g, ""),
        address: address.trim(),
        modelId: selectedModel?._id || initialBill?.modelId || "",
        modelPurchased: modelPurchased.trim(),
        descriptionVariant: descriptionVariant.trim(),
        modelColor: modelColor.trim(),
        sellingPrice: sellP,
        discount: billDiscount,
        netAmount: billNet,
        paidAmount: paidP,
        pendingAmount: Number(pendingAmount) || 0,
        paymentMode: paymentMode || "cash",
        warranty: modelWarranty ? "With warranty" : "No warranty",
        bankDetail: paymentMode === "upi" ? bankDetail.trim() : "",
        batteryId: withBattery ? selectedBatteryId : "",
        batteryName: withBattery ? batteryNameForBill : "",
        batteryTypeForBill: withBattery ? batteryTypeForBill : "",
        batteryVoltageForBill: withBattery ? batteryVoltageForBillValue || "" : "",
        batteryNumbersForBill: withBattery ? batteryNumbers.trim() : "",
        chargerId: withCharger ? selectedChargerId : "",
        chargerName: withCharger ? chargerNameForBill : "",
        chargerTypeForBill: withCharger ? chargerTypeForBill : "",
        chargerVoltageForBill: withCharger ? chargerVoltageForBillValue || "" : "",
        oldScootyExchange: oldScootyExchange.trim(),
        oldScootyExchangePrice: Number(oldScootyExchangePrice) || 0,
        oldScootyAvailable,
        oldScootyPmcNo: oldScootyPmcNo.trim(),
        oldScootyWithBattery,
        oldScootyBatteryType,
        oldScootyBatteryCount: Number(oldScootyBatteryCount) || 0,
        oldScootyWithCharger,
        oldScootyChargerType,
        oldScootyChargerVoltageAmpere:
          oldScootyChargerType === "lead"
            ? oldScootyChargerLeadVoltage
              ? `${oldScootyChargerLeadVoltage}V`
              : ""
            : oldScootyChargerLithiumVoltage.trim(),
        oldScootyChargerWorking,
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
      const isEdit = mode === "edit";
      const res = await fetch(
        isEdit ? `${API}/bills/${billId}` : `${API}/bills`,
        {
          method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.message ||
            data.error ||
            (isEdit ? "Failed to update bill" : "Failed to create bill")
        );
      }
      const savedBill = await res.json();
      const savedId =
        savedBill && savedBill._id != null
          ? String(savedBill._id)
          : isEdit && billId
          ? String(billId)
          : "";
      alert(isEdit ? "Bill updated successfully." : "Bill created successfully.");
      if (savedId) {
        navigate(`/bills/all?billId=${encodeURIComponent(savedId)}`);
      } else {
        navigate("/bills/all");
      }
    } catch (err) {
      setError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <form
        noValidate
        onSubmit={handleSubmit}
        onWheelCapture={handleWheelCapture}
        className="bill-form-tabs-wrapper"
      >
        {error && activeTab !== "payment" && (
          <p className="bill-form-error" role="alert">
            {error}
          </p>
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
              <div
                className="form-row"
                style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}
              >
                <div className="form-group" style={{ flex: "1 1 200px" }}>
                  <label>
                    Bill No. <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                    placeholder="Bill number"
                  />
                </div>
                <div className="form-group" style={{ flex: "1 1 200px" }}>
                  <label>
                    Bill Date <span className="required">*</span>
                  </label>
                  <DatePicker
                    value={billDate}
                    onChange={setBillDate}
                    placeholder="Select date"
                    className="date-picker-modern"
                  />
                </div>
              </div>
              <div
                className="form-row"
                style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}
              >
                <div className="form-group" style={{ flex: "1 1 200px" }}>
                  <label>
                    Customer Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name"
                  />
                </div>
                <div className="form-group" style={{ flex: "1 1 200px" }}>
                  <label>
                    Mobile No. <span className="required">*</span>
                  </label>
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
              <div
                className="bill-form-actions"
                style={{ borderTop: "none", paddingTop: 0 }}
              >
                <button
                  type="button"
                  className={`btn ${
                    isCustomerDetailsComplete
                      ? "btn-primary"
                      : "btn-primary btn-disabled"
                  }`}
                  onClick={handleSelectModelClick}
                  title={
                    !isCustomerDetailsComplete
                      ? "Fill all required fields to continue"
                      : undefined
                  }
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
                  className={`bill-subtab ${
                    modelSubTab === tab.id ? "active" : ""
                  } ${isSubtabComplete(tab.id) ? "complete" : ""}`}
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
                    <label>
                      Model Name <span className="required">*</span>
                    </label>
                    <div className="model-name-autocomplete">
                      <input
                        ref={modelInputRef}
                        type="text"
                        value={modelPurchased}
                        onChange={(e) => {
                          const v = e.target.value;
                          setModelPurchased(v);
                          if (selectedModel && v !== selectedModel.modelName)
                            setDescriptionVariant("");
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
                          <div
                            className="model-suggestions-empty"
                            role="status"
                          >
                            No models found matching &quot;{modelPurchased}
                            &quot;
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
                              className={`model-suggestion-item ${
                                modelSelectedIndex === index
                                  ? "model-suggestion-item-selected"
                                  : ""
                              }`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectModelSuggestion(m);
                              }}
                              onMouseEnter={() => setModelSelectedIndex(index)}
                            >
                              <span className="model-suggestion-name">
                                {m.modelName}
                              </span>
                              {m.company && (
                                <span className="model-suggestion-company">
                                  {" "}
                                  ({m.company})
                                </span>
                              )}
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
                            onChange={(e) =>
                              setDescriptionVariant(e.target.value)
                            }
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
                            <div
                              className="form-group"
                              style={{ marginTop: "0.75rem" }}
                            >
                              <label>Description selected</label>
                              <input
                                type="text"
                                readOnly
                                className="readonly"
                                value={descriptionVariant}
                              />
                            </div>
                          ) : null}
                          {descriptionVariant &&
                            (() => {
                              const selectedGroup =
                                descriptionVariantGroups.find(
                                  (g) =>
                                    g.tags.join(", ") === descriptionVariant
                                );
                              if (
                                !selectedGroup ||
                                selectedGroup.colors.length === 0
                              )
                                return null;
                              return (
                                <div className="bill-description-group-colors">
                                  <span className="bill-description-group-colors-label">
                                    Colors available for this variant (click to
                                    select):
                                  </span>
                                  <div className="bill-colors-available">
                                    {selectedGroup.colors.map((c, i) => (
                                      <button
                                        key={i}
                                        type="button"
                                        className={`bill-color-chip bill-color-chip-clickable ${
                                          modelColor.trim().toLowerCase() ===
                                          c.color.toLowerCase()
                                            ? "bill-color-chip-selected"
                                            : ""
                                        }`}
                                        onClick={() => setModelColor(c.color)}
                                      >
                                        <span
                                          className="bill-color-swatch"
                                          style={{
                                            backgroundColor: getColorHex(
                                              c.color
                                            ),
                                          }}
                                          title={c.color}
                                        />
                                        <span>
                                          {c.color} ({c.quantity})
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                        </>
                      ) : (
                        <p className="bill-specs-empty">
                          No description variants for this model. Add
                          descriptions in model stock entries.
                        </p>
                      )
                    ) : (
                      <p className="bill-colors-hint">
                        Select a model above to see description variants.
                      </p>
                    )}
    </div>
                  <div className="form-group">
                    <label>
                      Color selected <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={modelColor}
                      onChange={(e) => setModelColor(e.target.value)}
                      placeholder="e.g. Black, Red"
                    />
                  </div>

                  <div className="form-group">
                    <label>Warranty status</label>
                    <select
                      value={modelWarranty ? "with" : "no"}
                      onChange={(e) =>
                        setModelWarranty(e.target.value === "with")
                      }
                      style={{ maxWidth: "280px" }}
                    >
                      <option value="with">With warranty</option>
                      <option value="no">No warranty</option>
                    </select>
                  </div>
                </div>
                <div
                  className="form-group"
                  style={{
                    marginTop: "0.75rem",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary bill-select-battery-button"
                    onClick={() => setModelSubTab("battery")}
                  >
                    Select battery →
                  </button>
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
                          onChange={(e) =>
                            setBatteryTypeForBill(e.target.value)
                          }
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
                                onChange={(e) =>
                                  setBatteryVoltage(e.target.value)
                                }
                                className="battery-type-select"
                              >
                                <option value="">— Select voltage —</option>
                                <option value="48">48V (4 batteries)</option>
                                <option value="60">60V (5 batteries)</option>
                                <option value="72">72V (6 batteries)</option>
                              </select>
                            </div>
                          )}
                          {(batteryTypeForBill === "lithium" ||
                            (isLead && batteryVoltage) ||
                            (mode === "edit" && Boolean(selectedBatteryId))) && (
                            <div className="form-group">
                              <label>Select Battery</label>
                              {(() => {
                                const availableBatteriesRaw = batteries.filter(
                                  (b) => {
                                    const bt = String(
                                      b.batteryType || ""
                                    ).toLowerCase();
                                    if (
                                      bt &&
                                      bt !== batteryTypeForBill
                                    ) {
                                      return false;
                                    }
                                    const unitStock =
                                      (b.totalSets || 0) *
                                        (b.batteriesPerSet || 0) +
                                      (b.openBatteries || 0);
                                    if (batteryTypeForBill === "lithium") {
                                      // Lithium: any units in stock (open-only stock uses openBatteries when batteriesPerSet is 0)
                                      return unitStock > 0;
                                    }
                                    return unitStock >= batteryRequiredCount;
                                  }
                                );
                                const availableBatteries =
                                  selectedBattery &&
                                  !availableBatteriesRaw.some(
                                    (b) => b._id === selectedBattery._id
                                  )
                                    ? [selectedBattery, ...availableBatteriesRaw]
                                    : availableBatteriesRaw;
                                return (
                                  <>
                                    <select
                                      value={selectedBatteryId}
                                      onChange={(e) =>
                                        setSelectedBatteryId(e.target.value)
                                      }
                                    >
                                      <option value="">
                                        — Select battery —
                                      </option>
                                      {batteryTypeForBill === "lithium" && (
                                        <option value="custom">
                                          — Custom —
                                        </option>
                                      )}
                                      {availableBatteries.map((b) => (
                                        <option key={b._id} value={b._id}>
                                          {b.name}
                                          {b.ampereValue
                                            ? ` (${b.ampereValue}A)`
                                            : ""}
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
                            (selectedBatteryId === "custom" ||
                              selectedBattery) && (
                              <div className="form-group">
                                <label>
                                  Voltage{" "}
                                  {selectedBatteryId === "custom"
                                    ? "(optional)"
                                    : ""}
                                </label>
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
                          {(selectedBatteryId === "custom" ||
                            selectedBattery) && (
                            <div className="form-group">
                              <label>Battery numbers</label>
                              <input
                                type="text"
                                value={batteryNumbers}
                                onChange={(e) =>
                                  setBatteryNumbers(e.target.value)
                                }
                                placeholder="Enter battery numbers"
                                className="form-control"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {selectedBatteryId === "custom" &&
                    batteryTypeForBill === "lithium" && (
                      <div className="bill-detail-card">
                        <h4>Battery details</h4>
                        <dl>
                          <dt>Name</dt>
                          <dd>Custom</dd>
                          <dt>Voltage</dt>
                          <dd>{customLithiumVoltage.trim() || "—"}</dd>
                          <dt>Warranty</dt>
                          <dd>
                            {modelWarranty ? "With warranty" : "No warranty"}
                          </dd>
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
                        {batteryTypeForBill === "lithium" &&
                          customLithiumVoltage.trim() && (
                            <>
                              <dt>Voltage</dt>
                              <dd>{customLithiumVoltage.trim()}</dd>
                            </>
                          )}
                        {isLead && batteryVoltage && (
                          <>
                            <dt>Voltage / Batteries used</dt>
                            <dd>
                              {batteryVoltage}V ({batteryRequiredCount}{" "}
                              batteries)
                            </dd>
                          </>
                        )}
                        <dt>Warranty</dt>
                        <dd>
                          {modelWarranty ? "With warranty" : "No warranty"}
                        </dd>
                        <dt>Battery numbers</dt>
                        <dd>{batteryNumbers.trim() || "—"}</dd>
                      </dl>
                    </div>
                  )}
                  <div
                    className="form-group local-model-nav-actions"
                    style={{
                      marginTop: "0.75rem",
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "0.75rem",
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary bill-select-battery-button"
                      style={{ marginRight: "auto" }}
                      onClick={() => setModelSubTab("model")}
                    >
                      ← Back to model
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary bill-select-battery-button"
                      onClick={() => setModelSubTab("charger")}
                    >
                      Select charger →
                    </button>
                  </div>
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
                          onChange={(e) =>
                            setChargerTypeForBill(e.target.value)
                          }
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
                            onChange={(e) =>
                              setSelectedChargerId(e.target.value)
                            }
                          >
                            <option value="">— Select charger —</option>
                            <option value="custom">— Custom —</option>
                            {(() => {
                              const filteredChargers = chargers
                              .filter((c) => {
                                if (
                                  selectedCharger &&
                                  c._id === selectedCharger._id
                                )
                                  return true;
                                if ((c.quantity || 0) <= 0) return false;
                                const type = (c.batteryType || "")
                                  .toLowerCase()
                                  .trim();
                                if (!type) return true; // no type = show in both
                                return type === chargerTypeForBill;
                              })
                              .map((c) => (
                                <option key={c._id} value={c._id}>
                                  {c.name}
                                  {c.voltage ? ` (${c.voltage})` : ""}
                                </option>
                              ));
                              return filteredChargers;
                            })()}
                          </select>
                          {chargers.filter((c) => {
                            if ((c.quantity || 0) <= 0) return false;
                            const type = (c.batteryType || "")
                              .toLowerCase()
                              .trim();
                            if (!type) return true;
                            return type === chargerTypeForBill;
                          }).length === 0 && (
                            <p className="form-help text-muted">
                              No chargers in stock for this type. Add stock or
                              choose another type.
                            </p>
                          )}
                        </div>
                      )}
                      {(selectedChargerId === "custom" || selectedCharger) && (
                        <>
                          <div className="form-group">
                            <label>
                              Voltage{" "}
                              {selectedChargerId === "custom"
                                ? "(optional)"
                                : ""}
                            </label>
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
                          {/* Warranty is now selected once in Model Details (single warranty status) */}
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
                        <dd>
                          {modelWarranty ? "With warranty" : "No warranty"}
                        </dd>
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
                        <dd>
                          {modelWarranty ? "With warranty" : "No warranty"}
                        </dd>
                        {selectedCharger.supplierName && (
                          <>
                            <dt>Supplier</dt>
                            <dd>{selectedCharger.supplierName}</dd>
                          </>
                        )}
                      </dl>
                    </div>
                  )}

                      <div
                        className="form-group local-model-nav-actions"
                        style={{
                          marginTop: "0.75rem",
                          display: "flex",
                          justifyContent: "flex-start",
                          gap: "0.75rem",
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-secondary bill-select-battery-button"
                          onClick={() => setModelSubTab("battery")}
                        >
                          ← Back to battery
                        </button>
                      </div>
                </div>
              </div>
            )}

            <div
              className="bill-form-actions"
              style={{ justifyContent: "space-between", marginTop: "1rem" }}
            >
              {modelSubTab === "model" && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveTab("customer")}
                >
                  ← Back
                </button>
              )}
              {modelSubTab === "charger" ? (
                <>
                  <div style={{ minWidth: "160px" }} />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setActiveTab("payment")}
                  >
                    Go to Payment →
                  </button>
                </>
              ) : null}
            </div>
          </>
        )}

        {/* Tab 3: Payment Details */}
        {activeTab === "payment" && (
          <div className="form-section payment-section">
            <h3>Payment Details</h3>
            <div className="form-section-inner">
              {selectedModel && (
                <div
                  className="bill-model-price-info"
                  style={{
                    marginBottom: "1rem",
                    padding: "0.75rem 1rem",
                    background: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: "600",
                      color: "#0c4a6e",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Model selling price
                  </div>
                  <div style={{ fontSize: "0.95rem", color: "#075985" }}>
                    ₹
                    {modelSellingBatteryBreakdown.suggested.toLocaleString(
                      "en-IN"
                    )}
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
                    placeholder={
                      selectedModel &&
                      selectedModel.sellingPrice != null &&
                      selectedModel.sellingPrice !== ""
                        ? String(modelSellingBatteryBreakdown.suggested)
                        : "0"
                    }
                  />
                </div>
                <div className="form-group" style={{ flex: "1 1 160px" }}>
                  <label>Discount (₹)</label>
                  <input
                    type="text"
                    value={discount}
                    readOnly
                    className="readonly"
                    title="Auto: Selling price − (Amount paid + Old scooty price)"
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

              {paymentMode === "upi" && (
                <div className="bill-detail-card" style={{ marginTop: "1rem" }}>
                  <h4>Bank detail</h4>
                  <div className="payment-row" style={{ marginBottom: 0 }}>
                    <div className="form-group" style={{ flex: "1 1 100%" }}>
                      <label>Bank detail</label>
                      <input
                        type="text"
                        value={bankDetail}
                        onChange={(e) => setBankDetail(e.target.value)}
                        placeholder="Enter bank detail"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="old-scooty-section">
                <div className="old-scooty-section-header">
                  <span>Old scooty available</span>
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
                    </div>

                    {/* Battery subbox */}
                    <div className="old-scooty-subsection">
                      <div className="old-scooty-subsection-header">
                        Battery details
                      </div>
                      <div className="payment-row" style={{ marginBottom: 0 }}>
                        <div
                          className="form-group"
                          style={{ flex: "1 1 220px" }}
                        >
                          <label>With battery?</label>
                          <select
                            value={oldScootyWithBattery}
                            onChange={(e) =>
                              setOldScootyWithBattery(e.target.value)
                            }
                          >
                            <option value="no">No</option>
                            <option value="yes">Yes</option>
                          </select>
                        </div>
                        {oldScootyWithBattery === "yes" && (
                          <>
                            <div
                              className="form-group"
                              style={{ flex: "1 1 220px" }}
                            >
                              <label>Old scooty battery type</label>
                              <select
                                value={oldScootyBatteryType}
                                onChange={(e) =>
                                  setOldScootyBatteryType(e.target.value)
                                }
                              >
                                <option value="">— Select type —</option>
                                <option value="lead">Lead</option>
                                <option value="lithium">Lithium</option>
                              </select>
                            </div>
                            {oldScootyBatteryType === "lead" && (
                              <div
                                className="form-group"
                                style={{ flex: "1 1 220px" }}
                              >
                                <label>Number of batteries</label>
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={oldScootyBatteryCount}
                                  onChange={(e) =>
                                    setOldScootyBatteryCount(e.target.value)
                                  }
                                  placeholder="e.g. 4"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Charger subbox */}
                    <div className="old-scooty-subsection">
                      <div className="old-scooty-subsection-header">
                        Charger details
                      </div>
                      <div className="payment-row" style={{ marginBottom: 0 }}>
                        <div
                          className="form-group"
                          style={{ flex: "1 1 220px" }}
                        >
                          <label>With charger?</label>
                          <select
                            value={oldScootyWithCharger}
                            onChange={(e) =>
                              setOldScootyWithCharger(e.target.value)
                            }
                          >
                            <option value="no">No</option>
                            <option value="yes">Yes</option>
                          </select>
                        </div>
                        {oldScootyWithCharger === "yes" && (
                          <>
                            <div
                              className="form-group"
                              style={{ flex: "1 1 220px" }}
                            >
                              <label>Old scooty charger type</label>
                              <select
                                value={oldScootyChargerType}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setOldScootyChargerType(val);
                                  if (val !== "lead")
                                    setOldScootyChargerLeadVoltage("");
                                  if (val !== "lithium")
                                    setOldScootyChargerLithiumVoltage("");
                                }}
                              >
                                <option value="">— Select type —</option>
                                <option value="lead">Lead</option>
                                <option value="lithium">Lithium</option>
                              </select>
                            </div>
                            <div
                              className="form-group"
                              style={{ flex: "1 1 220px" }}
                            >
                              <label>Charger status</label>
                              <select
                                value={oldScootyChargerWorking}
                                onChange={(e) =>
                                  setOldScootyChargerWorking(e.target.value)
                                }
                              >
                                <option value="working">Working</option>
                                <option value="notWorking">Not working</option>
                              </select>
                            </div>
                            {oldScootyChargerType === "lead" && (
                              <div
                                className="form-group"
                                style={{ flex: "1 1 220px" }}
                              >
                                <label>Voltage (lead)</label>
                                <select
                                  value={oldScootyChargerLeadVoltage}
                                  onChange={(e) =>
                                    setOldScootyChargerLeadVoltage(
                                      e.target.value
                                    )
                                  }
                                >
                                  <option value="">— Select voltage —</option>
                                  <option value="48">48V</option>
                                  <option value="60">60V</option>
                                  <option value="72">72V</option>
                                </select>
                              </div>
                            )}
                            {oldScootyChargerType === "lithium" && (
                              <div
                                className="form-group"
                                style={{ flex: "1 1 220px" }}
                              >
                                <label>Custom voltage (lithium)</label>
                                <input
                                  type="text"
                                  value={oldScootyChargerLithiumVoltage}
                                  onChange={(e) =>
                                    setOldScootyChargerLithiumVoltage(
                                      e.target.value
                                    )
                                  }
                                  placeholder="e.g. 60V, 72V"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div
                className="form-group"
                style={{ position: "relative", maxWidth: "440px" }}
              >
                <label>
                  Any accessory included{" "}
                  <span className="text-muted" style={{ fontWeight: 400 }}>
                    (optional)
                  </span>
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
                        const suggestions = (data.suggestions || []).slice(
                          0,
                          3
                        );
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
                    if (
                      !showAccessorySuggestions ||
                      accessorySuggestions.length === 0
                    )
                      return;
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      setAccessorySelectedIndex((prev) => {
                        if (accessorySuggestions.length === 0) return -1;
                        if (prev === -1) return 0;
                        if (e.key === "ArrowDown") {
                          return prev >= accessorySuggestions.length - 1
                            ? 0
                            : prev + 1;
                        }
                        // ArrowUp
                        return prev <= 0
                          ? accessorySuggestions.length - 1
                          : prev - 1;
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
                {showAccessorySuggestions &&
                  accessorySuggestions.length > 0 && (
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
                                `${API}/spares?search=${encodeURIComponent(
                                  name
                                )}`
                              );
                              const data = await res.json();
                              if (
                                res.ok &&
                                Array.isArray(data) &&
                                data.length > 0
                              ) {
                                const spare = data[0];
                                setSelectedAccessories((prev) => {
                                  const exists = prev.some(
                                    (p) =>
                                      (p._id &&
                                        spare._id &&
                                        p._id === spare._id) ||
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
                              idx === accessorySelectedIndex
                                ? "#eff6ff"
                                : "white",
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
                              (p) => (p._id || p.name) !== (acc._id || acc.name)
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
              {error && (
                <p
                  className="bill-form-error"
                  role="alert"
                  style={{ marginBottom: "0.75rem" }}
                >
                  {error}
                </p>
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
