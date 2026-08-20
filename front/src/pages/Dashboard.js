import React, { useEffect, useRef, useState } from "react";
import { connect, useSelector } from "react-redux";
import Modal from "react-modal";
import {
  fetchNewActivities,
  postUserActivities,
  getUserActivitiesFromDB,
  pinActivity,
  unpinActivities,
  nameTrip,
  formatNumber,
  convertToKm,
  shortenText,
  putDashboardToken,
  getDashboardURL,
} from "../utils/functions";
import { useNavigate } from "react-router-dom";
import {
  setAltitudes,
  setExternal,
  setTripActivities,
  setTripName,
  setUserActivities,
  setUsersummary,
  setUserTrips,
  setZoomeds,
} from "../actions";
import Trip from "../components/Trip";
import ActivityForRanking from "../components/ActivityForRanking";
import styled from "styled-components";
import { faStrava } from "@fortawesome/free-brands-svg-icons";
import {
  faPlus,
  faArrowLeft,
  faArrowRight,
  faRunning,
  faBicycle,
  faCheck,
  faLevelUpAlt,
  faSadCry,
  faThumbTack,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBan } from "@fortawesome/free-solid-svg-icons";
import WorldMap from "../components/WorldMap";
import { ToastContainer, toast, Slide } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Fab from "@mui/material/Fab";
import ShareIcon from "@mui/icons-material/Share";
import { Dialog, DialogContent } from "@mui/material";
import Activity from "../components/Activity";

const LeftArrowButton = styled.button`
  position: absolute;
  transform: translateY(130%) translateX(30%);
  background-color: rgba(211, 211, 211, 0.75);
  border: none;
  border-radius: 5px;
  width: 5em;
  height: 5em;

  &:hover {
    background-color: rgba(128, 128, 128, 0.75);
  }
`;
const RightArrowButton = styled.button`
  position: absolute;
  transform: translateY(130%) translateX(-30%);
  background-color: rgba(211, 211, 211, 0.75);
  border: none;
  border-radius: 5px;
  width: 5em;
  height: 5em;

  &:hover {
    background-color: rgba(128, 128, 128, 0.75);
  }
`;

