module.exports = function (app) {
  var plugin = {};

  plugin.id = "windshift";
  plugin.name = "Windshift";
  plugin.description = "Plugin to analyze the windshift";

  var unsubscribes = [];

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
          vals = onWindDirectionTrue(u.values[0].value);
          app.debug("vals: " + vals);
          console.log(vals);
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

  function onWindDirectionTrue(twd_rad) {
    app.debug("twd: " + twd_rad);
    max = parseFloat(twd_rad) + 0.5;
    min = parseFloat(twd_rad) - 0.5;
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
