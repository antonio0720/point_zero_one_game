import React, { useState } from 'react';
import DateFnsUtils from '@date-io/dayjs';
import { MuiPickersUtilsProvider, KeyboardDatePicker } from '@material-ui/pickers';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Checkbox from '@material-ui/core/Checkbox';
import { makeStyles } from '@material-ui/styles';

const useStyles = makeStyles({
form: {
display: 'flex',
flexDirection: 'column',
alignItems: 'center',
marginTop: 50,
maxWidth: 600,
},
input: {
marginBottom: 20,
},
});

const COPPACompliance6 = () => {
const classes = useStyles();
const [age, setAge] = useState<number | null>(null);
const [consent, setConsent] = useState<boolean>(false);
const [email, setEmail] = useState<string>('');

const handleDateChange = (date: Date | null) => {
if (date) {
setAge(date.getFullYear() - 13); // Assume age gate is 13+
}
};

return (
<div>
<h1>Welcome to Our Service!</h1>
<p>
To continue, please confirm that you are at least 13 years old and provide a valid parental email address.
</p>
<MuiPickersUtilsProvider utils={DateFnsUtils}>
<KeyboardDatePicker
disableToolbar
variant="inline"
format="MM/dd/yyyy"
value={age}
onChange={handleDateChange}
className={classes.input}
KeyboardButtonProps={{
'aria-label': 'change date',
}}
/>
</MuiPickersUtilsProvider>
<TextField
id="email"
label="Parental Email Address"
type="email"
value={email}
onChange={(e) => setEmail(e.target.value)}
className={classes.input}
margin="normal"
/>
<Checkbox
checked={consent}
onChange={() => setConsent(!consent)}
color="primary"
>
I agree to the Terms of Service and Privacy Policy
</Checkbox>
<Button
variant="contained"
color="primary"
disabled={!age || !email || !consent}
>
Continue
</Button>
</div>
);
};

export default COPPACompliance6;
