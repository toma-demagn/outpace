import React, { useEffect, useState } from "react";
import { GeoJson, Map } from "pigeon-maps";
import {
  centerZoomFromLocations,
  concatCoords,
  getExtremeLocations,
  getGeoJsonContainingLatLng,
  getProvider,
  index,
  isPointInGeoJson,
} from "../utils/functions";
import polyline from "@mapbox/polyline";
import Activities from "./Activities";
import {
  Checkbox,
  Dialog,
  DialogContent,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Select,
} from "@mui/material";
import { faBiking, faRunning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

function useGeoJson() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("quebec.geojson")
      .then((response) => response.json())
      .then((jsonData) => setData(jsonData))
      .catch((error) => console.error(error));
  }, []);

  return data;
}

function rankingAlpha(activities, index) {
  const maxim = Math.max.apply(
    null,
    activities.map((ids) => ids.length),
  );
  return Math.sqrt(0.1 + 0.8 * (activities[index].length / maxim));
}

function WorldMap({ activities, name }) {
  const geoJsonQuebec = useGeoJson();
  const [countryActivitiesOpen, setCountriesActivitiesOpen] = useState(false);
  const [currentOpenActivity, setCurrentOpenActivities] = useState(null);
  const [filters, setFilters] = useState({ running: true, cycling: true });
  const [distanceFilter, setDistanceFilter] = useState(0); // Default: no distance filter

  const handleClickOpen = (activities) => {
    setFilters({ running: true, cycling: true });
    setDistanceFilter(0); // Reset distance filter when dialog is opened
    setCountriesActivitiesOpen(true);
    setCurrentOpenActivities(activities);
  };

  const handleCloseOpenActivity = () => {
    setCountriesActivitiesOpen(false);
  };

  const handleFilterChange = (event) => {
    const { name, checked } = event.target;
    setFilters((prevFilters) => ({ ...prevFilters, [name]: checked }));
  };

  const handleDistanceFilterChange = (event) => {
    setDistanceFilter(Number(event.target.value));
  };

  const distanceFilterText =
    distanceFilter === 0 ? "0 - ∞" : `0 - ${distanceFilter} km`;

  const filteredActivities = currentOpenActivity?.filter((activity) => {
    const matchesType =
      (filters.running && activity.type === "Run") ||
      (filters.cycling && activity.type === "Ride");
    const matchesDistance =
      distanceFilter === 0 || activity.distance / 1000 >= distanceFilter;
    return matchesType && matchesDistance;
  });
  console.log("filtered activities", filteredActivities);

  const routeActivities = (activities ?? []).filter(
    (activity) => activity.summary_polyline,
  );

  if (routeActivities.length === 0) {
    return (
      <section className="dashboard-section worldmap-section">
        <div className="section-heading"><span className="section-index">02</span><div><span className="section-kicker">Across the map</span><h2>Everywhere you've moved.</h2></div></div>
        <p>Route map and multi-day trips will appear after the GPX import.</p>
      </section>
    );
  }

  // Don't try to use geoJson until it's defined
  if (!geoJsonQuebec) {
    return <div>Loading...</div>;
  }
  const mapWidth = window.innerWidth * 0.8;
  const mapHeight = mapWidth / 1.5;
  let geos = [];
  let combinedCoords = [];
  let activitiesInEachCountry = [];
  routeActivities.forEach((activity) => {
    try {
      const activityCoordinates = polyline
        .decode(activity.summary_polyline)
        .map(([lng, lat]) => [lat, lng]);
      const start = activityCoordinates[0];
      let geoStart;
      if (isPointInGeoJson(start[1], start[0], geoJsonQuebec))
        geoStart = geoJsonQuebec;
      else {
        geoStart = getGeoJsonContainingLatLng(start[1], start[0]);
      }
      const ind = index(geos, geoStart);
      if (ind === -1) {
        geos.push(geoStart);
        combinedCoords = [
          ...combinedCoords,
          ...getExtremeLocations(concatCoords(geoStart)),
        ];
        activitiesInEachCountry.push([activity]); // Store the activity ID in a new sub-array
      } else {
        activitiesInEachCountry[ind].push(activity); // Add the activity ID to the existing sub-array
      }
    } catch (error) {
      console.error(error);
    }
  });
  console.log("geos", geos);
  console.log("activityIds", activitiesInEachCountry); // Log the activity IDs
  const { center, zoom } = centerZoomFromLocations(
    combinedCoords,
    mapWidth,
    mapHeight,
  );

  return (
    <section className="dashboard-section worldmap-section">
      <div className="section-heading">
        <span className="section-index">02</span>
        <div><span className="section-kicker">Across the map</span><h2>Everywhere you've moved.</h2><p>Choose a country to explore its activities.</p></div>
      </div>
      <div className="world-map-frame">
      <Dialog
        open={countryActivitiesOpen}
        onClose={handleCloseOpenActivity}
        fullWidth={true}
        maxWidth="md"
        PaperProps={{
          style: { maxHeight: "80vh" },
        }}
      >
        <DialogContent>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={filters.running}
                  onChange={handleFilterChange}
                  name="running"
                />
              }
              label={
                <span>
                  <FontAwesomeIcon
                    icon={faRunning}
                    style={{ marginRight: "0.5em" }}
                  />
                </span>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={filters.cycling}
                  onChange={handleFilterChange}
                  name="cycling"
                />
              }
              label={
                <span>
                  <FontAwesomeIcon
                    icon={faBiking}
                    style={{ marginRight: "0.5em" }}
                  />
                </span>
              }
            />
            <Select
              value={distanceFilter}
              onChange={handleDistanceFilterChange}
              displayEmpty
              style={{ width: "150px" }}
              renderValue={() =>
                distanceFilter === 0 ? "0 - 9999km" : `≥${distanceFilter}km`
              }
            >
              <MenuItem value={0}>All distances</MenuItem>
              <MenuItem value={10}>≥10km</MenuItem>
              <MenuItem value={20}>≥20km</MenuItem>
              <MenuItem value={50}>≥50km</MenuItem>
              <MenuItem value={100}>≥100km</MenuItem>
              <MenuItem value={200}>≥200km</MenuItem>
            </Select>
          </FormGroup>
          <Activities activities={filteredActivities} />
        </DialogContent>
      </Dialog>

      <Map
        width={mapWidth}
        height={mapHeight}
        defaultCenter={[center[1], center[0]]}
        defaultZoom={zoom}
        provider={getProvider(true)}
        twoFingerDrag={false}
        mouseEvents={false}
      >
        {geos?.map((geo, index) => (
          <GeoJson
            key={index} // Adding a key here forces the GeoJson to re-render when the filtered activities change
            data={geo}
            onClick={() => {
              console.log(
                "the activities",
                activitiesInEachCountry[index].map((activity) => activity.name),
              );
              handleClickOpen(activitiesInEachCountry[index]);
            }}
            styleCallback={() => ({
              fill: `rgba(255, 0, 0, ${rankingAlpha(activitiesInEachCountry, index)})`,
            })}
          />
        ))}
      </Map>
      </div>
    </section>
  );
}

export default WorldMap;
