import {
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";
import BillsSidebar from "../components/BillsSidebar";
import NewBill from "./bills/NewBill";
import EditBill from "./bills/EditBill";
import AllBills from "./bills/AllBills";

export default function Bills() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname;
    const segments = path.split("/").filter(Boolean);

    if (segments.length > 3) {
      const cleanPath = `/${segments[0]}/${segments[1]}/${segments[2]}`;
      navigate(cleanPath, { replace: true });
      return;
    }

    if (path === "/bills" || path.endsWith("/bills/")) {
      navigate("/bills/new", { replace: true });
    }
  }, [location.pathname, navigate]);

  if (
    location.pathname === "/bills" ||
    location.pathname.endsWith("/bills/") ||
    location.pathname.split("/").filter(Boolean).length > 3
  ) {
    return <div className="loading">Loading...</div>;
  }

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes("/bills/new")) return "New Bill";
    if (path.includes("/bills/edit")) return "Edit Bill";
    if (path.includes("/bills/all")) return "All Bills";
    return "Bills";
  };

  return (
    <div className="bills-layout">
      <BillsSidebar />
      <main className="bills-content">
        <header className="content-header">
          <div className="header-content">
            <div className="header-left">
              <h1>{getPageTitle()}</h1>
              <p>
                {getPageTitle() === "All Bills"
                  ? "Review finalized bills with customer, payment and exchange details."
                  : "Manage bills for new scooty sales"}
              </p>
            </div>
            <div className="header-right">
              <button
                className="btn btn-back-home"
                onClick={() => navigate("/")}
                title="Back to Home"
              >
                🏠 Home
              </button>
            </div>
          </div>
        </header>
        <div className="content-area">
          <Routes>
            <Route path="new" element={<NewBill />} />
            <Route path="edit" element={<EditBill />} />
            <Route path="all" element={<AllBills />} />
            <Route index element={<Navigate to="new" replace />} />
            <Route path="*" element={<Navigate to="new" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
