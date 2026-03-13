import React from "react";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  // Employee Login (No Azure)
  const handleEmployeeLogin = () => {
    navigate("/employee");
  };

  // Security Login (No Azure)
  const handleSecurityLogin = () => {
    navigate("/security");
  };

  return (
    <div className="homepage d-flex flex-column text-dark">
      {/* Main Content */}
      <div className="d-flex flex-column align-items-start justify-content-start text-start px-5 pt-5">
        <p className="tagline mb-2">
          VISITOR MANAGEMENT SYSTEM - UD TRUCKS INDIA
        </p>

        {/* Heading + Logo side by side */}
        <div className="d-flex align-items-center mb-4">
          <button
            onClick={() => navigate("/")}
            className="border-0 bg-transparent p-0"
            style={{ cursor: "pointer" }}
          >
            <img
              src="/logo.png"
              alt="UD Trucks Logo"
              style={{ height: "60px", width: "auto" }}
              className="img-fluid"
            />
          </button>

          <h1 className="display-2 fw-bold mb-0 me-3 mx-3">
            Facilo
          </h1>
        </div>

        <div className="d-flex flex-column align-items-center gap-3">
          {/* Top row - 2 buttons */}
          <div className="d-flex gap-3">
            <button
              onClick={handleEmployeeLogin}
              className="btn btn-outline-light btn-lg w-100 py-3 text-dark border-dark"
            >
              EMPLOYEE LOGIN
            </button>

            <button
              onClick={handleSecurityLogin}
              className="btn btn-outline-light btn-lg w-100 py-3 text-dark border-dark"
            >
              SECURITY LOGIN
            </button>
          </div>

          <p className="tagline mb-2">
            Check-In to Check-Out. One Tap. Total Control
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="watermark text-center py-3 UD Redbg-opacity-50 mt-auto">
        <small>
          © {new Date().getFullYear()} UD Trucks | Facilo Portal
        </small>
      </footer>
    </div>
  );
}
