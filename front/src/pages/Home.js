import React from "react";
import loginImage from "../assets/login.png";
import manLogo from "../assets/man.png";
import roadLogo from "../assets/road.png";

import {
  getStravaId,
  REACT_APP_CLIENT_ID, REACT_APP_DEMO_TOKEN,
  REACT_APP_WEB_URL,
} from "../utils/functions";
import { useNavigate } from "react-router-dom";
import { connect } from "react-redux";
import { setExternal, setUserId } from "../actions";
import {faStrava} from "@fortawesome/free-brands-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

const URL = `${REACT_APP_WEB_URL}/redirect`;

const scope = "read,activity:read_all";

const Home = (props) => {
  const navigate = useNavigate();

  const handleLogin = () => {
    var strava_id = getStravaId;
    var goToAuth = false;
    //strava_id = undefined;
    if (strava_id === undefined) {
      console.log("strava_id is not set.");
      goToAuth = true;
    } else {
      console.log("strava_id is set with the value: " + strava_id);
    }
    if (goToAuth) {
      window.location = `https://www.strava.com/oauth/authorize?client_id=${REACT_APP_CLIENT_ID}&response_type=code&redirect_uri=${URL}/exchange_token&approval_prompt=force&scope=${scope}`;
    } else {
      props.setUserId(strava_id);
      props.setExternal(false);
      navigate("/redirectDB");
    }
  };

  function handleDemo() {
    navigate(`/redirectDashboard?token=${REACT_APP_DEMO_TOKEN}`);
  }

  return (
    <div className="d-flex justify-content-center align-items-center text-center content-body">
      <div className="mt-5">
        <div class="row">
          <div class="column">
            <img src={manLogo} style={{ width: "10em" }}></img>
          </div>
          <div class="column">
            <img src={roadLogo} style={{ width: "10em" }}></img>
          </div>
        </div>
        <h2 className="bold-poppins-small mt-3 mb-3">
          Create your athlete CV !
        </h2>

        <button
          className="homeButtonStyle"
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "grey")}
          onMouseOut={(e) =>
            (e.currentTarget.style.backgroundColor = "lightgrey")
          }
          onClick={handleLogin}
        >
          Connect with Strava ! <FontAwesomeIcon icon={faStrava} style={{ color: "#ee5535" }} />
        </button>
        <button
          className="homeButtonStyle"
          onClick={handleDemo}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "grey")}
          onMouseOut={(e) =>
            (e.currentTarget.style.backgroundColor = "lightgrey")
          }
        >
          See a demo !
        </button>
      </div>
    </div>
  );
};

export default connect(null, {
  setUserId,
  setExternal,
})(Home);
