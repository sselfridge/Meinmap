const express = require("express");
const app = express();
const path = require("path");
const axios = require("axios");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const fs = require("fs");

const m = require("moment");

const oAuthStrava = require("./controllers/oAuthStrava");
const summaryController = require("./controllers/summaryStrava");
const segmentController = require("./controllers/segmentsStrava");
const analyticController = require("./controllers/analyticsController");

const stravaQ = require("./services/stravaQueue");
const zip = require("../src/config/zip_lat_lang");
const config = require("../src/config/keys");

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.use(cookieParser());

app.use(logReq);

//   REMINDER: Nodemon doesn't pickup new routes, need to kill and restart everything when changing routes

var cron = require("node-cron");

//Every morning at 04:01 am
cron.schedule("01 04 * * *", () => {
  const time = m().format();
  console.log("Cron Test:", time);
  segmentController.cronUpdateSegments();
});

//Every 15min
// cron.schedule("*/15 * * * *", () => {
//   console.log("---- 15 min Cron----");
//   stravaQ.processQueue();
// });
// setInterval(, timer);

app.get("/api/getStravaUser", oAuthStrava.loadStravaProfile, (req, res) => {
  //TODO - rework error handling
  // Currently no difference between actual errors and no cookie found.
  // if (res.locals.err) {
  //   res.status(444).send("Error during profile fetch");
  //   return;
  // }
  if (res.locals.user) {
    //user profile exists send info back
    console.log(`User logged in to strava`);
    res.send(JSON.stringify(res.locals.user));
    return;
  }
  //no user logged in
  console.log(`User not logged in to strava`);
  res.status(201).send("User Not logged in");
});

//This route has been deprecated, keeping it around for a bit in case the
// new issue has bugs popup
app.get("/api/getLatLngZip/:zip", (req, res) => {
  if (!/^\d{5}/.test(req.params.zip)) {
    res.status(400).send("Only 5 digit zip codes allowed");
    return;
  } //only query if zip is 5 numbers
  const latlng = zip(req.params.zip);
  if (latlng === null) {
    res.status(400).send(`Invalid zip code: ${req.params.zip}`);
    return;
  }
  const center = {
    lat: latlng[0],
    lng: latlng[1],
  };
  res.json(center);
});

app.get("/api/strava/callback", oAuthStrava.setStravaOauth, (req, res) => {
  console.log(`Strava Oauth CallBack Happening`);
  if (res.locals.err) {
    console.log(res.locals.err);
    res.status(523).send("Error with Oauth");
  }
  res.redirect(config.redirect_url);
});

app.get(
  "/api/summaryActivities",
  oAuthStrava.loadStravaProfile,
  summaryController.getSummaries,
  (req, res) => {
    console.log("back here");
    if (res.locals.err) {
      console.log(res.locals.err);
      res.status(523).send("Error with get Activities");
      return;
    }
    console.log(`Sending Back ${res.locals.activities.length} activities`);
    // uncomment to save activities to file
    // fs.writeFileSync("./savedActivities.json", JSON.stringify(res.locals.activities));
    res.send(JSON.stringify(res.locals.activities));
  }
);

app.get("/api/demoData", (req, res) => {
  const demoData = fs.readFileSync("./server/utils/LGGroupRides.json");
  res.send(demoData);
});

app.get(
  "/api/test",
  oAuthStrava.loadStravaProfile,
  // segmentController.initializeUser,
  // segmentController.updateUserDB,

  segmentController.test,
  (req, res) => {
    if (res.locals.err) {
      console.log("Error!!");
      console.log(res.locals.err);
      res.status(500).send("DOH!!");
    } else {
      // stravaQ.processQueue();
      console.log("fin");
      res.send(res.locals.effort);
    }
  }
);

app.get("/api/testhook", (req, res) => {
  console.log("  client_id: config.client_id,: ", config.client_id);
  console.log(" config.client_secret,: ", config.client_secret);

  const URL = "https://www.strava.com/api/v3/push_subscriptions";
  console.log("Make req");
  axios
    .post(URL, {
      client_id: config.client_id,
      client_secret: config.client_secret,
      callback_url: "http://9d6b-184-187-181-40.ngrok.io/api/gethook",
      verify_token: "1243567ui7tkuyjrrg34e5rut65",
    })
    .then((result) => {
      console.log("result: ", result);
      return res.send("GOGO").status(200);
    })
    .catch((err) => {
      console.log("API: Error");
      console.log(err.toJSON().message);
      return res.send("no good...").status(500);
    });

  res.status(200);
});

