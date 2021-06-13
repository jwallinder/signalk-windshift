module.exports = function (app) {
  var plugin = {};

  plugin.id = "windshift";
  plugin.name = "Windshift";
  plugin.description = "Plugin to analyze the windshift";

  var unsubscribes = [];

  var buffer = [];
  var data = [];

  buffer_timeout_s = 10; //seconds
  timeseries_timeout_s = 20 * 60; //20 mins

  plugin.start = function (options, restartPlugin) {
    // Here we put our plugin logic
    app.debug("Plugin Windshift started");
    app.debug(`options: ${options}`);

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
        values = [];
        delta.updates.forEach((u) => {
          app.debug(u);
          vals = onWindDirectionTrue(u.timestamp, u.values[0].value);
          //app.debug("vals: " + vals);
          values = values.concat(vals);
        });

        let signalk_delta = {
          context: "vessels." + app.selfId,
          updates: [
            {
              timestamp: new Date().toISOString(),
              values: values,
            },
          ],
        };

        app.debug("got values: " + JSON.stringify(values));
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
    msg = [
      { path: "environment.wind.windshift.max", value: max },
      { path: "environment.wind.windshift.min", value: min },
    ];
    app.debug("return msg: " + msg);
    return msg;
  }

  plugin.stop = function () {
    // Here we put logic we need when the plugin stops
    app.debug("Plugin Windshift stopped");
  };

  plugin.schema = {
    // The plugin schema
  };

  return plugin;
};
