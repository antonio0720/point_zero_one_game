import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Slider from '@material-ui/core/Slider';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import PauseCircleFilledIcon from '@material-ui/icons/PauseCircleFilled';
import StopCircleOutlinedIcon from '@material-ui/icons/StopCircleOutlined';
import ReplayIcon from '@material-ui/icons/Replay';
import FastForwardIcon from '@material-ui/icons/FastForward';
import FastRewindIcon from '@material-ui/icons/FastRewind';
import { useState } from 'react';

const useStyles = makeStyles({
root: {
width: '100%',
},
});

interface Props {
onPlay: () => void;
onPause: () => void;
onStop: () => void;
onFastForward: () => void;
onFastRewind: () => void;
progress: number;
}

const ReplayViewer6: React.FC<Props> = ({
onPlay,
onPause,
onStop,
onFastForward,
onFastRewind,
progress,
}) => {
const classes = useStyles();

return (
<div className={classes.root}>
<Slider
value={progress}
onChangeCommitted={(_event, value) => console.log(`${value}`)}
/>
<div style={{ display: 'flex', justifyContent: 'center' }}>
<PlayArrowIcon onClick={onPlay} />
<PauseCircleFilledIcon onClick={onPause} />
<StopCircleOutlinedIcon onClick={onStop} />
<ReplayIcon onClick={onFastRewind} />
<FastForwardIcon onClick={onFastForward} />
</div>
</div>
);
};

export default ReplayViewer6;