app.get("/api/gethook", (req, res) => {
  const challenge = req.query["hub.challenge"];
  console.log("req  ", challenge);

  res.send({ "hub.challenge": challenge });
});

app.post("/api/gethook", (req, res) => {
  console.log("Holy crap it worked");
  console.log(req.body);
  console.log(req.data);
  res.sendStatus(200);
});

app.post(
  "/api/initialize",
  oAuthStrava.loadStravaProfile,
  segmentController.initializeUser,
  (req, res) => {
    if (res.locals.err) {
      console.log(res.locals.err);
      res.status(501).send("Error initalizing user ");
      return;
    }
    const count = res.locals.data.activityCount;

    res.send(JSON.stringify(count));
  }
);

app.get(
  "/api/segmentEfforts",
  oAuthStrava.loadStravaProfile,
  segmentController.segmentEfforts,
  (req, res) => {
    console.log("finalize Segment Efforts");
    if (res.locals.err) {
      console.log(res.locals.err);
      res.status(523).send("Error with get segments ");
      return;
    }
    if (res.locals.pending) {
      res.status(203).send("Data Pending, check back soon");
      return;
    }
    // fs.writeFileSync("./savedEfforts.json", JSON.stringify(res.locals.segmentEfforts));

    res.send(JSON.stringify(res.locals.segmentEfforts));
  }
);

app.get("/api/getDemoData", summaryController.getDemoData, (req, res) => {
  console.log(`Sending Back ${res.locals.activities.length} activities`);
  res.send(JSON.stringify(res.locals.activities));
});

app.post("/api/logout", oAuthStrava.clearCookie, (req, res) => {
  res.send("Ok");
});

app.get("/api/users/:id", segmentController.getUser, (req, res) => {
  if (res.locals.err) {
    res.status(512).send("Error Fetching User");
    return;
  }

  if (res.locals.user) {
    res.send(JSON.stringify(res.locals.user));
  } else {
    res.status(204).send();
  }
});

app.get("/api/kickoffQ", (req, res) => {
  console.log("endPoint /api/kickoffQ hit, starting Q");
  stravaQ.processQueue();
  res.send("ok");
});

app.delete(
  "/api/users/:id",
  oAuthStrava.loadStravaProfile,
  segmentController.deleteUser,
  (req, res) => {
    if (res.locals.err) {
      res.status(500).send();
      return;
    }

    res.send("Done");
  }
);

// statically serve everything in the build folder on the route '/build'
if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") {
  console.log(`Server in Production/Test mode!`, path.join(__dirname, "../build"));
  app.use("/build", express.static(path.join(__dirname, "../build")));
  app.use("/static", express.static(path.join(__dirname, "../build/static")));
  // serve index.html on the route '/'
  app.get("/", analyticController.getUserData, (req, res) => {
    console.log("Sending out the index");
    res.sendFile(path.join(__dirname, "../build/index.html"));
  });

  // TODO: redo this to bundle image in webpack
  app.get("/img/:image", (req, res) => {
    const imagePath = path.join(__dirname, `../build/img/${req.params.image}`);
    fs.exists(imagePath, function (exists) {
      if (exists) {
        res.sendFile(imagePath);
      } else {
        res.status(404).send("404");
      }
    });
  });
}

app.use("*", (req, res) => {
  console.log("ERROR Catch All -- Req Url:", req.url);
  // prettier-ignore
  if(req.url === "/") console.log("NODE_ENV must be 'production' Current:", process.env.NODE_ENV)
  res.status(404).send("404 - that did not go well");
});

app.use((err, req, res, next) => {
  console.log(`Catch All Error:======================================`);
  if (err.code != 11000) console.log(err); //11000 is a mongoDB error
  res.status(500).send("Something Broke, we're sorry");
  next();
});

function logReq(req, res, next) {
  console.log(req.url);
  next();
}

module.exports = app;
