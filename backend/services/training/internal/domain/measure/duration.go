package measure

import "time"

type Duration struct {
	seconds int
}

func NewDurationSeconds(secs int) Duration {
	if secs < 0 {
		secs = 0
	}
	return Duration{seconds: secs}
}

func (d Duration) Seconds() int {
	return d.seconds
}

func (d Duration) AsTimeDuration() time.Duration {
	return time.Duration(d.seconds) * time.Second
}
