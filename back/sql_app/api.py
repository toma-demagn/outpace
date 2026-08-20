import datetime
import os
import random
from typing import List
from fastapi import Depends, FastAPI, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session, aliased
from sqlalchemy import select, func
from . import crud
from . import models
from . import schemas
from . import database
from haversine import haversine
from fastapi.middleware.cors import CORSMiddleware
from geopy.geocoders import Nominatim
import requests

from .schemas import ActivityInfo
from .utils import fetch_elevations, decode_polyline

app = FastAPI()

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

geolocator = Nominatim(user_agent="outpace")


def init_db():
    engine, _ = database.get_database_engine_and_session()
    models.Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}


def request_strava_token(payload):
    client_id = os.getenv("STRAVA_CLIENT_ID")
    client_secret = os.getenv("STRAVA_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Strava credentials are not configured")

    try:
        response = requests.post(
            "https://www.strava.com/api/v3/oauth/token",
            data={"client_id": client_id, "client_secret": client_secret, **payload},
            timeout=15,
        )
    except requests.RequestException as error:
        raise HTTPException(status_code=502, detail="Could not reach Strava") from error

    if not response.ok:
        raise HTTPException(status_code=response.status_code, detail="Strava rejected the token request")
    return response.json()


@app.post("/oauth/exchange")
def exchange_strava_code(exchange: schemas.OAuthCodeExchange):
    return request_strava_token({"code": exchange.code, "grant_type": "authorization_code"})


@app.post("/oauth/refresh")
def refresh_strava_token(refresh: schemas.OAuthRefresh):
    return request_strava_token({"refresh_token": refresh.refresh_token, "grant_type": "refresh_token"})


# Dependency
def get_db():
    _, SessionLocal = database.get_database_engine_and_session()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/register_token/", response_model=schemas.AthleteSLAT)
def register_token_token(token_registration: schemas.TokenRegistration, db: Session = Depends(get_db)):
    strava_id = token_registration.athlete.id
    db_refresh_token = crud.get_refresh_token_by_strava_id(db, strava_id=strava_id)
    if db_refresh_token:
        raise HTTPException(status_code=400, detail="Strava ID already registered")
    crud.create_refresh_token(db=db, strava_id=strava_id, read_activity=True,
                              refresh_token=token_registration.refresh_token)
    return crud.create_athlete_slat(db=db, token=token_registration.access_token, read_activity=True,
                                    strava_id=strava_id, expires_at=token_registration.expires_at)


@app.get("/refresh_token/{refresh_token_id}", response_model=schemas.RefreshToken)
def read_refresh_token(refresh_token_id: int, db: Session = Depends(get_db)):
    db_refresh_token = crud.get_refresh_token(db, refresh_token_id=refresh_token_id)
    if db_refresh_token is None:
        raise HTTPException(status_code=404, detail="Athlete not found")
    return db_refresh_token


@app.get("/refresh_token_strava/{strava_id}", response_model=schemas.RefreshToken)
def read_refresh_token_strava(strava_id: int, db: Session = Depends(get_db)):
    db_refresh_token = crud.get_refresh_token_by_strava_id(db, strava_id=strava_id)
    if db_refresh_token is None:
        raise HTTPException(status_code=404, detail="Athlete not found")
    return db_refresh_token


@app.get("/refresh_token/{strava_id}/AthleteSLAT/", response_model=schemas.AthleteSLATBase)
def read_AthleteSLAT(
        strava_id: int, db: Session = Depends(get_db)
):
    db_refresh_token = crud.get_refresh_token_by_strava_id(db, strava_id=strava_id)
    if db_refresh_token is None:
        raise HTTPException(status_code=404, detail="RefreshToken not found")
    return crud.get_athlete_slat(db=db, strava_id=strava_id)


@app.put("/refreshtoken/{strava_id}/AthleteSLAT/", response_model=schemas.AthleteSLATBase)
def update_token(
        strava_id: int, athlete_slat: schemas.AthleteSLATUpdate, db: Session = Depends(get_db)
):
    db_refresh_token = crud.get_refresh_token_by_strava_id(db, strava_id=strava_id)
    if db_refresh_token is None:
        raise HTTPException(status_code=404, detail="RefreshToken not found")
    print("is_ok")
    return crud.update_AthleteSLAT(db=db, strava_id=strava_id, athlete_slat=athlete_slat)


