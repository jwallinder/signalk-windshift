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
    app.debug(`options: ${options}`);
    app.debug(`options: ${JSON.stringify(options)}`);
    app.debug("options:" + options);
    app.debug("options:" + JSON.stringify(options));

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
          values = onWindDirectionTrue(u.timestamp, u.values[0].value);
          //values = values.concat(vals);
        });

        let signalk_delta = {
          context: "vessels." + app.selfId,
          updates: [
            {
              timestamp: new Date().toISOString(),
              ...values,
            },
          ],
        };

        app.debug("send delta: " + JSON.stringify(signalk_delta));
        app.handleMessage(plugin.id, signalk_delta);
      }
    );
  };

  var max = 0;
  var min = 0;

  const maxreducer = (max, currentValue) =>
    currentValue > max ? currentValue : max;
  const minreducer = (min, currentValue) =>
    currentValue < min ? currentValue : min;
  const timeMapper = (datapoint) => datapoint[0];
  const twdMapper = (datapoint) => datapoint[1];

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

  function onWindDirectionTrue(time, twd_rad) {
    buffer.push([time, parseFloat(twd_rad)]);

    app.debug("buffer: " + buffer);

    if (Date.now() - Date.parse(buffer[0][0]) > buffer_timeout_s * 1000) {
      // https://math.stackexchange.com/a/1920805
      //u_east = mean(sin(WD * pi/180))
      //u_north = mean(cos((WD * pi) / 180));
      //unit_WD = (arctan2(u_east, u_north) * 180) / pi; (-180 < unit_WD < 180)
      //unit_WD = (360 + unit_WD) % 360; (0 < unit_WD < 360)

      u_east =
        buffer
          .map(twdMapper)
          .map((twd) => Math.sin(twd))
          .reduce((acc, u) => acc + u) / buffer.length;
      u_north =
        buffer
          .map(twdMapper)
          .map((twd) => Math.cos(twd))
          .reduce((acc, u) => acc + u) / buffer.length;
      avg_twd = Math.atan2(u_east, u_north);

      avg_twd = (2 * Math.PI + avg_twd) % (2 * Math.PI);
      app.debug(`avg_twd: ${avg_twd} => ${(avg_twd * 180) / Math.PI}`);

      buffer = [];

      data.push([time, avg_twd]);
      app.debug("long term data: " + data);

      offset = data[0][1];
      //=if(C3>180,C3-360,if(C3<-180,mod(C3+360,360),C3))
      diff_array = data
        .map(twdMapper)
        .map((twd) => {
          diff = twd - offset;
          return diff;
        })
        .map((diff) => {
          if (diff > Math.PI) {
            return diff - 2 * Math.PI;
          } else if (diff < -Math.PI) {
            return (diff + 2 * Math.PI) % (2 * Math.PI);
          }
          return diff;
        });

      min = offset + Math.min(...diff_array);
      max = offset + Math.max(...diff_array);
      app.debug(
        `min: ${min}, max: ${max} from offset: ${offset} and diff_arry: ${diff_array}`
      );

      app.debug(data);
      data = data.filter((datapoint) => {
        time = datapoint[0];
        filter = Date.now() - Date.parse(time) < timeseries_timeout_s * 1000;
        return filter;
      });
    }

    app.debug("twd: " + twd_rad);
    //max = parseFloat(twd_rad) + 0.5;
    //min = parseFloat(twd_rad) - 0.5;
    values = [
      { path: "environment.wind.windshift.max", value: max },
      { path: "environment.wind.windshift.min", value: min },
    ];

    return { values: values, meta: meta };
  }

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
