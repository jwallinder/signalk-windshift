# signalk-windshift

SignalK plugin to calculate the min and max TWD for windshifts

Still expermimental and used at as a support tool if it is possible to see (and predict) oscillating windshifts

Will create two new Paths:
environment.wind.windshift.max
environment.wind.windshift.min

Those can be sent to InfluxDB and be viewed in Grafana like this:
https://github.com/theseal666/signalk-windshift/blob/main/IMG/Overview.png?raw=true
The green line is the raw data from the windvane and the yellow is just grafana moving average (40)
The blue lines is environment.wind.windshift.max and environment.wind.windshift.max respectivly that gievs a hint on the spread (and if the shift is big enough to tack on)


Hopefully there is ways to find and see (and predict) any oscillation behaviours in the wind, like this:
https://github.com/theseal666/signalk-windshift/blob/main/IMG/what%20we%20want.png?raw=true
https://github.com/theseal666/signalk-windshift/blob/main/IMG/what%20we%20want%202.png?raw=true


Settings:
You can play with two parameters in the plugin configuration for different results.
https://github.com/theseal666/signalk-windshift/blob/main/IMG/plugin%20config%20settings.png?raw=true


## -- under development --

more info will come
