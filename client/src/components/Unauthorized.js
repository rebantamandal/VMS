import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
 
function Unauthorized() {
  const navigate = useNavigate();
 
  return (
    <div className="homepage d-flex flex-column text-dark" style={{ minHeight: "100vh" }}>
      {/* Main Content */}
      <div className="d-flex flex-column align-items-start justify-content-start text-start px-5 pt-5">
        <p className="tagline mb-2">VISITOR MANAGEMENT SYSTEM - INDIA</p>
 
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
          <h1 className="display-2 fw-bold mb-0 me-3 mx-3">Facilo</h1>
        </div>
 
        {/* Unauthorized Message */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mt-0"
        >
          <h2 className="fw-bold text-danger display-4">Access Denied</h2>
          <p className="fs-4 mt-3 mb-4">
            You’ve reached an unauthorized zone — <strong>and your badge doesn’t open this door.</strong>
          </p>
 
          {/* Back Button */}
          <button
            onClick={() => navigate("/")}
            className="btn btn-danger mt-4 px-5 py-2 rounded-3 fs-5"
          >
            Go Back Home
          </button>
        </motion.div>
      </div>
 
      {/* Footer */}
      <footer className="watermark text-center py-3 UD Redbg-opacity-50 mt-auto">
        <small>© {new Date().getFullYear()} UD Trucks | Facilo Portal</small>
      </footer>
    </div>
  );
}
 
export default Unauthorized;
 
 