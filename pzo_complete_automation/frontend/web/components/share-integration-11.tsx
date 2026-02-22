import React from 'react';
import { ShareButtons, ShareCount, Network, Button } from "react-share";

const ShareIntegration11 = () => {
const url = window.location.href;

return (
<div>
<ShareButtons url={url}>
<Network id="facebook">
<Button className='share-btn'>Facebook</Button>
</Network>
<Network id="twitter">
<Button className='share-btn'>Twitter</Button>
</Network>
<Network id="linkedin">
<Button className='share-btn'>LinkedIn</Button>
</Network>
<Network id="whatsapp">
<Button className='share-btn'>WhatsApp</Button>
</Network>
</ShareButtons>
<StyleRoot>{`
.share-btn {
margin: 5px;
}
`}</StyleRoot>
</div>
);
};

export default ShareIntegration11;
