/**
 * Host Dashboard Component
 */

import React, { useState } from 'react';
import moment from 'moment';
import 'moment/locale/en-GB'; // For UK date format

interface TimerProps {
  time: number;
  onTimerEnd: () => void;
}

const Timer: React.FC<TimerProps> = ({ time, onTimerEnd }) => {
  const [seconds, setSeconds] = useState(time);

  const tick = () => {
    if (seconds > 0) {
      setSeconds(seconds - 1);
    } else {
      onTimerEnd();
    }
  };

  useInterval(() => tick(), 1000);

  return <div>{moment.utc(seconds * 1000).format('HH:mm:ss')}</div>;
};

interface ButtonProps {
  label: string;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({ label, onClick }) => (
  <button onClick={onClick}>{label}</button>
);

interface DebriefCardProps {
  content: string;
}

const DebriefCard: React.FC<DebriefCardProps> = ({ content }) => (
  <div className="debrief-card">{content}</div>
);

interface AttendanceTrackerProps {
  attendees: string[];
  onAttendeeArrival: (attendee: string) => void;
}

const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  attendees,
  onAttendeeArrival,
}) => {
  const handleClick = (attendee: string) => () => {
    if (!attendees.includes(attendee)) {
      onAttendeeArrival(attendee);
    }
  };

  return (
    <div className="attendance-tracker">
      {attendees.map((attendee) => (
        <Button key={attendee} label={attendee} onClick={handleClick(attendee)} />
      ))}
    </div>
  );
};

interface ClipCaptureQueueProps {
  clips: string[];
}

const ClipCaptureQueue: React.FC<ClipCaptureQueueProps> = ({ clips }) => (
  <ul className="clip-capture-queue">
    {clips.map((clip) => <li key={clip}>{clip}</li>)}
  </ul>
);

interface NextSessionBookingWidgetProps {
  onBookNextSession: () => void;
}

const NextSessionBookingWidget: React.FC<NextSessionBookingWidgetProps> = ({
  onBookNextSession,
}) => (
  <button onClick={onBookNextSession}>Book next session</button>
);

interface DashboardProps {
  timerTime: number;
  momentButtons: ButtonProps[];
  clips: string[];
  attendees: string[];
}

const Dashboard: React.FC<DashboardProps> = ({
  timerTime,
  momentButtons,
  clips,
  attendees,
}) => (
  <div className="dashboard">
    <Timer time={timerTime} onTimerEnd={() => console.log('Session ended')} />
    <div className="moment-buttons">
      {momentButtons.map((button) => (
        <Button key={button.label} {...button} />
      ))}
    </div>
    <ClipCaptureQueue clips={clips} />
    <AttendanceTracker attendees={attendees} onAttendeeArrival={() => console.log('Attendee arrived')} />
    <DebriefCard content="Please debrief the session." />
    <NextSessionBookingWidget onBookNextSession={() => console.log('Next session booked')} />
  </div>
);

export default Dashboard;
