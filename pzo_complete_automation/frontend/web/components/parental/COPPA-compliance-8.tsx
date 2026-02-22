import React, { useState } from 'react';
import { DatePicker } from 'antd';
import moment from 'moment';

const COPPAAgeGate = () => {
const [selectedDate, setSelectedDate] = useState<moment.Moment>(moment());

const handleBirthdateChange = (date: moment.Moment) => {
setSelectedDate(date);
};

const isUnderAge = moment().year() - selectedDate.year() < 13;

return (
<div>
<h2>Parental Controls - Age Gating</h2>
<p>
Please enter your date of birth to access this content.{' '}
</p>
<DatePicker
value={selectedDate}
onChange={handleBirthdateChange}
format="YYYY-MM-DD"
/>
{isUnderAge && (
<div style={{ color: 'red' }}>
You are under the age of 13 and cannot access this content.
</div>
)}
</div>
);
};

export default COPPAAgeGate;
