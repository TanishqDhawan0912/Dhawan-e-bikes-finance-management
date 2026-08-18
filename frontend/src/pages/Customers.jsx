import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithRetry } from "../config/api";

function formatMoney(value) {
  const amount = Number(value) || 0;
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return String(dateString);
  return d.toLocaleDateString("en-GB");
}

export default function Customers() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customerError, setCustomerError] = useState("");

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [form, setForm] = useState({ name: "", place: "", mobile: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const selectedCustomerId = selectedCustomer?._id || null;

  const getCustomerCardUrl = (customerId) => {
    const base = window.location.origin.replace(/\/$/, "");
    return `${base}/customer-card/${customerId}`;
  };

  const totalPending = useMemo(() => {
    return history.reduce(
      (sum, row) => sum + (Number(row.pendingAmount) || 0),
      0,
    );
  }, [history]);

  const fetchCustomers = async (searchText = "") => {
    try {
      setIsLoadingCustomers(true);
      setCustomerError("");
      const query = String(searchText || "").trim();
      const endpoint = query
        ? `/customers?search=${encodeURIComponent(query)}`
        : "/customers";
      const res = await fetchWithRetry(endpoint, { method: "GET" });
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      setCustomerError(error?.message || "Failed to load customers");
      setCustomers([]);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const fetchHistory = async (customerId) => {
    if (!customerId) return;
    try {
      setIsLoadingHistory(true);
      setHistoryError("");
      const res = await fetchWithRetry(`/customers/${customerId}/history`, {
        method: "GET",
      });
      const data = await res.json();
      setSelectedCustomer(data?.customer || null);
      setHistory(Array.isArray(data?.jobcards) ? data.jobcards : []);
    } catch (error) {
      setHistoryError(error?.message || "Failed to load customer history");
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const onSearchSubmit = (e) => {
    e.preventDefault();
    fetchCustomers(search);
  };

  const onCreateOrUpdateCustomer = async (e) => {
    e.preventDefault();
    setSaveMessage("");
    const payload = {
      name: String(form.name || "").trim(),
      place: String(form.place || "").trim(),
      mobile: String(form.mobile || "").trim(),
    };

    if (!payload.name || !payload.place || !payload.mobile) {
      setSaveMessage("Please fill name, place and mobile.");
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetchWithRetry("/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setSaveMessage("Customer saved successfully.");
      setForm({ name: "", place: "", mobile: "" });
      await fetchCustomers(search);
      if (data?.customer?._id) {
        await fetchHistory(data.customer._id);
      }
    } catch (error) {
      setSaveMessage(error?.message || "Failed to save customer.");
    } finally {
      setIsSaving(false);
    }
  };

  const copyCustomerCardUrl = async (customerId) => {
    try {
      const url = getCustomerCardUrl(customerId);
      await navigator.clipboard.writeText(url);
      setSaveMessage(
        "Customer QR link copied. Use this link to generate/print QR sticker.",
      );
    } catch (error) {
      setSaveMessage(
        "Could not copy link. Open QR Page and copy URL manually.",
      );
    }
  };

  return (
    <div className="page customers-page">
      <header className="page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Customers</h1>
            <p>
              Create customer records and view complete jobcard history by
              mobile number.
            </p>
          </div>
          <div className="header-right">
            <button
              className="btn btn-back-home"
              onClick={() => navigate("/")}
              title="Back to Home"
            >
              Home
            </button>
          </div>
        </div>
      </header>

      <section className="customer-actions-panel">
        <form className="customer-form" onSubmit={onCreateOrUpdateCustomer}>
          <h3>Add / Update Customer</h3>
          <div className="customer-form-grid">
            <input
              type="text"
              placeholder="Customer name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Place"
              value={form.place}
              onChange={(e) =>
                setForm((p) => ({ ...p, place: e.target.value }))
              }
            />
            <input
              type="text"
              placeholder="Mobile number"
              value={form.mobile}
              onChange={(e) =>
                setForm((p) => ({ ...p, mobile: e.target.value }))
              }
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Customer"}
          </button>
          {saveMessage ? (
            <div className="customer-message">{saveMessage}</div>
          ) : null}
        </form>

        <form className="customer-search" onSubmit={onSearchSubmit}>
          <h3>Search Customers</h3>
          <div className="customer-search-row">
            <input
              type="text"
              placeholder="Search by name, place, mobile"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="btn btn-secondary"
              type="submit"
              disabled={isLoadingCustomers}
            >
              {isLoadingCustomers ? "Searching..." : "Search"}
            </button>
          </div>
          {customerError ? (
            <div className="customer-error">{customerError}</div>
          ) : null}
        </form>
      </section>

      <div className="table-wrapper">
        <table className="simple-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Place</th>
              <th>Mobile</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr
                key={c._id}
                className={selectedCustomerId === c._id ? "active-row" : ""}
              >
                <td>{c.name}</td>
                <td>{c.place}</td>
                <td>{c.mobile}</td>
                <td>
                  <div className="customer-action-buttons">
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => fetchHistory(c._id)}
                      type="button"
                    >
                      View History
                    </button>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => navigate(`/customer-card/${c._id}`)}
                      type="button"
                    >
                      Generate / Print QR
                    </button>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => copyCustomerCardUrl(c._id)}
                      type="button"
                    >
                      Copy QR Link
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoadingCustomers && customers.length === 0 ? (
              <tr>
                <td colSpan={4}>No customers found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <section className="customer-history-panel">
        <div className="customer-history-header">
          <h3>
            {selectedCustomer
              ? `History: ${selectedCustomer.name} (${selectedCustomer.mobile})`
              : "Customer History"}
          </h3>
          <div className="customer-history-meta">
            {selectedCustomer ? (
              <>
                Total jobcards: {history.length} | Total pending:{" "}
                {formatMoney(totalPending)}
              </>
            ) : null}
          </div>
        </div>

        {selectedCustomer ? (
          <div className="customer-history-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() =>
                navigate("/jobcards/new", {
                  state: {
                    prefillCustomer: {
                      customerId: selectedCustomer._id,
                      customerName: selectedCustomer.name || "",
                      place: selectedCustomer.place || "",
                      mobile: selectedCustomer.mobile || "",
                    },
                  },
                })
              }
            >
              New Jobcard for This Customer
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => navigate(`/customer-card/${selectedCustomer._id}`)}
            >
              Open QR Profile Page
            </button>
          </div>
        ) : null}

        {historyError ? (
          <div className="customer-error">{historyError}</div>
        ) : null}
        {isLoadingHistory ? (
          <div className="customer-loading">Loading history...</div>
        ) : null}

        {!isLoadingHistory && history.length > 0 ? (
          <div className="table-wrapper">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Jobcard</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {history.map((j) => (
                  <tr key={j._id}>
                    <td>{j.jobcardNumber || "-"}</td>
                    <td>{formatDate(j.date)}</td>
                    <td>{j.jobcardType || "-"}</td>
                    <td>{j.status || "pending"}</td>
                    <td>{formatMoney(j.totalAmount)}</td>
                    <td>{formatMoney(j.pendingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoadingHistory && selectedCustomer && history.length === 0 ? (
          <div className="customer-loading">
            No jobcards found for this customer yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
