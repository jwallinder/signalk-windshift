const windshiftAnalysis = require("./windshiftAnalysis.js");
const windshift = require("./windshiftAnalysis.js");

module.exports = function (app) {
  var plugin = {};

  plugin.id = "windshift";
  plugin.name = "Windshift";
  plugin.description = "Plugin to analyze the windshift";

  var unsubscribes = [];

  var buffer = [];
  var data = [];

  const DEFAULT_AVG_BUFFER = 10; //seconds
  let buffer_timeout_s = DEFAULT_AVG_BUFFER;

  const DEFAULT_MIN_MAX_BUFFER = 20; //mins
  let timeseries_timeout_s = DEFAULT_MIN_MAX_BUFFER * 60;

  plugin.start = function (options, restartPlugin) {
    // Here we put our plugin logic
    app.debug("Plugin Windshift started");
    app.debug("options:" + JSON.stringify(options));

    windshiftAnalysis.logger(app.debug);

    buffer_timeout_s =
      options.twd_buffer_time || buffer_timeout_s || DEFAULT_AVG_BUFFER;
    timeseries_timeout_s =
      options.min_max_calc_time || timeseries_timeout_s || DEFAULT_AVG_BUFFER;

    let localSubscription = {
      context: "*", // Get data for all contexts
      subscribe: [
        {
          path: "environment.wind.directionTrue",
          period: 500, // Every 5000ms
        },
      ],
    };

    app.subscriptionmanager.subscribe(
      localSubscription,
      unsubscribes,
      (subscriptionError) => {
        app.error("Error:" + subscriptionError);
      },
      (delta) => {
        values = {};
        delta.updates.forEach((u) => {
          app.debug(u);
          value = u.values[0].value;
          if (isNaN(value)) return;

          windshiftAnalysis.appendWindDirection(
            u.values[0].value,
            u.timestamp,
            ({ timestamp, maxTWD, minTWD }) => {
              //values = values.concat(vals);
              let signalk_delta = {
                context: "vessels." + app.selfId,
                updates: [
                  {
                    timestamp: timestamp,
                    values: [
                      { path: "environment.wind.windshift.max", value: maxTWD },
                      { path: "environment.wind.windshift.min", value: minTWD },
                    ],
                  },
                ],
              };
              app.debug("send delta: " + JSON.stringify(signalk_delta));
              app.handleMessage(plugin.id, signalk_delta);
            }
          );
        });
      }
    );
  };

  const meta = [
    {
      path: "environment.wind.windshift.max",
      value: {
        units: "rad",
        description: "Windshift max angle calculated from the buffering period",
        displayName: "Windshift max angle",
        shortName: "Windshift max angle",
      },
    },
    {
      path: "environment.wind.windshift.min",
      value: {
        units: "rad",
        description: "Windshift min angle calculated from the buffering period",
        displayName: "Windshift min angle",
        shortName: "Windshift min angle",
      },
    },
  ];

  plugin.stop = function () {
    // Here we put logic we need when the plugin stops
    app.debug("Plugin Windshift stopped");
  };

  plugin.schema = {
    // The plugin schema

    type: "object",
    required: ["some_string", "some_other_number"],
    properties: {
      twd_buffer_time: {
        type: "number",
        title: "How long an average for TWD is calculated (seconds)",
        default: 10,
      },
      min_max_calc_time: {
        type: "number",
        title:
          "How long time to keep TWD to calculate min and max from (minutes)",
        default: 20,
      },
    },
  };

  return plugin;
};
