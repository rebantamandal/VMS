import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaUserTie, FaUserFriends } from "react-icons/fa";

import Navbar from "./navbar";
import VisitorForm from "./VisitorForm";
import GuestForm from "./GuestForm";

export default function Employee() {
  const [activeForm, setActiveForm] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const iconSize = isMobile ? 20 : 60;

  const forms = {
    visitor: <VisitorForm isMobile={isMobile} setActiveForm={setActiveForm} />,
    guest: <GuestForm isMobile={isMobile} setActiveForm={setActiveForm} />,
  };

  const services = [
    { id: "visitor", label: "Visitor", icon: <FaUserTie size={iconSize} className="me-2" /> },
    { id: "guest", label: "Guest", icon: <FaUserFriends size={iconSize} className="me-2" /> },
  ];

  return (
    <div className="service-page d-flex flex-column min-vh-200 text-dark">
      <Navbar />

      <div className="flex-grow-1 container py-4">
        <motion.div
          className="text-center mb-4"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="display-4 fw-bold text-dark vms-title">
            Visitor Management System - UD Trucks India
          </h1>
          <p className="text-dark">Manage visitors & guests efficiently</p>
        </motion.div>

        {/* Desktop Layout */}
        {!isMobile && (
          <div className="d-flex flex-wrap gap-3 mx-5">
            <div className="flex-grow-1" style={{ minWidth: "280px"}}>
              <div className="service-grid mx-5">
                {services.map(({ id, label, icon }) => (
                  <motion.button
                    key={id}
                    className="service-btn"
                    onClick={() => setActiveForm(activeForm === id ? null : id)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {icon} {label}
                  </motion.button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {activeForm && forms[activeForm]}
            </AnimatePresence>
          </div>
        )}

        {/* Mobile Layout */}
        {isMobile && (
          <div className="d-flex flex-column gap-3">
            {services.map(({ id, label, icon }) => (
              <div key={id}>
                <motion.button
                  className="custom-btn d-flex align-items-center w-75"
                  onClick={() => setActiveForm(activeForm === id ? null : id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {icon} {label}
                </motion.button>

                <AnimatePresence>
                  {activeForm === id && forms[id]}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="watermark text-center py-3 text-light mt-auto">
        <small>© {new Date().getFullYear()} UD Trucks | Facilo Portal</small>
      </footer>
    </div>
  );
}