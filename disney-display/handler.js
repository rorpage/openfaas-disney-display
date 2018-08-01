"use strict"

let https = require('https');
const fs = require("fs");

const API_KEY_NAME = process.env.API_KEY_NAME;

const owm_api_key = fs
  .readFileSync(`/var/openfaas/secrets/${API_KEY_NAME}`)
  .toString();

module.exports = (context, callback) => {
    let req = JSON.parse(context);
    let attractionId = req.attractionId || 80010191;

    let attractionUrl = "https://now.wdwnt.com/attraction/get/" + attractionId;

    https.get(attractionUrl, (result) => {
        let body = "";

        result.on("data", function(d) {
            body += d;
        });

        result.on('end', () => {
            let parsed_attraction = JSON.parse(body);

            const parkId = parsed_attraction.LocationId;
            let utcOffset = -4;

            // Anaheim
            if (parkId == 330339 || parkId == 336894) {
                utcOffset = -7;
            // Tokyo
            } else if (parkId == 1 || parkId == 2) {
                utcOffset = 9;
            // Paris
            } else if (parkId == 3 || parkId == 4) {
                utcOffset = 2;
            // Hong Kong
            } else if (parkId == 5) {
                utcOffset = 8;
            // Shanghai
            } else if (parkId == 6) {
                utcOffset = 8;
            }

            let wait_time = parsed_attraction.CurrentStatus;
            if (wait_time === "Temporary Closure") {
                wait_time = "Temp. Closure";
            }

            if (wait_time.indexOf("Posted") != -1) {
                wait_time = wait_time.replace("Posted Wait", "Wait");
            }

            let weatherUrl = "https://api.openweathermap.org/data/2.5/weather" +
                "?lat=" + parsed_attraction.Latitude + 
                "&lon=" + parsed_attraction.Longitude + 
                "&appid=" + owm_api_key;

            https.get(weatherUrl, (result) => {
                let body = "";

                result.on("data", function(d) {
                    body += d;
                });

                result.on('end', () => {
                    let parsed_weather = JSON.parse(body);
                    let temp_k = Math.round(parsed_weather.main.temp);
                    let temp_f = Math.round((9/5) * (temp_k - 273) + 32);
                    let temp_c = Math.round(temp_k - 273)

                    let clientDate = new Date();
                    let utc = clientDate.getTime() + (clientDate.getTimezoneOffset() * 60000);
                    let serverDate = new Date(utc + (3600000 * utcOffset));

                    let hour = (serverDate.getHours() + 11) % 12 + 1;
                    let hour_display = (hour < 10) ? `0${hour}` : hour;
                    let minutes = serverDate.getMinutes();
                    let minutes_display = (minutes < 10) ? `0${minutes}` : minutes;
                    let time = `${hour_display}:${minutes_display}`;

                    let month = serverDate.getMonth() + 1;
                    let month_display = (month < 10) ? `0${month}` : month;
                    let day = serverDate.getDate();
                    let day_display = (day < 10) ? `0${day}` : day;
                    let date = `${month_display}/${day_display}`;

                    let res = {
                        temperature_f: temp_f,
                        temperature_c: temp_c,
                        time,
                        date,
                        name: parsed_attraction.Name,
                        id: parsed_attraction.Id,
                        latitude: parsed_attraction.Latitude,
                        longitude: parsed_attraction.Longitude,
                        wait_time
                    };

                    callback(undefined, res);
                });
            });
        });
    });
}
