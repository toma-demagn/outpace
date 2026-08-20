import React from "react";
import _ from "lodash";
import { connect } from "react-redux";
import {
  setUsersummary,
  setUserId,
  setUserTrips,
  setDistanceRides,
  setUserActivities,
  setPinnedActivities,
  setUserName,
  setExternal,
} from "../actions";
import Loading from "../components/Loading";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  fetchCountryValsFromDB,
  getPinnedActivities,
  getRankedActivities,
  getDashboardFromToken,
  getStravaId,
  getUserActivitiesFromDB,
  getUserTripsFromDB,
  getParamValues,
} from "../utils/functions";
import { getStaticDemo, STATIC_DEMO_TOKEN } from "../utils/demo";

const { REACT_APP_CLIENT_ID, REACT_APP_WEB_URL } = process.env;

const URL = `${REACT_APP_WEB_URL}/redirect`;

const scope = "read,activity:read_all";

const DBRedirect = (props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const vals = getParamValues(window.location.href);
  console.log("Vals", vals);
  const token = vals.token;
  let userID;
  let userName;

  useEffect(() => {
    const fetch = async () => {
      try {
        if (token === STATIC_DEMO_TOKEN) {
          const demo = await getStaticDemo();
          props.setUserId(demo.profile.id);
          props.setUserName(demo.profile.name);
          props.setExternal(true);
          props.setUserActivities(demo.activities);
          props.setUsersummary(demo.activities);
          props.setUserTrips(demo.trips);
          props.setPinnedActivities(demo.pinned_activities);
          props.setDistanceRides(demo.rankings);
          navigate("/dashboard");
          return;
        }
        const dbData = await getDashboardFromToken(token);
        userID = dbData.strava_id;
        userName = dbData["name"];
      } catch (error) {
        console.log(props);
        console.log(error.stack);
        //If error, go back home
        //navigate('/redirect');
      }
    };
    fetch().then((r) => {
      if (token === STATIC_DEMO_TOKEN) {
        return;
      }
      if (!userID) {
        navigate("/");
      } else {
        props.setUserId(userID);
        props.setUserName(userName);
        props.setExternal(true);
        navigate("/redirectDB");
      }
    });
  }, []);

  return (
    <div>
      <Loading text={"Rides loading."} />
    </div>
  );
};

export default connect(null, {
  setUserId,
  setUserTrips,
  setDistanceRides,
  setPinnedActivities,
  setUserName,
  setExternal,
  setUsersummary,
  setUserActivities,
})(DBRedirect);