const Dashboard = (props) => {
  const trips = useSelector((state) => state.userTrips);
  const zoomeds = useSelector((state) => state.zoomeds) ?? [];
  const external = useSelector((state) => state.externalOrigin);
  const userName = useSelector((state) => state.userName);
  const athleteName = userName || "Demo athlete";
  const possessiveName = external ? `${athleteName}'s` : "Your";
  const pinnedActivities = useSelector((state) => state.pinnedActivities);
  const rankedActivities = useSelector((state) => state.distanceRides);
  const strava_id = useSelector((state) => state.userId);
  const userActivities = useSelector((state) => state.userActivities);
  const navigate = useNavigate();
  const scrollContainerRef = React.useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    props.setZoomeds(new Array(trips.length).fill(false));
  }, [trips.length]);

  useEffect(() => {
    const checkOverflow = () => {
      const { scrollWidth, clientWidth } = scrollContainerRef.current;
      setIsOverflowing(scrollWidth > clientWidth);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);

    return () => window.removeEventListener("resize", checkOverflow);
  }, []);

  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    if (external) {
      setActivities(userActivities ?? []);
      return;
    }
    getUserActivitiesFromDB(
      strava_id,
      pinnedActivities.map((activity) => activity.id),
    ).then(setActivities);
  }, [external, pinnedActivities, strava_id, userActivities]);

  async function addToPinnedActivity(id) {
    const data = await pinActivity(id);
    if (data) {
      navigate("/redirectDB");
    }
  }

  async function removePinnedActivities() {
    const data = await unpinActivities(strava_id);
    return data;
  }

  const openModal = () => {
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
  };

  const handleButtonClick = () => {
    fetchNewActivities(strava_id).then(async (activities) => {
      console.log("les activités", activities);
      if (activities.data.length > 0) {
        await postUserActivities(activities);
        props.setUsersummary(activities.data);
        navigate("/summary");
      } else {
        console.log("No new activities");
        toast.info("No new activities to add", {
          position: "bottom-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "light",
          transition: Slide,
        });
      }
    });
  };

  const handleShareClick = async () => {
    putDashboardToken(strava_id).then(async (dashboard) => {
      console.log("dash", dashboard);
      if (dashboard && dashboard.token) {
        await navigator.clipboard.writeText(getDashboardURL(dashboard.token));
        toast.info(
          <>
            <FontAwesomeIcon icon={faCheck} />
            Link copied to clipboard
          </>,
          {
            position: "top-center",
            autoClose: 1000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            transition: Slide,
          },
        );
      } else {
        toast.error(
          <>
            <FontAwesomeIcon icon={faSadCry} />
            There was a problem with your share link
          </>,
          {
            position: "top-center",
            autoClose: 1000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            transition: Slide,
          },
        );
      }
    });
  };

  const handleTripToggleButtonClick = (index) => {
    const nextZoomeds = [...zoomeds];
    nextZoomeds[index] = !nextZoomeds[index];
    props.setZoomeds(nextZoomeds);
  };

  const handleTripClick = async (index) => {
    props.setTripActivities(trips[index].activities);
    props.setTripName(nameTrip(trips[index]));
    navigate("/trip_view");
  };

  const activityRefs = useRef([]);

  const scrollLeft = () => {
    console.log("scrolling left");
    if (activityRefs.current[0]) {
      const marginRight = parseFloat(
        window.getComputedStyle(activityRefs.current[0]).marginRight,
      );
      const activityWidth = activityRefs.current[0].offsetWidth + marginRight;
      scrollContainerRef.current.scrollTo({
        left: scrollContainerRef.current.scrollLeft - activityWidth,
        behavior: "smooth",
      });
    }
  };

  const scrollRight = () => {
    console.log("scrolling right");
    if (activityRefs.current[0]) {
      const marginRight = parseFloat(
        window.getComputedStyle(activityRefs.current[0]).marginRight,
      );
      const activityWidth = activityRefs.current[0].offsetWidth + marginRight;
      scrollContainerRef.current.scrollTo({
        left: scrollContainerRef.current.scrollLeft + activityWidth,
        behavior: "smooth",
      });
    }
  };
  const [showDialog, setShowDialog] = useState(false);

  const openDialog = () => {
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
  };

  const confirmRemove = async () => {
    await removePinnedActivities();
    closeDialog();
    navigate("/redirectDB");
  };

  const [pinnedActivityOpen, setPinnedActivityOpen] = useState(false);
  const [currentPinnedActivity, setCurrentPinnedActivity] = useState(null);

  const handleClickOpen = (activity) => {
    setCurrentPinnedActivity(activity);
    setPinnedActivityOpen(true);
  };

  const handleClosePinnedActivity = () => {
    setPinnedActivityOpen(false);
  };

  const totalDistance = (userActivities ?? []).reduce(
    (total, activity) => total + activity.distance,
    0,
  );
  const totalElevation = (userActivities ?? []).reduce(
    (total, activity) => total + activity.total_elevation_gain,
    0,
  );
  return (
    <main className="dashboard-page">
      <header className="dashboard-hero">
        <div>
          <span className="section-kicker">Adventure archive</span>
          <h1>{possessiveName} life outside.</h1>
          <p>A living record of long roads, high places and days worth remembering.</p>
        </div>
        <div className="dashboard-stats">
          <div><strong>{(userActivities ?? []).length}</strong><span>activities</span></div>
          <div><strong>{Math.round(totalDistance / 1000).toLocaleString()}</strong><span>kilometres</span></div>
          <div><strong>{Math.round(totalElevation).toLocaleString()}</strong><span>metres climbed</span></div>
          <div><strong>{trips.length}</strong><span>big journeys</span></div>
        </div>
      </header>
      {trips?.length > 0 && (
        <section className="dashboard-section trips-section">
          <div className="section-heading">
            <span className="section-index">01</span>
            <div><span className="section-kicker">Multi-day stories</span><h2>Journeys that went further.</h2></div>
          </div>
          <div className="trip-list">
            {trips.map((trip, index) => (
            <article
              className="trip-card"
              key={index}
              onClick={() => handleTripClick(index)}
            >
              <Trip
                key={index + zoomeds[index]}
                trip={trip}
                index={index}
                zoomed={zoomeds[index]}
                onButtonClick={handleTripToggleButtonClick}
              />
            </article>
            ))}
          </div>
        </section>
      )}
      <WorldMap activities={userActivities} name={possessiveName} />
      <section className="dashboard-section pinned-section">
        <div className="section-heading">
          <span className="section-index">03</span>
          <div><span className="section-kicker">The keepers</span><h2>Pinned adventures. <FontAwesomeIcon icon={faThumbTack} /></h2></div>
        </div>
        {!external && pinnedActivities?.length > 0 && (
          <button
            onClick={openDialog}
            style={{ position: "absolute", right: "1em", marginBottom: "1em" }}
          >
            Remove activities <FontAwesomeIcon icon={faBan} />
          </button>
        )}
        <Modal
          isOpen={showDialog}
          onRequestClose={closeDialog}
          contentLabel="Remove Activities Confirmation"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "fit-content",
            height: "fit-content",
            margin: "auto",
          }}
        >
          <h2 style={{ textAlign: "center" }}>
            Do you really want to unpin all activities?
          </h2>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button onClick={confirmRemove} style={{ marginRight: "1em" }}>
              Yes
            </button>
            <button onClick={closeDialog}>No</button>
          </div>
        </Modal>

        {!external && (
          <button
            onClick={openModal}
            style={{ marginLeft: "1em", marginBottom: "1em" }}
          >
            Add activity <FontAwesomeIcon icon={faPlus} />
          </button>
        )}
        <div
          className="pinnedContainer"
          ref={scrollContainerRef}
        >
          {pinnedActivities?.length > 0 ? (
            pinnedActivities.map((activity, index) => (
              <div
                key={index}
                className="pinned-card"
                ref={(el) => (activityRefs.current[index] = el)}
                onClick={() => handleClickOpen(activity)}
              >
                <ActivityForRanking activity={activity} />
              </div>
            ))
          ) : (
            <div style={{ width: "100%", textAlign: "center" }}>
              {possessiveName} pinned activities will appear here
            </div>
          )}

          <Dialog
            open={pinnedActivityOpen}
            onClose={handleClosePinnedActivity}
            fullWidth={true}
            maxWidth="md"
            PaperProps={{
              style: { maxHeight: "80vh" },
            }}
          >
            <DialogContent>
              <Activity activity={currentPinnedActivity} />
            </DialogContent>
          </Dialog>
          {isOverflowing && (
            <LeftArrowButton onClick={scrollLeft} style={{ left: 0 }}>
              <FontAwesomeIcon icon={faArrowLeft} />
            </LeftArrowButton>
          )}
          {isOverflowing && (
            <RightArrowButton onClick={scrollRight} style={{ right: 0 }}>
              <FontAwesomeIcon icon={faArrowRight} />
            </RightArrowButton>
          )}
        </div>
        <Modal isOpen={modalIsOpen} onRequestClose={closeModal}>
          <h2>Click an activity to add it to the pinned ones</h2>
          {activities.map((activity, index) => (
            <div
              key={index}
              style={{
                backgroundColor: "whitesmoke",
                transition: "background-color 0.1s ease",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "lightgrey")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = "whitesmoke")
              }
              onClick={() => addToPinnedActivity(activity.id)}
            >
              {activity.name}
            </div>
          ))}
        </Modal>
      </section>
      <section className="dashboard-section rankings-section">
        <div className="section-heading">
          <span className="section-index">04</span>
          <div><span className="section-kicker">Personal bests</span><h2>The biggest days.</h2></div>
        </div>
      <div className="rankings-grid">
        {rankedActivities?.map((actObj, index) => (
          <div
            className="ranking-card"
            key={`${actObj.type}-${actObj.crit}`}
          >
            <ActivityRanking
              crit={actObj.crit}
              activities={actObj.activities}
              ownerName={possessiveName}
              activityRefs={activityRefs}
              isOverflowing={isOverflowing}
              scrollLeft={scrollLeft}
              scrollRight={scrollRight}
            />
          </div>
        ))}
      </div>
      </section>

      {!external && (
        <button
          onClick={handleButtonClick}
          style={{ marginLeft: "1em", display: "block", margin: "2em auto" }}
        >
          Fetch new activities from Strava{" "}
          <FontAwesomeIcon icon={faStrava} style={{ color: "#ee5535" }} />
        </button>
      )}
      <ToastContainer
        position="bottom-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      {!external && FloatingActionButton(handleShareClick)}
    </main>
  );
};

