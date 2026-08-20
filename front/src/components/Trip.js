import React, { useEffect, useState } from "react";
import { Map, GeoJson, Marker } from "pigeon-maps";
import { ReactComponent as MarkerIcon } from "../assets/flag-checkered-solid.svg";

import {
  centerZoomFromLocations,
  concatCoords,
  getGeoJsonContainingLatLng,
  includes,
  isPointInGeoJson,
  mapboxProvider,
  convertToKm,
  formatNumber,
  nameTrip,
  getExtremeLocations,
  getProvider,
} from "../utils/functions";
import { connect, useSelector } from "react-redux";
import { setZoomeds } from "../actions";
import { faStrava } from "@fortawesome/free-brands-svg-icons";
import { faLevelUpAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

var polyline = require("@mapbox/polyline");

const calculateDuration = (startDate, endDate, elapsed_time) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const duration = Math.ceil(
    ((end - start) / 1000 + elapsed_time) / (60 * 60 * 24),
  );
  return duration;
};

const colorSequence = [
  "rgba(0, 0, 255, 0.3)",
  "rgba(255,183,0,0.3)",
  "rgba(0, 255, 0, 0.3)",
  "rgba(255, 0, 0, 0.3)",
  "rgba(128, 0, 128, 0.3)",
];

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

function Trip({ trip, index, onButtonClick }) {
  const geoJson = useGeoJson();
  const zoomeds = useSelector((state) => state.zoomeds);
  const [update, setUpdate] = useState(0);
  // Don't try to use geoJson until it's defined
  if (!geoJson) {
    return <div>Loading...</div>;
  }
  const zoomed = zoomeds[index];
  console.log("zoomed", zoomed);
  const zoomInOut = zoomed ? "fas fa-search-minus" : "fas fa-search-plus";
  let coordinates = [];
  let totalDistance = 0;
  let totalElevationGain = 0;
  let geos = [];
  let combinedCoords = [];
  let ind = 0;
  trip.activities.forEach((activity) => {
    try {
      const activityCoordinates = polyline
        .decode(activity.summary_polyline)
        .map(([lng, lat]) => [lat, lng]);
      coordinates = [...coordinates, ...activityCoordinates];
      totalDistance += activity.distance;
      totalElevationGain += activity.total_elevation_gain;
      const start = activityCoordinates[0];
      const end = activityCoordinates[activityCoordinates.length - 1];
      let geoStart;
      let geoEnd;
      if (isPointInGeoJson(start[1], start[0], geoJson)) geoStart = geoJson;
      else {
        geoStart = getGeoJsonContainingLatLng(start[1], start[0]);
      }
      if (isPointInGeoJson(end[1], end[0], geoJson)) {
        geoEnd = geoJson;
      } else {
        geoEnd = getGeoJsonContainingLatLng(end[1], end[0]);
      }

      if (!includes(geos, geoStart)) {
        geos.push(geoStart);
        combinedCoords = [
          ...combinedCoords,
          ...getExtremeLocations(concatCoords(geoStart)),
        ];
        ind++;
      }
      if (!includes(geos, geoEnd)) {
        geos.push(geoEnd);
        combinedCoords = [
          ...combinedCoords,
          ...getExtremeLocations(concatCoords(geoEnd)),
        ];
        ind++;
      }
    } catch (error) {
      console.error(error);
    }
  });
  const mapWidth = window.innerWidth * 0.6;
  const mapHeight = window.innerHeight * 0.4;
  const centerZoom = centerZoomFromLocations(
    zoomed ? coordinates : combinedCoords,
    mapWidth,
    mapHeight,
  );
  const handleToggleClick = (event) => {
    event.stopPropagation();
    onButtonClick(index);
    setUpdate(update + 1);
  };

  const totalElevationGainDisplay = formatNumber(totalElevationGain);
  const totalDistanceDisplay = formatNumber(convertToKm(totalDistance));
  const duration = calculateDuration(
    trip.activities[0].start_date,
    trip.activities[trip.activities.length - 1].start_date,
    trip.activities[trip.activities.length - 1].elapsed_time,
  );
  return (
    <div className="trip-card-content">
      <div className="trip-copy">
        {/*<h2>Trip #{index + 1}</h2>*/}
        <h2>{nameTrip(trip)}</h2>
        <div className="trip-metrics">
          <p><strong>{duration}</strong><span>days</span></p>
          <p><strong>{totalDistanceDisplay}</strong><span>kilometres</span></p>
          <p><strong>{totalElevationGainDisplay}</strong><span>metres climbed <FontAwesomeIcon icon={faLevelUpAlt} /></span></p>
        </div>
      </div>
      <div className="trip-map">
        <Map
          width={mapWidth}
          height={mapHeight}
          center={[centerZoom.center[1], centerZoom.center[0]]}
          zoom={centerZoom.zoom}
          provider={getProvider()}
          twoFingerDrag={false}
          mouseEvents={false}
        >
          {geos?.length > 1 &&
            geos.map((geo, index) => (
              <GeoJson
                key={index}
                data={geo}
                styleCallback={() => ({
                  fill: colorSequence[index % colorSequence.length],
                })}
              />
            ))}
          <GeoJson
            data={{
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: {
                    type: "LineString",
                    coordinates,
                  },
                  properties: {
                    prop0: "value0",
                    prop1: 0.0,
                  },
                },
              ],
            }}
            styleCallback={(feature, hover) => {
              if (feature.geometry.type === "LineString") {
                return { strokeWidth: "2", stroke: "black" };
              }
              return {
                fill: "#d4e6ec99",
                strokeWidth: "1",
                stroke: "white",
                r: "20",
              };
            }}
          />

          {trip.activities.map((acti, index) => {
            if (index < trip.activities.length - 1 && zoomed) {
              return <Marker anchor={acti.end_latlng} title={acti.name} />;
            }
            if (index === trip.activities.length - 1 && !zoomed) {
              return (
                <Marker anchor={acti.end_latlng} title={acti.name}>
                  <MarkerIcon
                    className="imageFlag"
                    style={{ fill: "black", height: "1em", width: "1em" }}
                  />
                </Marker>
              );
            }
            return null;
          })}
        </Map>

        <button
          className="map-toggle"
          onClick={handleToggleClick}
          aria-label={zoomed ? "Zoom out" : "Zoom into route"}
        >
          <i className={zoomInOut}></i>
        </button>
      </div>
    </div>
  );
}

const mapDispatchToProps = {
  setZoomeds,
};

export default connect(null, mapDispatchToProps)(Trip);
