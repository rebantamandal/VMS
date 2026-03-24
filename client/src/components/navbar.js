import React from "react";
import { Link, useNavigate } from "react-router-dom";
import tt from "../images/logo.png";
import { FaSignOutAlt, FaFileExcel, FaUser } from "react-icons/fa";
import { motion } from "framer-motion";

// -----------------changed by rebanta--------------
// Removed useMsal import and MSAL account logic; added profileAction, profileLabel, profileTooltip, and userName props with default values
export default function Navbar({ exportToExcel, adhoc, profileAction, profileLabel = "Repeat Visitors", profileTooltip = "View repeat visitor and guest history", userName = "Security" }) {
// -------------------------------------------------
  const navigate = useNavigate();

  // -----------------changed by rebanta--------------
  // Replaced MSAL account-based auth (useMsal, accounts) with hardcoded isLoggedIn=true; simplified handleLogout from async/try-catch to synchronous
  // ✅ Force logged-in state
  const isLoggedIn = true;

  const handleLogout = () => {
    navigate("/");
  };
  // -------------------------------------------------

  return (
    <nav className="navbar navbar-expand-lg">
      <div className="container-fluid">
        <Link className="navbar-brand mx-2" to="/">
          <img
            src={tt}
            alt="UD Trucks Logo"
            className="img-fluid"
            style={{ maxHeight: "50px", width: "auto" }}
          />
        </Link>

        {/* -----------------changed by rebanta-------------- */}
        {/* Changed from ternary (isLoggedIn ? ... : SecurityLogin link) to && — removed "Security Login" fallback and "Welcome, {userName}" display span */}
        {/* ------------------------------------------------- */}
        {isLoggedIn && (
          <div className="d-flex align-items-center gap-2">
            {/* -----------------changed by rebanta-------------- */}
            {/* Replaced truthiness check (exportToExcel &&) with typeof function guard; removed boxShadow from whileHover */}
            {typeof exportToExcel === "function" && (
              <motion.button
                className="custom-btn d-flex align-items-center px-3 py-1"
                onClick={exportToExcel}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{ background: "linear-gradient(135deg, #28a745, #20c997)" }}
              >
                <FaFileExcel className="me-2" />
                Export to Excel
              </motion.button>
            )}
            {/* ------------------------------------------------- */}

            {/* -----------------changed by rebanta-------------- */}
            {/* Replaced truthiness check (adhoc &&) with typeof function guard; removed boxShadow from whileHover */}
            {typeof adhoc === "function" && (
              <motion.button
                className="custom-btn d-flex align-items-center px-3 py-1"
                onClick={adhoc}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FaUser className="me-2" />
                Ad-hoc
              </motion.button>
            )}
            {/* ------------------------------------------------- */}

            {/* -----------------changed by rebanta-------------- */}
            {/* New: profile/repeat visitors button with avatar initials derived from userName and gold gradient styling */}
            {typeof profileAction === "function" && (
              <motion.button
                onClick={profileAction}
                whileHover={{ scale: 1.03, boxShadow: "0 0 0 2px #D8B200" }}
                whileTap={{ scale: 0.97 }}
                title={profileTooltip}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "linear-gradient(135deg, #D8B200, #F08C00)",
                  border: "none",
                  borderRadius: "50px",
                  padding: "5px 14px 5px 6px",
                  cursor: "pointer",
                  transition: "box-shadow 0.2s",
                }}
              >
                {/* Avatar circle */}
                <span style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#111",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#D8B200",
                  fontWeight: 800,
                  fontSize: "0.8rem",
                  flexShrink: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}>
                  {(() => {
                    const parts = (userName || "U").trim().split(/\s+/);
                    return parts.length > 1
                      ? parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
                      : parts[0].charAt(0);
                  })()}
                </span>
                {/* Name */}
                <span style={{
                  color: "#111",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  whiteSpace: "nowrap",
                  maxWidth: "140px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {userName || "Profile"}
                </span>
              </motion.button>
            )}
            {/* ------------------------------------------------- */}

            {typeof profileAction !== "function" && userName && userName !== "Security" && (
              <span style={{ color: "#1e293b", fontWeight: 600, fontSize: "0.88rem", whiteSpace: "nowrap" }}>
                Welcome, {userName.split(" ")[0]}
              </span>
            )}

            {/* -----------------changed by rebanta-------------- */}
            {/* Removed boxShadow from whileHover on Home/logout button */}
            <motion.button
              className="custom-btn d-flex align-items-center px-3 py-1"
              onClick={handleLogout}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaSignOutAlt className="me-2" />
              Home
            </motion.button>
            {/* ------------------------------------------------- */}
          </div>
        )}
      </div>
    </nav>
  );
}
