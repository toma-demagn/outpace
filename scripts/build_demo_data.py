#!/usr/bin/env python3
"""Convert a StatsHunters XLSX export into Outpace's static demo format."""

import argparse
import json
import math
import re
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime
from pathlib import Path


SPREADSHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
RELATIONSHIP_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


def column_index(reference):
    letters = re.match(r"[A-Z]+", reference).group(0)
    result = 0
    for letter in letters:
        result = result * 26 + ord(letter) - ord("A") + 1
    return result - 1


def read_workbook(path):
    namespace = {"x": SPREADSHEET_NS}
    with zipfile.ZipFile(path) as workbook:
        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
        relationship_targets = {}
        relationships_path = "xl/worksheets/_rels/sheet1.xml.rels"
        if relationships_path in workbook.namelist():
            relationships = ET.fromstring(workbook.read(relationships_path))
            relationship_targets = {
                relationship.attrib["Id"]: relationship.attrib["Target"]
                for relationship in relationships.findall(f"{{{RELATIONSHIP_NS}}}Relationship")
            }

        links = {}
        for link in sheet.findall(".//x:hyperlinks/x:hyperlink", namespace):
            relationship_id = link.attrib.get(
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            )
            if relationship_id in relationship_targets:
                links[link.attrib["ref"]] = relationship_targets[relationship_id]

        rows = []
        for row in sheet.findall(".//x:sheetData/x:row", namespace):
            values = {}
            for cell in row.findall("x:c", namespace):
                value = cell.find("x:v", namespace)
                values[column_index(cell.attrib["r"])] = (
                    value.text if value is not None and value.text is not None else ""
                )
            rows.append((int(row.attrib["r"]), values))

    headers = rows[0][1]
    records = []
    for row_number, values in rows[1:]:
        record = {header: values.get(index, "") for index, header in headers.items()}
        record["_url"] = links.get(f"B{row_number}", "")
        record["_row"] = row_number
        records.append(record)
    return records


def as_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def normalized_type(source_type):
    if "Ride" in source_type or source_type == "MountainBikeRid":
        return "Ride"
    if source_type in {"Run", "TrailRun", "Hike"}:
        return "Run"
    return None


def activity_id(record):
    match = re.search(r"/activities/(\d+)", record["_url"])
    return int(match.group(1)) if match else record["_row"]


