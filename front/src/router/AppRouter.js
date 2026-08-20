import React from "react";
import Home from "../pages/Home";
import StravaRedirect from "../pages/StravaRedirect";
import Navbar from "../components/Navbar";
import About from "../pages/About";
import NotFound from "../pages/NotFound";
import DBRedirect from "../pages/DBRedirect";
import { HashRouter, Route, Routes } from "react-router-dom";
import Dashboard from "../pages/Dashboard";
import Summary from "../pages/Summary";
import TripView from "../pages/TripView";
import DashboardRedirect from "../pages/DashboardRedirect";

class AppRouter extends React.Component {
  render() {
    return (
      <HashRouter>
        <Navbar />
        <div className="main">
          <Routes>
            <Route path="/" element={<Home />} exact={true} />
            <Route path="/redirect" element={<StravaRedirect />} />
            <Route path="/redirectDB" element={<DBRedirect />} />
            <Route path="/redirectDashboard" element={<DashboardRedirect />} />
            <Route
              path="/redirect/exchange_token"
              element={<StravaRedirect />}
            />
            <Route path="/summary" element={<Summary />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/trip_view" element={<TripView />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
      </HashRouter>
    );
  }
}
export default AppRouter;
