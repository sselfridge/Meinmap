const summaryStrava = require("./summaryStrava");
const db = require("../db/dataLayer");
const config = require("../../config/keys");
const utils = require("../utils/stravaUtils");

const segmentController = {
  test,
  segmentEfforts,
  intializeUser,
  updateUserDB,
};

async function updateUserDB(req, res, next) {
  console.log("updating user in DB");
  const userData = getUserData(res);
  try {
    await db.updateUser(userData);
  } catch (err) {
    res.locals.err = err;
    next();
  }
  next();
}

async function intializeUser(req, res, next) {
  try {
    const strava = res.locals.strava;
    const userData = getUserData(res);
    await db.updateUser(userData); //TODO switch this to add user

    //kick_off get activities
    addToActivityQueue(strava);
    console.log('Activities Added');
    const count = await  totalUserActivites(strava, res.locals.user.athleteId);
    res.locals.data = { activityCount: count };
    next();
  } catch (err) {
    res.locals.err = err;
    next();
  }
}

function getUserData(res) {
  const user = res.locals.user;
  const accessToken = res.locals.accessToken;
  const refreshToken = res.locals.refreshToken;
  const userData = {
    id: user.athleteId,
    accessToken,
    refreshToken,
  };
  return userData;
}

async function checkInitStatus(req, res, next) {
  //get user stats
  //get # of user actvities in Queue
}

async function checkSegmentSyncStatus(req, res, next) {}

async function segmentEfforts(req, res, next) {




  res.send("ok");
}

async function totalUserActivites(strava, id) {
  const result = await strava.athletes.stats({ id });
  const count = result.all_ride_totals.count + result.all_run_totals.count;
  return count;
}

async function addToActivityQueue(strava) {
  try {

    const result = await summaryStrava.fetchActivitiesFromStrava(strava, 0, 2550000000);
    //March + April Rides
    // const result = await summaryStrava.fetchActivitiesFromStrava(strava, 1585724400, 1588220022);
    //2020 Rides
    // const result = await summaryStrava.fetchActivitiesFromStrava(strava, 1577865600, 1588539708);
    // 1 result
    // const result = await summaryStrava.fetchActivitiesFromStrava(strava, 1588057200, 1588220022);
    result.forEach((activity) => {
      if (!activity.map.summary_polyline) return; //skip activites with no line
      db.addActivity(activity.id, activity.athlete.id);
    });
    console.log("Done Adding to DB");
  } catch (error) {
    console.error("Error while Adding to activtity table:", error.message);
    //Do nothing for now, add event emitter here if this starts to become a problem
  }
}

async function test(req, res, next) {
  console.log("Start Test");
  const strava = res.locals.strava;

  try {
    // const stravaQ = require('../services/stravaQueue')
    // await stravaQ.processQueue();

    const result  = await db.getEffortsWithPath(1075670, 1)

    console.log('result');

    let longest = {name: "", length: 0}
    result.forEach(element => {
      if(longest.length < element.line.length){
        longest.name = element.name
        longest.id = element.segmentId
        longest.length = element.line.length
      }
    });

    console.log("LongTest");
    console.log(longest);
   
  } catch (err) { 
    console.log("CRAP!!!");
    console.log(err.message);
    res.locals.err = "AAAAAAAAA";
  }

  console.log("Test Done");
  next();
}

module.exports = segmentController;