const styles = {
  fab: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
  },
};

function FloatingActionButton(funClick) {
  return (
    <div>
      <Fab
        color="primary"
        aria-label="add"
        style={styles.fab}
        onClick={funClick}
      >
        <ShareIcon />
      </Fab>
    </div>
  );
}

function ActivityRanking({ crit, activities, ownerName }) {
  const activityType = activities?.[0]?.type ?? "Ride";
  return (
    <div className="rankedContainer">
      <div className="ranking-title">
        <span className="ranking-icon"><FontAwesomeIcon icon={activityType === "Run" ? faRunning : faBicycle} /></span>
        <div><strong>{activityType === "Run" ? "On foot" : "On two wheels"}</strong><span>{crit === "distance" ? "Longest distance" : "Most elevation"}</span></div>
      </div>
      {activities?.length > 0 ? (
        activities.map((activity, index) => (
          <div key={index} className="ranking-row">
            <span className="ranking-position">{String(index + 1).padStart(2, "0")}</span>
            <h6>
              {crit ? (
                <>
                  {shortenText(activity.name, 28)}
                  <span className="ranking-value">
                    {crit === "distance"
                      ? `${formatNumber(convertToKm(activity[crit]))}km`
                      : `${formatNumber(activity[crit])}m`}
                    {crit === "total_elevation_gain" && (
                      <FontAwesomeIcon
                        icon={faLevelUpAlt}
                        style={{ marginLeft: ".5em" }}
                      />
                    )}
                  </span>
                </>
              ) : (
                shortenText(activity.name, 30)
              )}
            </h6>
          </div>
        ))
      ) : (
        <div style={{ width: "100%", textAlign: "center" }}>
          {ownerName} ranked activities will appear here
        </div>
      )}
    </div>
  );
}

const mapDispatchToProps = {
  setUserTrips,
  setUserActivities,
  setZoomeds,
  setTripActivities,
  setTripName,
  setExternal,
  setAltitudes,
  setUsersummary,
};

export default connect(null, mapDispatchToProps)(Dashboard);
