import React from "react";
import _ from "lodash";
import { connect, useSelector } from "react-redux";
import {
  setUserId,
  setUserTrips,
  setDistanceRides,
  setUserActivities,
  setPinnedActivities,
  setExternal,
} from "../actions";
import Loading from "../components/Loading";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  getPinnedActivities,
  getRankedActivities,
  getUserActivitiesFromDB,
  getUserTripsFromDB,
} from "../utils/functions";

const { REACT_APP_CLIENT_ID, REACT_APP_WEB_URL } = process.env;

const URL = `${REACT_APP_WEB_URL}/redirect`;

const scope = "read,activity:read_all";

const DBRedirect = (props) => {
  const userID = useSelector((state) => state.userId);
  const externalOrigin = useSelector((state) => state.externalOrigin);
  const location = useLocation();
  const navigate = useNavigate();
  let userTrips;
  let rankedActivities = [];
  let countryVals;
  let activities;
  let pinnedActivities;
  let rankedRidesDist;
  let rankedRidesElev;
  let rankedRunsDist;
  let rankedRunsElev;

  useEffect(() => {
    const fetch = async () => {
      try {
        // If not redirected to Strava, return to home
        if (_.isEmpty(location)) {
          return navigate("/");
        }
        userTrips = await getUserTripsFromDB(userID);
        pinnedActivities = await getPinnedActivities(userID);
        rankedRidesDist = await getRankedActivities(userID, "Ride", "distance");
        rankedRidesElev = await getRankedActivities(
          userID,
          "Ride",
          "total_elevation_gain",
        );
        rankedRunsDist = await getRankedActivities(userID, "Run", "distance");
        rankedRunsElev = await getRankedActivities(
          userID,
          "Run",
          "total_elevation_gain",
        );
        rankedActivities.push({
          type: "Ride",
          crit: "distance",
          activities: rankedRidesDist,
        });
        rankedActivities.push({
          type: "Ride",
          crit: "total_elevation_gain",
          activities: rankedRidesElev,
        });
        rankedActivities.push({
          type: "Run",
          crit: "distance",
          activities: rankedRunsDist,
        });
        rankedActivities.push({
          type: "Run",
          crit: "total_elevation_gain",
          activities: rankedRunsElev,
        });
        activities = await getUserActivitiesFromDB(userID);

        console.log("ranked activities", rankedActivities);
      } catch (error) {
        console.log(props);
        console.log(error.stack);
        //If error, go back home
        window.location = `https://www.strava.com/oauth/authorize?client_id=${REACT_APP_CLIENT_ID}&response_type=code&redirect_uri=${URL}/exchange_token&approval_prompt=force&scope=${scope}`;
      }
    };
    fetch().then((r) => {
      if (rankedRidesDist === undefined || rankedRidesDist.length === 0) {
        console.log("here");
        window.location = `https://www.strava.com/oauth/authorize?client_id=${REACT_APP_CLIENT_ID}&response_type=code&redirect_uri=${URL}/exchange_token&approval_prompt=force&scope=${scope}`;
      } else {
        console.log("there");
        props.setExternal(externalOrigin ?? null);
        props.setUserTrips(userTrips ?? []);
        props.setPinnedActivities(pinnedActivities ?? []);
        props.setUserActivities(activities ?? []);
        props.setDistanceRides(rankedActivities ?? []);
        navigate("/dashboard");
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
  setUserActivities,
  setExternal,
})(DBRedirect);
