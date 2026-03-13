import './App.css';
import {
  BrowserRouter as Router,
  Routes,
  Route
} from "react-router-dom";

import Home from './components/home';
import Security from './components/security';
import Employee from './components/employee';
import Adhoc from './components/Adhoc';
import Unauthorized from './components/Unauthorized';

function App() {
  console.log("🚀 App Component Loaded");

  return (
    <Router>
      <div className="container5">
        <Routes>

          {/* Public Route */}
          <Route path="/" element={<Home />} />

          {/* Employee Route */}
          <Route path="/employee" element={<Employee />} />

          {/* Security Route */}
          <Route path="/security" element={<Security />} />

          {/* Adhoc Route */}
          <Route path="/adhoc" element={<Adhoc />} />

          {/* Unauthorized (optional) */}
          <Route path="/unauthorized" element={<Unauthorized />} />

        </Routes>
      </div>
    </Router>
  );
}

export default App;
