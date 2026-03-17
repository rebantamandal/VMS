import React from "react";
import { Link, useNavigate } from "react-router-dom";
import tt from "../images/logo.png";
import { FaSignOutAlt, FaFileExcel, FaUser } from "react-icons/fa";
import { motion } from "framer-motion";

export default function Navbar({ exportToExcel, adhoc, profileAction, profileLabel = "Repeat Visitors", profileTooltip = "View repeat visitor and guest history", userName = "Security" }) {
  const navigate = useNavigate();

  // ✅ Force logged-in state
  const isLoggedIn = true;

  const handleLogout = () => {
    navigate("/");
  };

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

        {isLoggedIn && (
          <div className="d-flex align-items-center gap-2">
            <span className="text-dark fw-semibold me-2">
              Welcome, {userName}
            </span>

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

            {typeof profileAction === "function" && (
              <motion.button
                className="custom-btn d-flex align-items-center px-3 py-1"
                onClick={profileAction}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={profileTooltip}
                style={{
                  background: "linear-gradient(135deg, #D8B200, #F08C00)",
                  color: "#111",
                }}
              >
                <FaUser className="me-2" />
                {profileLabel}
              </motion.button>
            )}

            <motion.button
              className="custom-btn d-flex align-items-center px-3 py-1"
              onClick={handleLogout}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaSignOutAlt className="me-2" />
              Home
            </motion.button>
          </div>
        )}
      </div>
    </nav>
  );
}
