import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaUserTie, FaUserFriends } from "react-icons/fa";
import { useMsal } from "@azure/msal-react";

import Navbar from "./navbar";
import VisitorForm from "./VisitorForm";
import GuestForm from "./GuestForm";
import EmployeeProfileModal from "./EmployeeProfileModal";

export default function Employee() {
  const [activeForm, setActiveForm] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showProfile, setShowProfile] = useState(false);
  const [repeatDraft, setRepeatDraft] = useState(null);
  const { accounts } = useMsal();
  const currentAccount = Array.isArray(accounts) ? accounts[0] : null;
  const displayUserName =
    currentAccount?.name ||
    currentAccount?.username ||
    currentAccount?.localAccountId ||
    "Unknown User";

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const iconSize = isMobile ? 20 : 60;

  const forms = {
    visitor: (
      <VisitorForm
        isMobile={isMobile}
        setActiveForm={setActiveForm}
        repeatSeed={repeatDraft?.type === "visitor" && !Array.isArray(repeatDraft.data) ? repeatDraft.data : null}
        repeatBatch={repeatDraft?.type === "visitor" && Array.isArray(repeatDraft.data) ? repeatDraft.data : null}
        onRepeatSeedConsumed={() => setRepeatDraft(null)}
      />
    ),
    guest: (
      <GuestForm
        isMobile={isMobile}
        setActiveForm={setActiveForm}
        repeatSeed={repeatDraft?.type === "guest" && !Array.isArray(repeatDraft.data) ? repeatDraft.data : null}
        repeatBatch={repeatDraft?.type === "guest" && Array.isArray(repeatDraft.data) ? repeatDraft.data : null}
        onRepeatSeedConsumed={() => setRepeatDraft(null)}
      />
    ),
  };

  const services = [
    { id: "visitor", label: "Visitor", icon: <FaUserTie size={iconSize} className="me-2" /> },
    { id: "guest", label: "Guest", icon: <FaUserFriends size={iconSize} className="me-2" /> },
  ];

  return (
    <div className="service-page d-flex flex-column min-vh-200 text-dark">
      <Navbar
        profileAction={() => setShowProfile(true)}
        profileLabel="Profile"
        profileTooltip="Open previous visitors and guests for quick repeat"
        userName={displayUserName}
      />

      <EmployeeProfileModal
        show={showProfile}
        onClose={() => setShowProfile(false)}
        onRepeatSelect={(payload) => {
          setShowProfile(false);
          setRepeatDraft(payload);
          setActiveForm(payload.type);
        }}
        onRepeatMultiSelect={(payload) => {
          setShowProfile(false);
          setRepeatDraft(payload);
          setActiveForm(payload.type);
        }}
      />

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
                    onClick={() => {
                      setRepeatDraft(null);
                      setActiveForm(activeForm === id ? null : id);
                    }}
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
                  onClick={() => {
                    setRepeatDraft(null);
                    setActiveForm(activeForm === id ? null : id);
                  }}
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