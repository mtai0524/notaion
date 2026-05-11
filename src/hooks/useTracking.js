import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axiosInstance from '../axiosConfig';

const useTracking = () => {
  const location = useLocation();

  useEffect(() => {
    const trackVisit = async () => {
      try {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        await axiosInstance.post('/api/Analytics/track', {
          path: location.pathname,
          isLocalhost: isLocalhost
        });
      } catch (err) {
        // Silently fail to not disturb user in case of errors
        console.debug("Tracking failed", err);
      }
    };

    trackVisit();
  }, [location.pathname]);
};

export default useTracking;
