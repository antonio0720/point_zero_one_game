import { GetServerSidePropsResult } from 'next';
import Cookie from 'js-cookie';

export default function FinalizeThreePage(props) {
// Access getServerSideProps data
const { propsData } = props;

// Set a cookie using the data obtained from getServerSideProps
if (process.browser) {
Cookie.set('myCookie', JSON.stringify(propsData));
}

return <div>{/* Your component content */}</div>;
}

// Custom Next.js lifecycle hook - finalize-3
export async function getServerSidePropsFinalizeThree({ props }) {
// Your custom logic for fetching data or setting up initial state

return { props };
}
