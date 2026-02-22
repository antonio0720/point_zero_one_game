import React, { useEffect, useState } from 'react';
import VideoPlayer from 'react-video-player';
import { useRecoilState } from 'recoil';
import { selectedReplayState } from '../../atoms/replaysAtom';

const ReplayViewer = () => {
const [selectedReplay, setSelectedReplay] = useRecoilState(selectedReplayState);

const [playerReady, setPlayerReady] = useState(false);
const [player, setPlayer] = useState<any>(null);

useEffect(() => {
if (selectedReplay && !playerReady) {
setPlayer({
play: () => player && player.playVideo(),
pause: () => player && player.pauseVideo(),
seek: (seconds: number) => player && player.seekTo(seconds),
});
setPlayerReady(true);
}
}, [selectedReplay, playerReady]);

const videoOptions = {
controls: true,
autoplay: false,
playsInline: true,
width: '100%',
height: 'auto',
};

return (
<div>
{selectedReplay && (
<VideoPlayer
src={selectedReplay.videoUrl}
ref={setPlayer}
options={videoOptions}
playing={Boolean(player && player.getCurrentTime() > 0)}
onReady={({ currentTarget }) => setPlayer(currentTarget)}
onClick={() => player?.playVideo()}
/>
)}
</div>
);
};

export default ReplayViewer;
