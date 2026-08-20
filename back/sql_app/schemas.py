from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel


class RefreshTokenBase(BaseModel):
    strava_id: int
    refresh_token: str
    read_activity: bool


class RefreshTokenCreate(RefreshTokenBase):
    pass


class RefreshToken(RefreshTokenCreate):
    id: int

    class Config:
        from_attributes = True


class AthleteSLATBase(BaseModel):
    token: str
    read_activity: bool
    expires_at: int


class AthleteSLATCreate(AthleteSLATBase):
    pass


class AthleteSLAT(AthleteSLATBase):
    id: int
    strava_id: int

    class Config:
        from_attributes = True


class AthleteSLATUpdate(AthleteSLATBase):
    new_refresh_token: str


class AthleteBase(BaseModel):
    id: int


class TokenRegistration(BaseModel):
    access_token: str
    athlete: AthleteBase
    expires_at: int
    refresh_token: str
    token_type: str


class OAuthCodeExchange(BaseModel):
    code: str


class OAuthRefresh(BaseModel):
    refresh_token: str


class ActivityBase(BaseModel):
    id: int
    strava_id: int
    total_elevation_gain: float
    elapsed_time: int
    name: str
    distance: float
    start_latlng: List[float]
    end_latlng: List[float]
    start_date: datetime
    type: str
    summary_polyline: str
    pinned: Optional[bool]
    elevations: Optional[List[float]]


class ActivityInfo(BaseModel):
    token: str
    refresh_token: str
    last_date: int
    expires_in: int


class Map(BaseModel):
    id: str
    summary_polyline: str
    resource_state: int


class ActivityCreate(BaseModel):
    id: int
    total_elevation_gain: float
    athlete: AthleteBase
    elapsed_time: int
    name: str
    distance: float
    start_latlng: List[float]
    end_latlng: List[float]
    start_date: datetime
    type: str
    map: Optional[Map]


class Activity(ActivityBase):
    class Config:
        from_attributes = True


class TripBase(BaseModel):
    strava_id: int
    start: str
    end: str
    activities_id: List[int]


class TripCreate(TripBase):
    pass


class Trip(BaseModel):
    id: int
    start: str
    end: str
    activities: List[ActivityBase]

    class Config:
        from_attributes = True


class DashboardBase(BaseModel):
    strava_id: int
    name: str


class DashboardShare(DashboardBase):
    ready: bool
    token: Optional[str]
    name: Optional[str]


class ProfileCreate(BaseModel):
    id: int
    firstname: str
    lastname: str
