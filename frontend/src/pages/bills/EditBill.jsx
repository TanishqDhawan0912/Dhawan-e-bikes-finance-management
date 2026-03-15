import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API = "http://localhost:5000/api";

export default function EditBill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [models, setModels] = useState([]);

  const [customerName, setCustomerName] = useState("");
  const [billDate, setBillDate] = useState("");
  const [mobile, setMobile] = useState("");
  const [billNo, setBillNo] = useState("");
  const [address, setAddress] = useState("");
  const [modelPurchased, setModelPurchased] = useState("");
  const [descriptionVariant, setDescriptionVariant] = useState("");
  const [modelColor, setModelColor] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/models?limit=500`);
        if (res.ok) {
          const data = await res.json();
          setModels(Array.isArray(data) ? data : []);
        }
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/bills/${id}`);
        if (!res.ok) throw new Error("Bill not found");
        const data = await res.json();
        if (cancelled) return;
        setBill(data);
        setCustomerName(data.customerName || "");
        setBillDate(data.billDate || "");
        setMobile(data.mobile || "");
        setBillNo(data.billNo || "");
        setAddress(data.address || "");
        setModelPurchased(data.modelPurchased || "");
        setDescriptionVariant(data.descriptionVariant || "");
        setModelColor(data.modelColor || "");
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load bill");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!id || !bill) return;
    setError("");
    if (!customerName.trim()) {
      setError("Customer Name is required.");
      return;
    }
    if (!billDate.trim()) {
      setError("Bill Date is required.");
      return;
    }
    if (!mobile.trim()) {
      setError("Mobile No. is required.");
      return;
    }
    if (!billNo.trim()) {
      setError("Bill No. is required.");
      return;
    }
    if (!modelPurchased.trim()) {
      setError("Model Purchased is required.");
      return;
    }
    if (!modelColor.trim()) {
      setError("Model Color is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        billNo: billNo.trim(),
        billDate: billDate.trim(),
        customerName: customerName.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        modelPurchased: modelPurchased.trim(),
        descriptionVariant: descriptionVariant.trim(),
        modelColor: modelColor.trim(),
      };
      const res = await fetch(`${API}/bills/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Failed to update bill");
      }
      alert("Bill updated successfully.");
      navigate("/bills/all");
    } catch (err) {
      setError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return (
      <div className="page-content">
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>Edit Bill</h1>
        <p style={{ color: "#6b7280", fontSize: "0.95rem", marginBottom: "1rem" }}>
          Select a bill from the list to edit.
        </p>
        <button
          type="button"
          onClick={() => navigate("/bills/all")}
          style={{
            padding: "0.5rem 1rem",
            cursor: "pointer",
            borderRadius: "0.375rem",
            border: "1px solid #3b82f6",
            backgroundColor: "#3b82f6",
            color: "white",
            fontWeight: 500,
          }}
        >
          Go to All Bills
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ textAlign: "center", padding: "2rem" }}>Loading bill...</div>
      </div>
    );
  }

  if (error && !bill) {
    return (
      <div className="page-content">
        <p style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</p>
        <button
          type="button"
          onClick={() => navigate("/bills/all")}
          style={{
            padding: "0.5rem 1rem",
            cursor: "pointer",
            borderRadius: "0.375rem",
            border: "1px solid #d1d5db",
            backgroundColor: "#fff",
            color: "#374151",
            fontWeight: 500,
          }}
        >
          Back to All Bills
        </button>
      </div>
    );
  }

  return (
    <div className="page-content">
      <form onSubmit={handleSubmit} style={{ maxWidth: "720px" }}>
        {error && <p style={{ color: "#dc2626", fontSize: "0.875rem", marginBottom: "1rem" }}>{error}</p>}

        <div className="bills-form-section">
          <h2 className="bills-form-section-title">Customer & Bill Details</h2>
          <div className="bills-form-grid">
            <div className="bills-form-group">
              <label className="bills-form-label">Customer Name <span className="required">*</span></label>
              <input type="text" className="bills-form-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="bills-form-group">
              <label className="bills-form-label">Bill Date <span className="required">*</span></label>
              <input type="text" className="bills-form-input" value={billDate} onChange={(e) => setBillDate(e.target.value)} placeholder="e.g. 26/02/2026" />
            </div>
            <div className="bills-form-group">
              <label className="bills-form-label">Mobile No. <span className="required">*</span></label>
              <input type="text" className="bills-form-input" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
            <div className="bills-form-group">
              <label className="bills-form-label">Bill No. <span className="required">*</span></label>
              <input type="text" className="bills-form-input" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
            </div>
            <div className="bills-form-group full-width">
              <label className="bills-form-label">Address</label>
              <textarea className="bills-form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" style={{ minHeight: "84px", resize: "vertical" }} />
            </div>
          </div>
        </div>

        <div className="bills-form-section">
          <h2 className="bills-form-section-title">Model Details</h2>
          <div className="bills-form-grid">
            <div className="bills-form-group">
              <label className="bills-form-label">Model Purchased <span className="required">*</span></label>
              <input type="text" className="bills-form-input" value={modelPurchased} onChange={(e) => setModelPurchased(e.target.value)} placeholder="e.g. Single Light (Evey)" />
            </div>
            <div className="bills-form-group">
              <label className="bills-form-label">Description Variant</label>
              <select className="bills-form-input" value={descriptionVariant} onChange={(e) => setDescriptionVariant(e.target.value)} style={{ appearance: "auto" }}>
                <option value="">Select description</option>
                {models.map((m) => (
                  <option key={m._id} value={m.modelName}>{m.modelName}{m.company ? ` (${m.company})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="bills-form-group">
              <label className="bills-form-label">Model Color <span className="required">*</span></label>
              <input type="text" className="bills-form-input" value={modelColor} onChange={(e) => setModelColor(e.target.value)} placeholder="e.g. black" />
            </div>
          </div>
        </div>

        <div className="bills-form-actions">
          <button type="submit" className="bills-btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
          <button type="button" className="bills-btn-secondary" onClick={() => navigate("/bills/all")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