@app.put("/activities/{activity_id}/elevations/", response_model=schemas.Activity)
def add_altitudes_to_activity(
        activity_id: int, elevations: List[float], db: Session = Depends(get_db)
):
    return crud.add_elevations(db, activity_id=activity_id, elevations=elevations)


@app.post("/activities/", response_model=List[schemas.Activity])
def add_activities(activities: List[schemas.ActivityCreate], background_taks: BackgroundTasks,
                   db: Session = Depends(get_db)):
    db_activities = []
    for activity in activities:
        db_refresh_token = crud.get_refresh_token_by_strava_id(db, strava_id=activity.athlete.id)
        if db_refresh_token is None:
            raise HTTPException(status_code=404, detail="RefreshToken not found")
        db_activity = crud.get_activity(db, activity_id=activity.id)
        if not db_activity and activity.type in ["Run", "Ride", "Hike"] and len(activity.start_latlng) == 2 == len(
                activity.end_latlng) == 2:
            activity_cpy = schemas.ActivityBase(id=activity.id, strava_id=activity.athlete.id,
                                                total_elevation_gain=activity.total_elevation_gain,
                                                elapsed_time=activity.elapsed_time, name=activity.name,
                                                distance=activity.distance,
                                                start_latlng=activity.start_latlng, end_latlng=activity.end_latlng,
                                                start_date=activity.start_date,
                                                type=activity.type if activity.type != "Hike" else "Run",
                                                summary_polyline=activity.map.summary_polyline,
                                                pinned=None, elevations=None)
            db_activity = crud.create_activity(db, activity_cpy)
            db_activities.append(db_activity)
    db.commit()
    strava_id = db_activities[0].strava_id
    db_dash = crud.get_dashboard(db, strava_id)
    if db_dash is None:
        db_dash = crud.create_dashboard(db, strava_id)
    else:
        crud.update_dashboard(db, db_dash.id, False)
    background_taks.add_task(process_activities, activities=db_activities, dash_id=db_dash.id, db=db)
    return db_activities


