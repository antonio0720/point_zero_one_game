import React, { useEffect, useState } from 'react';
import { Button, Grid, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';

const useStyles = makeStyles({
root: {
padding: '2rem',
backgroundColor: '#f5f5f5',
borderRadius: '8px',
marginBottom: '1.5rem',
},
content: {
display: 'flex',
flexDirection: 'column',
alignItems: 'center',
},
stepTitle: {
fontSize: '2rem',
marginBottom: '1rem',
},
stepDescription: {
fontSize: '1.375rem',
lineHeight: '1.6',
maxWidth: '60ch',
textAlign: 'center',
marginBottom: '2rem',
},
});

const ProgressiveDisclosureStep7 = () => {
const classes = useStyles();
const [showContent, setShowContent] = useState(false);

useEffect(() => {
if (window.localStorage.getItem('pd-step-6') === 'completed') {
setShowContent(true);
}
}, []);

const handleClick = () => {
setShowContent(!showContent);
window.localStorage.setItem('pd-step-7', showContent ? 'completed' : 'incomplete');
};

return (
<div className={classes.root}>
<Grid container justify="center">
<Grid item xs={12} md={8}>
<div className={classes.content}>
{!showContent && (
<>
<Typography variant="h4" className={classes.stepTitle}>
Step 7: Customize Your Dashboard
</Typography>
<Typography variant="body1" className={classes.stepDescription}>
Now that you've mastered the basics, it's time to make your dashboard truly yours! You can customize the layout, colors, and more to suit your unique workflow.
</Typography>
</>
)}
{showContent && (
<>
<Typography variant="h4" className={classes.stepTitle}>
Step 7: Customize Your Dashboard Completed!
</Typography>
<Typography variant="body1" className={classes.stepDescription}>
Well done! You've successfully customized your dashboard to meet your needs. Remember, the key to productivity lies in personalization and adapting to what works best for you. Keep learning and growing!
</Typography>
</>
)}
<Button onClick={handleClick} variant="outlined" color="primary">
{showContent ? 'Start Customizing' : 'Next Step'}
</Button>
</div>
</Grid>
</Grid>
</div>
);
};

export default ProgressiveDisclosureStep7;
