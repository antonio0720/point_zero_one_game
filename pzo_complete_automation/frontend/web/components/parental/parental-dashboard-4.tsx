import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import LockIcon from '@material-ui/icons/Lock';

const useStyles = makeStyles((theme) => ({
root: {
width: '100%',
maxWidth: 360,
marginTop: theme.spacing(2),
borderRadius: 4,
},
content: {
display: 'flex',
justifyContent: 'space-between',
alignItems: 'center',
},
}));

interface ParentalDashboard4Props {
isAgeVerified: boolean;
}

const ParentalDashboard4: React.FC<ParentalDashboard4Props> = ({ isAgeVerified }) => {
const classes = useStyles();

return (
<Card className={classes.root}>
<CardContent className={classes.content}>
{isAgeVerified ? (
<>
<LockOpenIcon color="primary" />
<Typography variant="h5">You're all set!</Typography>
</>
) : (
<>
<LockIcon color="error" />
<Typography variant="h5">Age verification is required.</Typography>
</>
)}
</CardContent>
</Card>
);
};

export default ParentalDashboard4;
