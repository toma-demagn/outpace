import React from "react";
import { Link } from "react-router-dom";
import { REACT_APP_DEMO_TOKEN } from "../utils/functions";

const Navbar = () => (
  <nav className="outpace-nav fixed-top">
    <div className="nav-inner">
      <Link className="wordmark" to="/" aria-label="Outpace home">
        <span className="wordmark-mark">O</span>
        <span>Outpace</span>
      </Link>
      <div className="nav-links">
        <Link to="/about">About</Link>
        <Link className="nav-demo-link" to={`/redirectDashboard?token=${REACT_APP_DEMO_TOKEN}`}>
          Open demo
        </Link>
      </div>
    </div>
  </nav>
);

export default Navbar;
