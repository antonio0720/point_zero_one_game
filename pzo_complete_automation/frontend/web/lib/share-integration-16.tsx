import React from 'react';
import { Share as NativeShare } from 'react-native';

type ShareProps = {
title: string;
message: string;
url: string;
};

const Share: React.FC<ShareProps> = ({ title, message, url }) => {
const shareViaNative = async () => {
try {
await NativeShare.share({
title,
message,
url,
dialogTitle: 'Share',
});
} catch (error) {
console.log(error);
}
};

return (
<button onClick={shareViaNative}>
Share via Native Share Dialog
</button>
);
};

export default Share;
