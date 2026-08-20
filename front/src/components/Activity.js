import React, { useEffect, useState } from "react";
import { Map, Marker, GeoJson } from "pigeon-maps";
import {
  addElevationsToActivity,
  centerZoomFromLocations, computeColorFromGrad,
  convertToKm,
  formatDate,
  formatNumber,
  formatTime, geoJsonFromActivity, geoColorFromGeo,
  getProvider,
} from "../utils/functions";
import { addAltitudeToGeoJson } from "../utils/ElevationComputation";
import haversine from 'haversine-distance'

const polyline = require("@mapbox/polyline");



function Activity({ activity }) {
  const [geoWithElevations, setGeoWithElevations] = useState(null);
  let coordinates = [];
  coordinates = polyline
    .decode(activity.summary_polyline)
    .map(([lng, lat]) => [lat, lng]);
  const {addElevations, actJson} = geoJsonFromActivity(activity, coordinates);
  useEffect(() => {
    const fetchAltitudes = async () => {
      const result = await addAltitudeToGeoJson(actJson); //loading the altitudes from an external API
      setGeoWithElevations(result);
      await addElevationsToActivity(activity.id, result); //storing the altitudes in DB for saving API requests
    };
    if (!addElevations && !geoWithElevations) {
      fetchAltitudes().then((r) => console.log("altitudes fetched", r));
    }
  }, [actJson, activity.id, addElevations, geoWithElevations]);


  // if elevations were stored in db, we set them in the geoJsonWithElevations
  const displayedGeo = geoWithElevations ?? (addElevations ? actJson : null);

  const mapWidth = window.innerWidth * 0.35;
  const mapHeight = window.innerHeight * 0.45;
  const { center, zoom } = centerZoomFromLocations(
    coordinates,
    mapWidth,
    mapHeight,
  );
  if (!displayedGeo) {
    return getMapWithNoColorDiv();
  }
  const geoJsonWithColors = geoColorFromGeo(displayedGeo);

  function getMapWithColorDiv() {
    return (
      <div className="row">
        <div className="column33">
          <h3>{activity.name}</h3>
          <p>
            Total Elevation Gain:{" "}
            {formatNumber(activity["total_elevation_gain"])}m
          </p>
          <p>Elapsed Time: {formatTime(activity.elapsed_time)}</p>
          <p>Distance: {formatNumber(convertToKm(activity.distance))}km</p>
          <p>Type: {activity.type}</p>
          <p>Start Date: {formatDate(activity.start_date)}</p>
        </div>
        <div className="column66">
          <Map
            width={mapWidth}
            height={mapHeight}
            defaultCenter={[center[1], center[0]]}
            defaultZoom={zoom}
            provider={getProvider()}
          >
            <GeoJson
              data={geoJsonWithColors}
              styleCallback={(feature, hover) => {
                if (feature.geometry.type === "LineString") {
                  return {
                    strokeWidth: "2",
                    stroke: feature.properties.stroke,
                  };
                }
                return {
                  fill: "#d4e6ec99",
                  strokeWidth: "1",
                  stroke: "white",
                  r: "20",
                };
              }}
            />
          </Map>
        </div>
      </div>
    );
  }
  function getMapWithNoColorDiv() {
    return (
      <div className="row">
        <div className="column33">
          <h3>{activity.name}</h3>
          <p>
            Total Elevation Gain:{" "}
            {formatNumber(activity["total_elevation_gain"])}m
          </p>
          <p>Elapsed Time: {formatTime(activity.elapsed_time)}</p>
          <p>Distance: {formatNumber(convertToKm(activity.distance))}km</p>
          <p>Type: {activity.type}</p>
          <p>Start Date: {formatDate(activity.start_date)}</p>
        </div>
        <div className="column66">
          <Map
            width={mapWidth}
            height={mapHeight}
            defaultCenter={[center[1], center[0]]}
            defaultZoom={zoom}
            provider={getProvider()}
          >
            <GeoJson
              data={actJson}
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
          </Map>
        </div>
      </div>
    );
  }

  return getMapWithColorDiv();
}
export default Activity;
