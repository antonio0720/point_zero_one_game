/**
 * HostOSRoute.tsx
 * A React Router route for the /host page, which lazily loads HostLanding, handles ?ref= tracking parameter, sets document title, and fires page_view analytics event.
 */

import { useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics';
import HostLanding from './HostLanding';

const HostOSRoute = () => {
  const location = useLocation();
  const refParam = new URLSearchParams(location.search).get('ref');

  // Set document title
  document.title = 'Point Zero One Digital - Host OS';

  // Fire page_view analytics event
  Analytics.pageView();

  return <HostLanding ref={refParam} />;
};

export default HostOSRoute;
