import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return String(dateString);
  return d.toLocaleDateString("en-GB");
}

function buildCustomerEditForm(customer, jobcards = []) {
  const warrantyJobcard = jobcards.find(
    (jobcard) => jobcard.warrantyType && jobcard.warrantyType !== "none",
  );
  const warrantyStatus =
    customer?.warrantyStatus === "warranty" || warrantyJobcard
      ? "warranty"
      : "none";

  return {
    name: customer?.name || "",
    place: customer?.place || "",
    mobile: customer?.mobile || customer?.phoneNumber || "",
    customerType: customer?.customerType || "green",
    warrantyStatus,
    warrantyDate: customer?.warrantyDate || warrantyJobcard?.warrantyDate || "",
    scootyModel:
      customer?.scootyModel ||
      jobcards.find((jobcard) => String(jobcard.ebikeDetails || "").trim())
        ?.ebikeDetails ||
      "",
  };
}

export default function Customers() {
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customerError, setCustomerError] = useState("");

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [form, setForm] = useState({
    name: "",
    place: "",
    mobile: "",
    customerType: "green",
    warrantyStatus: "none",
    warrantyDate: "",
    scootyModel: "",
  });
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const selectedCustomerId = selectedCustomer?._id || null;
  const selectedCustomerScootyModel =
    selectedCustomer?.scootyModel ||
    history.find((jobcard) => String(jobcard.ebikeDetails || "").trim())
      ?.ebikeDetails ||
    "";

  const selectedCustomerWarrantyJobcard = history.find(
    (jobcard) => jobcard.warrantyType && jobcard.warrantyType !== "none",
  );
  const selectedCustomerWarrantyStatus =
    selectedCustomer?.warrantyStatus === "warranty" ||
    selectedCustomerWarrantyJobcard
      ? "warranty"
      : "none";
  const selectedCustomerWarrantyDate =
    selectedCustomer?.warrantyDate ||
    selectedCustomerWarrantyJobcard?.warrantyDate ||
    "";

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
    const searchTimer = window.setTimeout(() => {
      fetchCustomers(search);
    }, 300);

    return () => window.clearTimeout(searchTimer);
    // fetchCustomers is intentionally called after the debounce for each search value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const customerFromQr = location.state?.editCustomer;
    const customerId = customerFromQr?.id || customerFromQr?._id;
    if (!customerId) return;

    setEditingCustomerId(customerId);
    setForm(buildCustomerEditForm(customerFromQr));
    setSaveMessage("");

    const loadCustomerForEditing = async () => {
      try {
        const response = await fetchWithRetry(
          `/customers/${customerId}/history`,
          { method: "GET" },
        );
        const data = await response.json();
        const customer = data?.customer;
        if (!customer?._id) return;
        setEditingCustomerId(customer._id);
        setForm(buildCustomerEditForm(customer, data?.jobcards || []));
        setSaveMessage("");
      } catch (error) {
        setCustomerError(error?.message || "Failed to load customer details.");
      }
    };

    loadCustomerForEditing();
  }, [location.state?.editCustomer]);

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
      customerType: form.customerType || "green",
      warrantyStatus: form.warrantyStatus || "none",
      warrantyDate: form.warrantyDate || "",
      scootyModel: String(form.scootyModel || "").trim(),
    };

    if (!payload.name || !payload.place || !payload.mobile) {
      setSaveMessage("Please fill name, place and mobile.");
      return;
    }

    try {
      setIsSaving(true);
      const isEditing = Boolean(editingCustomerId);
      const res = await fetchWithRetry(
        isEditing ? `/customers/${editingCustomerId}` : "/customers",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      setSaveMessage(
        isEditing
          ? "Customer updated successfully."
          : "Customer saved successfully.",
      );
      setForm({
        name: "",
        place: "",
        mobile: "",
        customerType: "green",
        warrantyStatus: "none",
        warrantyDate: "",
        scootyModel: "",
      });
      setEditingCustomerId(null);
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

  const startEditingCustomer = (customer) => {
    setEditingCustomerId(customer._id);
    setForm(buildCustomerEditForm(customer));
    setSaveMessage("");

    fetchWithRetry(`/customers/${customer._id}/history`, { method: "GET" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.customer) {
          setForm(buildCustomerEditForm(data.customer, data.jobcards || []));
        }
      })
      .catch(() => {});
  };

  const cancelEditingCustomer = () => {
    setEditingCustomerId(null);
    setForm({
      name: "",
      place: "",
      mobile: "",
      customerType: "green",
      warrantyStatus: "none",
      warrantyDate: "",
      scootyModel: "",
    });
    setSaveMessage("");
  };

  const returnToCustomerFound = () => {
    const returnToQr = location.state?.returnToQr;
    if (!returnToQr) return;
    sessionStorage.setItem("qr-return-result", JSON.stringify(returnToQr));
    navigate("/", { state: { returnToQr } });
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
          <h3>Add Customer</h3>
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
            <div className="customer-form-field">
              <label htmlFor="customer-category">Category</label>
              <select
                id="customer-category"
                value={form.customerType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, customerType: e.target.value }))
                }
              >
                <option value="green">Green</option>
                <option value="red">Red</option>
                <option value="black">Black</option>
              </select>
            </div>
            <div className="customer-form-field">
              <label htmlFor="customer-warranty-status">Warranty Status</label>
              <select
                id="customer-warranty-status"
                value={form.warrantyStatus}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    warrantyStatus: e.target.value,
                  }))
                }
              >
                <option value="none">No Warranty</option>
                <option value="warranty">Warranty</option>
              </select>
            </div>
            <div className="customer-form-field">
              <label htmlFor="customer-warranty-date">Warranty Date</label>
              <input
                id="customer-warranty-date"
                type="text"
                value={form.warrantyDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, warrantyDate: e.target.value }))
                }
                placeholder="Enter warranty date/code"
              />
            </div>
            <div className="customer-form-field">
              <label htmlFor="customer-scooty-model">Scooty Model</label>
              <input
                id="customer-scooty-model"
                type="text"
                value={form.scootyModel}
                onChange={(e) =>
                  setForm((p) => ({ ...p, scootyModel: e.target.value }))
                }
                placeholder="Enter scooty model"
              />
            </div>
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

      {editingCustomerId ? (
        <div
          role="presentation"
          onClick={cancelEditingCustomer}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backgroundColor: "rgba(15, 23, 42, 0.55)",
          }}
        >
          <form
            className="customer-form"
            onSubmit={onCreateOrUpdateCustomer}
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(100%, 32rem)", margin: 0 }}
          >
            <h3>Edit Customer</h3>
            <div className="customer-form-grid">
              <input
                type="text"
                placeholder="Customer name"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
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
              <div className="customer-form-field">
                <label htmlFor="edit-customer-category">Category</label>
                <select
                  id="edit-customer-category"
                  value={form.customerType}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, customerType: e.target.value }))
                  }
                >
                  <option value="green">Green</option>
                  <option value="red">Red</option>
                  <option value="black">Black</option>
                </select>
              </div>
              <div className="customer-form-field">
                <label htmlFor="edit-customer-warranty-status">
                  Warranty Status
                </label>
                <select
                  id="edit-customer-warranty-status"
                  value={form.warrantyStatus}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, warrantyStatus: e.target.value }))
                  }
                >
                  <option value="none">No Warranty</option>
                  <option value="warranty">Warranty</option>
                </select>
              </div>
              <div className="customer-form-field">
                <label htmlFor="edit-customer-warranty-date">
                  Warranty Date
                </label>
                <input
                  id="edit-customer-warranty-date"
                  type="text"
                  value={form.warrantyDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, warrantyDate: e.target.value }))
                  }
                  placeholder="Enter warranty date/code"
                />
              </div>
              <div className="customer-form-field">
                <label htmlFor="edit-customer-scooty-model">Scooty Model</label>
                <input
                  id="edit-customer-scooty-model"
                  type="text"
                  value={form.scootyModel}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, scootyModel: e.target.value }))
                  }
                  placeholder="Enter scooty model"
                />
              </div>
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Update Customer"}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={cancelEditingCustomer}
              disabled={isSaving}
            >
              Cancel
            </button>
            {location.state?.returnToQr ? (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={returnToCustomerFound}
                disabled={isSaving}
              >
                Back to Customer
              </button>
            ) : null}
            {saveMessage ? (
              <div className="customer-message">{saveMessage}</div>
            ) : null}
          </form>
        </div>
      ) : null}

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
                      className="btn btn-secondary btn-small"
                      onClick={() => startEditingCustomer(c)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => navigate(`/customer-card/${c._id}`)}
                      type="button"
                    >
                      View Details / Print QR
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
                      warrantyStatus: selectedCustomerWarrantyStatus,
                      warrantyDate: selectedCustomerWarrantyDate,
                      scootyModel: selectedCustomerScootyModel,
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