def haversine(first, second):
    lat1, lon1 = map(math.radians, first[:2])
    lat2, lon2 = map(math.radians, second[:2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6_371_000 * 2 * math.asin(math.sqrt(value))


def encode_polyline(points):
    output = []
    previous_latitude = 0
    previous_longitude = 0
    for latitude, longitude, *_ in points:
        latitude = round(latitude * 100_000)
        longitude = round(longitude * 100_000)
        for value in (latitude - previous_latitude, longitude - previous_longitude):
            value = ~(value << 1) if value < 0 else value << 1
            while value >= 0x20:
                output.append(chr((0x20 | (value & 0x1F)) + 63))
                value >>= 5
            output.append(chr(value + 63))
        previous_latitude = latitude
        previous_longitude = longitude
    return "".join(output)


def sampled(points, limit=800):
    if len(points) <= limit:
        return points
    indexes = {round(index * (len(points) - 1) / (limit - 1)) for index in range(limit)}
    return [point for index, point in enumerate(points) if index in indexes]


def parse_gpx(path):
    root = ET.parse(path).getroot()
    name = root.findtext(".//{*}trk/{*}name") or path.stem.replace("_", " ")
    source_type = root.findtext(".//{*}trk/{*}type") or "cycling"
    points = []
    times = []
    for trackpoint in root.findall(".//{*}trkpt"):
        elevation = as_float(trackpoint.findtext("{*}ele"))
        points.append((float(trackpoint.attrib["lat"]), float(trackpoint.attrib["lon"]), elevation))
        timestamp = trackpoint.findtext("{*}time")
        if timestamp:
            times.append(timestamp)
    if len(points) < 2:
        raise ValueError(f"GPX file has fewer than two track points: {path}")

    selected = sampled(points)
    distance = sum(haversine(first, second) for first, second in zip(points, points[1:]))
    elevation_gain = sum(max(0, second[2] - first[2]) for first, second in zip(points, points[1:]))
    start_time = times[0] if times else "1970-01-01T00:00:00Z"
    end_time = times[-1] if times else start_time
    elapsed_time = int(
        (datetime.fromisoformat(end_time.replace("Z", "+00:00")) -
         datetime.fromisoformat(start_time.replace("Z", "+00:00"))).total_seconds()
    )
    return {
        "name": name,
        "source_type": source_type,
        "distance": distance,
        "total_elevation_gain": elevation_gain,
        "elapsed_time": elapsed_time,
        "start_date": start_time,
        "start_latlng": list(points[0][:2]),
        "end_latlng": list(points[-1][:2]),
        "summary_polyline": encode_polyline(selected),
        "elevations": [point[2] for point in selected],
    }


def add_gpx_trips(demo, directories):
    trip_names = {
        "trip1": "Alpine Roadtrip",
        "trip2": "Transpyrénéenne",
        "trip3": "Zurich to Vienna",
        "trip4": "Narbonne to Barcelona",
    }
    activities_by_name_and_date = {
        (activity["name"].casefold(), activity["start_date"][:10]): activity
        for activity in demo["activities"]
    }

    trips = []
    for trip_id, directory in enumerate(directories, start=1):
        stages = []
        for path in sorted(directory.glob("*.gpx")):
            gpx = parse_gpx(path)
            match = activities_by_name_and_date.get((gpx["name"].casefold(), gpx["start_date"][:10]))
            if match is None:
                match = {
                    "id": 9_000_000 + trip_id * 100 + len(stages),
                    "strava_id": 0,
                    "type": "Ride" if "cycl" in gpx["source_type"].lower() else "Run",
                    "pinned": False,
                }
                demo["activities"].append(match)
            match.update(gpx)
            stages.append(match)

        stages.sort(key=lambda activity: activity["start_date"])
        if stages:
            trips.append(
                {
                    "id": trip_id,
                    "name": trip_names.get(directory.name, directory.name.replace("_", " ").title()),
                    "start": stages[0]["name"],
                    "end": stages[-1]["name"],
                    "activities": stages,
                }
            )
    demo["trips"] = trips
    return demo


def add_pinned_activities(demo, directory):
    activities_by_name_and_date = {
        (activity["name"].casefold(), activity["start_date"][:10]): activity
        for activity in demo["activities"]
    }
    pinned = []
    if directory:
        for path in sorted(directory.glob("*.gpx")):
            gpx = parse_gpx(path)
            match = activities_by_name_and_date.get((gpx["name"].casefold(), gpx["start_date"][:10]))
            if match is None:
                match = {
                    "id": 9_100_000 + len(pinned),
                    "strava_id": 0,
                    "type": "Ride" if "cycl" in gpx["source_type"].lower() else "Run",
                }
                demo["activities"].append(match)
            match.update(gpx)
            match["pinned"] = True
            pinned.append(match)
    demo["pinned_activities"] = sorted(
        pinned, key=lambda activity: activity["start_date"], reverse=True
    )
    return demo


def convert(records):
    activities = []
    for record in records:
        activity_type = normalized_type(record.get("Type", ""))
        if not activity_type:
            continue

        latitude = as_float(record.get("Start Lat"))
        longitude = as_float(record.get("Start Long"))
        start = [latitude, longitude] if latitude or longitude else []
        start_date = datetime.strptime(record["Date"], "%Y-%m-%d %H:%M:%S").isoformat()
        activities.append(
            {
                "id": activity_id(record),
                "strava_id": 0,
                "name": record.get("Name") or "Untitled activity",
                "type": activity_type,
                "source_type": record.get("Type"),
                "distance": as_float(record.get("Distance (m)")),
                "total_elevation_gain": as_float(record.get("Elevation (m)")),
                "elapsed_time": int(as_float(record.get("Elapsed time"))),
                "start_date": start_date,
                "start_latlng": start,
                "end_latlng": start,
                "summary_polyline": None,
                "pinned": False,
                "elevations": None,
            }
        )

    rankings = []
    for activity_type in ("Ride", "Run"):
        matching = [activity for activity in activities if activity["type"] == activity_type]
        for criterion in ("distance", "total_elevation_gain"):
            rankings.append(
                {
                    "type": activity_type,
                    "crit": criterion,
                    "activities": sorted(
                        matching, key=lambda activity: activity[criterion], reverse=True
                    )[:10],
                }
            )

    return {
        "version": 1,
        "profile": {"id": 0, "name": "Thomas"},
        "source": {"kind": "StatsHunters XLSX", "activity_count": len(records)},
        "activities": activities,
        "rankings": rankings,
        "pinned_activities": [],
        "trips": [],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--gpx-dir", action="append", default=[], type=Path)
    parser.add_argument("--pinned-dir", type=Path)
    args = parser.parse_args()

    demo = convert(read_workbook(args.input))
    add_gpx_trips(demo, args.gpx_dir)
    add_pinned_activities(demo, args.pinned_dir)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(demo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Wrote {len(demo['activities'])} running/cycling activities, "
        f"{len(demo['trips'])} GPX trips, and {len(demo['pinned_activities'])} "
        f"pinned activities to {args.output}"
    )


if __name__ == "__main__":
    main()
