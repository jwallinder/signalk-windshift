var buffer = [];
var data = [];
const DEFAULT_AVG_BUFFER = 10; //seconds
let buffer_timeout_s = DEFAULT_AVG_BUFFER;

const DEFAULT_MIN_MAX_BUFFER = 20; //mins
let timeseries_timeout_s = DEFAULT_MIN_MAX_BUFFER * 60;
var debuglogger;

const debug = (msg) => {
  if (debuglogger) debuglogger(msg);
};

const maxreducer = (max, currentValue) =>
  currentValue > max ? currentValue : max;
const minreducer = (min, currentValue) =>
  currentValue < min ? currentValue : min;
const timeMapper = (datapoint) => datapoint[0];
const twdMapper = (datapoint) => datapoint[1];

const windshiftAnalysis = {
  logger: (logger) => (debuglogger = logger),

  config: (a) => {
    debug("incoming config: " + a);
    debug(a);
    //{ buffer_timeout_s, timeseries_timeout_s }
    debug("buffer_timeout_s: " + a.buffer_timeout_s);
    debug("timeseries_timeout_s: " + a.timeseries_timeout_s);
    this.buffer_timeout_s = a.buffer_timeout_s;
    this.timeseries_timeout_s = a.timeseries_timeout_s;
    debug("this.buffer_timeout_s: " + this.buffer_timeout_s);
    debug("this.timeseries_timeout_s: " + this.timeseries_timeout_s);
  },

  appendWindDirection: (twd, timestamp_in, update) => {
    timestamp = Date.parse(timestamp_in) || Date.now();
    buffer.push([timestamp, twd]);
    debug("BUFFER: " + buffer);

    if (timestamp - buffer[0][0] > buffer_timeout_s * 1000) {
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
      debug(`avg_twd: ${avg_twd} => ${(avg_twd * 180) / Math.PI}`);

      buffer = [];

      data.push([timestamp, avg_twd]);
      debug("long term data: " + data);

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
      debug(
        `min: ${min}, max: ${max} from offset: ${offset} and diff_arry: ${diff_array}`
      );

      debug(data);
      data = data.filter((datapoint) => {
        let time = datapoint[0];
        filter = timestamp - Date.parse(time) < timeseries_timeout_s * 1000;
        return filter;
      });

      debug("twd: " + twd);

      if (update) update({ timestamp: timestamp_in, maxTWD: max, minTWD: min });
    }
  },
};

module.exports = windshiftAnalysis;
