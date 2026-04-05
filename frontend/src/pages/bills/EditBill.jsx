import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import NewBill from "./NewBill";


import { API_BASE } from "../../config/api";
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
        const res = await fetch(`${API_BASE}/models?limit=500`);
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
        const res = await fetch(`${API_BASE}/bills/${id}`);
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
      const res = await fetch(`${API_BASE}/bills/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Failed to update bill");
      }
      alert("Bill updated successfully.");
      navigate(`/bills/all?billId=${encodeURIComponent(id)}`);
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
    <NewBill mode="edit" initialBill={bill} billId={id} />
  );
}