@app.post("/activities/elevation/compute/{strava_id}")
def compute_elevation(strava_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_activities = crud.get_activities_by_strava_id(db, strava_id=strava_id)
    print("got the activities", len(db_activities))
    background_tasks.add_task(fetch_and_store_elevations, activities=db_activities, db=db)
    return {"message": "Elevations will be added"}


def fetch_and_store_elevations(activities, db: Session = Depends(get_db)):
    for activity in activities:
        if activity.summary_polyline is not None and (activity.elevations is None or len(activity.elevations) == 0):
            print("loading elevations for", activity.name)
            succ, elevations = fetch_elevations(decode_polyline(activity.summary_polyline))
            if succ:
                crud.add_elevations(db, activity.id, elevations)
                db.commit()
                print("added elevations for", activity.name)
            else:
                print("failed loading elevations for", activity.name)


@app.get("/activities/{strava_id}", response_model=List[schemas.Activity])
def read_activities(strava_id: int, exclude: List[int] = Query(None), db: Session = Depends(get_db)):
    activities = crud.get_activities_by_strava_id(db, strava_id, exclude)
    if activities is None:
        raise HTTPException(status_code=404, detail="Activities not found")
    return activities


@app.get("/activities/pinned/{strava_id}", response_model=List[schemas.Activity])
def read_pinned_activities(strava_id: int, db: Session = Depends(get_db)):
    activities = crud.get_pinned_activities_by_strava_id(db, strava_id)
    if activities is None:
        raise HTTPException(status_code=404, detail="Pinned activities not found")
    return activities


@app.get("/activities/elevation/{strava_id}/{elevation}", response_model=List[schemas.Activity])
def get_activities_with_elevation(strava_id: int, elevation: int, db: Session = Depends(get_db)):
    # Define the 'ordered_elevation' CTE
    ordered_elevation = select([
        models.Activity,
        func.sum(models.Activity.total_elevation_gain).over(
            order_by=(models.Activity.total_elevation_gain / models.Activity.distance).desc()).label('running_total')
    ]).where(models.Activity.strava_id == strava_id).cte('ordered_elevation')

    # Alias the CTE to use it in the next query
    OrderedElevation = aliased(ordered_elevation)

    # Define the 'minimal_set' CTE
    minimal_set = select([OrderedElevation]).select_from(OrderedElevation).where(
        OrderedElevation.c.running_total - OrderedElevation.c.total_elevation_gain < elevation).cte('minimal_set')

    # Alias the CTE to use it in the final query
    MinimalSet = aliased(minimal_set)

    # Define the final query
    final_query = select([
        MinimalSet
    ])

    # Execute the final query
    result = db.execute(final_query)

    # Fetch all results
    activities = result.fetchall()

    # Return the results as a list of dictionaries
    return [dict(row) for row in activities]


def is_trip(activities):
    limit = 3 if activities[0].type == 'Ride' else 2
    if len(activities) < 2:
        return False
    for i in range(1, len(activities)):
        start = activities[i].start_latlng
        end = activities[i].end_latlng
        prev_end = activities[i - 1].end_latlng
        start_date = activities[i].start_date
        end_date = activities[i - 1].start_date
        if haversine(start, prev_end) > 10 or (start_date - end_date).days > 7 or haversine(prev_end, end) < 6:
            return False
    return True


def find_trips(activities_filtered):
    activities_sorted = sorted(activities_filtered, key=lambda activity: activity.start_date)
    trips = []
    for i in range(len(activities_sorted)):
        for j in range(len(activities_sorted), i + 2, -1):
            trip = activities_sorted[i:j]
            if is_trip(trip) and not any(set(trip).issubset(set(larger_trip)) for larger_trip in trips):
                trips.append(trip)
                break
    return trips


def find_bike_trips(activities):
    activities_filtered = [activity for activity in activities if activity.distance > 65000]
    return find_trips(activities_filtered)


def find_hiking_trips(activities):
    activities_filtered = [activity for activity in activities if
                           (activity.distance > 10000 and activity.type != "Ride")]
    return find_trips(activities_filtered)


def process_activities(activities, dash_id, db: Session = Depends(get_db)):
    strava_id = activities[0].strava_id
    # handling the creating of trips
    trips = find_bike_trips(activities) + find_hiking_trips(activities)

    for trip in trips:
        start_location = geolocator.reverse(f"{trip[0].start_latlng[0]},{trip[0].start_latlng[1]}")
        start_address = start_location.raw['address']
        start_city = start_address.get("city", '')
        if start_city == '':
            start_city = start_address.get("country", 'France')
        end_location = geolocator.reverse(f"{trip[-1].end_latlng[0]},{trip[-1].end_latlng[1]}")
        end_address = end_location.raw['address']
        end_city = end_address.get("city", '')
        if end_city == '':
            end_city = end_address.get("country", 'France')
        crud.create_trip(db, schemas.TripCreate(strava_id=strava_id, start=start_city, end=end_city,
                                                activities_id=[act.id for act in trip]))

    crud.update_dashboard(db, dash_id, True)


@app.get("/dashboard/{strava_id}", response_model=schemas.DashboardShare)
def get_dashboard(strava_id: int, db: Session = Depends(get_db)):
    db_dash = crud.get_dashboard(db, strava_id)
    if db_dash is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return db_dash


@app.post("/profile/")
def update_dashboard_name(profile: schemas.ProfileCreate, db: Session = Depends(get_db)):
    name = f"{profile.firstname} {profile.lastname}"
    db_dash = crud.update_dashboard_name(db, profile.id, name)
    if db_dash is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return {"message": "Dashboard updated successfully"}


@app.get("/activities/last_date/{strava_id}", response_model=ActivityInfo)
def get_last_date(strava_id: int, db: Session = Depends(get_db)):
    token_obj = crud.get_athlete_slat(db, strava_id)
    tok = token_obj.token
    expires_in = token_obj.expires_at - int(datetime.datetime.now().timestamp())
    refresh_tok = crud.get_refresh_token_by_strava_id(db, strava_id).refresh_token
    last_date_row = crud.get_last_activity_timestamp_by_strava_id(db, strava_id)
    last_date = last_date_row[0] if last_date_row else None
    return ActivityInfo(token=tok, refresh_token=refresh_tok, last_date=last_date.timestamp(), expires_in=expires_in)


@app.put("/activities/pin/{activity_id}")
def pin_activity(activity_id: int, db: Session = Depends(get_db)):
    activity = crud.pin_activity(db=db, activity_id=activity_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    return {"message": "Activity pinned successfully"}


@app.put("/activities/unpin/{strava_id}")
def unpin_activities(strava_id: int, db: Session = Depends(get_db)):
    activities = crud.unpin_activities(db=db, strava_id=strava_id)
    if activities is None:
        raise HTTPException(status_code=404, detail="Activities not found")
    return {"message": "Activity unpinned successfully"}


@app.post("/trips/")
def create_trip(trip: schemas.TripCreate, db: Session = Depends(get_db)):
    return crud.create_trip(db=db, trip=trip)


@app.post("/trips/{trip_id}/activities/{activity_id}")
def add_activity(trip_id: int, activity_id: int, db: Session = Depends(get_db)):
    added_activity = crud.add_activity_to_trip(db=db, trip_id=trip_id, activity_id=activity_id)
    if added_activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    return {"message": "Activity added to trip successfully"}


@app.delete("/trips/{trip_id}/activities/{activity_id}")
def remove_activity(trip_id: int, activity_id: int, db: Session = Depends(get_db)):
    removed_activity = crud.remove_activity_from_trip(db=db, trip_id=trip_id, activity_id=activity_id)
    if removed_activity is None:
        raise HTTPException(status_code=404, detail="Activity not found")
    return {"message": "Activity removed successfully"}


@app.delete("/trips/{trip_id}")
def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    deleted_trip = crud.delete_trip(db=db, trip_id=trip_id)
    if deleted_trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"message": "Trip deleted successfully"}


@app.get("/trips/{strava_id}", response_model=List[schemas.Trip])
def read_trips_by_strava_id(strava_id: int, db: Session = Depends(get_db)):
    db_trips = crud.get_trips_by_strava_id(db, strava_id)
    for trip in db_trips:
        trip.activities.sort(key=lambda activity: activity.start_date)
    if not db_trips:
        raise HTTPException(status_code=404, detail="No trips found for this strava_id")
    return db_trips


@app.get("/trips/computation/{strava_id}")
def compute_trips(strava_id: int, db: Session = Depends(get_db)):
    db_activities = crud.get_activities_by_strava_id(db, strava_id)
    db_dash = crud.get_dashboard(db, strava_id)
    if not db_activities or not db_dash:
        raise HTTPException(status_code=404, detail="No activities or dashboard found for this strava_id")
    process_activities(db_activities, db_dash.id, db)
    return {"message": "Trips created successfully"}


@app.get("/activities/ranked/{strava_id}/{act_type}/{criteria}", response_model=List[schemas.ActivityBase])
def get_activity_ranked(strava_id: int, act_type, criteria, limit: int = Query(10, ge=1),
                        db: Session = Depends(get_db)):
    if criteria == "total_elevation_gain":
        ranking_criteria = models.Activity.total_elevation_gain
    elif criteria == "distance":
        ranking_criteria = models.Activity.distance
    else:
        raise HTTPException(status_code=420, detail="Invalid criteria")
    db_resp = (db.query(models.Activity).filter(models.Activity.strava_id == strava_id,
                                                models.Activity.type == act_type)
               .order_by(ranking_criteria.desc()).limit(limit))
    if not db_resp:
        raise HTTPException(status_code=404, detail="No activities found for this strava_id")
    return db_resp


@app.put("/dashboard/share/{strava_id}", response_model=schemas.DashboardShare)
def get_dashboard_token(strava_id: int, db: Session = Depends(get_db)):
    db_dash = crud.get_dashboard(db, strava_id)
    if db_dash is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if not db_dash.token:
        db_dash.token = gen_tok()
        db.commit()
    return db_dash


@app.put("/dashboard/unshare/{strava_id}")
def del_dashboard_token(strava_id: int, db: Session = Depends(get_db)):
    db_dash = crud.get_dashboard(db, strava_id)
    if db_dash is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if db_dash.token:
        db_dash.token = None
        db.commit()
    return {"message": "Token deleted successfully"}


@app.get("/dashboard/share/{token}", response_model=schemas.DashboardShare)
def get_dashboard_from_token(token: str, db: Session = Depends(get_db)):
    db_dash = crud.get_dashboard_by_token(db, token)
    if db_dash is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return db_dash


def gen_tok(length: int = 25):
    ords = list(range(65, 91)) + list(range(97, 122))
    chars = [chr(ords[random.randrange(len(ords))]) for i in range(length)]
    return ''.join(chars)
