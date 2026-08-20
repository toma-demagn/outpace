import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faRoute } from "@fortawesome/free-solid-svg-icons";
import { REACT_APP_DEMO_TOKEN } from "../utils/functions";

const Home = () => {
  const navigate = useNavigate();

  const handleDemo = () => {
    navigate(`/redirectDashboard?token=${REACT_APP_DEMO_TOKEN}`);
  };

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-copy">
          <div className="eyebrow">
            <FontAwesomeIcon icon={faRoute} /> Your outdoor story
          </div>
          <h1>Every kilometre has a story.</h1>
          <p className="home-lead">
            Turn years of rides, runs and faraway journeys into one beautiful
            adventure archive.
          </p>
          <button className="primary-action" onClick={handleDemo}>
            Explore the demo
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
          <p className="home-note">Built from real activity and GPX exports. No login required.</p>
        </div>

        <div className="hero-visual" aria-label="A preview of the Outpace adventure dashboard">
          <div className="hero-map-card">
            <div className="hero-card-topline">
              <span>Alpine Roadtrip</span>
              <span className="hero-pill">8 stages</span>
            </div>
            <svg className="hero-route" viewBox="0 0 560 330" role="img" aria-label="Stylised mountain route">
              <path className="contour contour-one" d="M-10 245 C100 155 170 285 275 190 S460 115 580 205" />
              <path className="contour contour-two" d="M-20 275 C95 200 180 310 290 225 S475 150 590 235" />
              <path className="contour contour-three" d="M15 305 C130 235 210 335 320 265 S490 205 585 270" />
              <path className="route-line" d="M62 265 C105 240 118 185 168 194 C222 204 218 125 279 145 C341 165 350 83 410 105 C462 124 477 67 516 55" />
              <circle className="route-start" cx="62" cy="265" r="8" />
              <circle className="route-end" cx="516" cy="55" r="10" />
            </svg>
            <div className="hero-card-stats">
              <div><strong>836</strong><span>kilometres</span></div>
              <div><strong>20,070</strong><span>metres climbed</span></div>
              <div><strong>8</strong><span>days outside</span></div>
            </div>
          </div>
          <div className="floating-activity-card">
            <span className="activity-icon">↗</span>
            <div><strong>Schwarzwald Super</strong><span>263 km · 6,680 m</span></div>
          </div>
        </div>
      </section>

      <section className="home-proof" aria-label="Demo highlights">
        <div><strong>551</strong><span>activities</span></div>
        <div><strong>4</strong><span>epic journeys</span></div>
        <div><strong>25</strong><span>mapped stages</span></div>
        <p>One athlete’s archive, shaped into something worth revisiting.</p>
      </section>
    </main>
  );
};

export default Home;
