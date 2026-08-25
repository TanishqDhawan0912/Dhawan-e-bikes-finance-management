import { useEffect, useMemo, useState } from "react";
import { fetchWithRetry } from "../config/api";

export const SERVICE_TIERS = [
  { key: 0, label: "1st Free Service", offsetDays: 10 },
  { key: 1, label: "2nd Free Service", offsetMonths: 4 },
  { key: 2, label: "3rd Free Service", offsetMonths: 10 },
];

function billDateToISO(billDate) {
  if (!billDate) return null;
  const s = String(billDate).trim();
  if (!s) return null;
  if (s.includes("-")) return s.slice(0, 10);
  if (s.includes("/")) {
    const parts = s.split("/");
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      if (!yyyy || !mm || !dd) return null;
      return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  return null;
}

function addToDate(isoDate, { offsetDays, offsetMonths }) {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  if (offsetMonths) d.setMonth(d.getMonth() + offsetMonths);
  return d;
}

export function formatDate(d) {
  if (!d) return "N/A";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getStatus(dueDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)}d`, tone: "overdue" };
  if (diffDays === 0) return { label: "Due today", tone: "today" };
  return { label: `In ${diffDays}d`, tone: "upcoming" };
}

/** Fetches bills and buckets pending customers per free-service tier, sorted soonest-due first. */
export function useCallingTiers() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadBills() {
      setLoading(true);
      setError("");
      try {
        const res = await fetchWithRetry("/bills");
        if (!res.ok) throw new Error("Failed to load bills");
        const data = await res.json();
        if (!cancelled) setBills(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load bills");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadBills();
    return () => {
      cancelled = true;
    };
  }, []);

  const tierLists = useMemo(() => {
    const lists = SERVICE_TIERS.map(() => []);
    for (const bill of bills) {
      const billDateISO = billDateToISO(bill.billDate);
      if (!billDateISO) continue;
      const services = Array.isArray(bill.services) ? bill.services : [];

      // A customer belongs to only their next pending service, not every unfinished one.
      for (let idx = 0; idx < SERVICE_TIERS.length; idx += 1) {
        const tier = SERVICE_TIERS[idx];
        const entry = services[idx];
        const alreadyDone = Boolean(entry && String(entry.date || "").trim());
        if (alreadyDone) continue;

        const dueDate = addToDate(billDateISO, tier);
        if (!dueDate) break;

        lists[idx].push({
          bill,
          dueDate,
          status: getStatus(dueDate),
        });
        break;
      }
    }

    lists.forEach((list) => list.sort((a, b) => a.dueDate - b.dueDate));
    return lists;
  }, [bills]);

  return { tierLists, loading, error };
}
