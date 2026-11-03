// The Singer treadle machine as an interactive page: the console, the sixteen parts, and the idle tour.
// ?idle=N sets the seconds of quiet before the tour (default 25); ?notour turns the tour off (tests, screenshots).
import {runLive} from '../singer-treadle-shared/live.js';

const q = new URLSearchParams(location.search);
runLive({idle: Number(q.get('idle')) || 25, tour: !q.has('notour')});
