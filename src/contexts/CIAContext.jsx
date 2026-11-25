import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CIA_API_URL } from '../config/api';
import { useMonitor } from './MonitorContext';
import { useAuth } from './AuthContext';

const CIAContext = createContext(null);

const DUMMY_UI = import.meta.env.VITE_DUMMY_UI === 'true';

const DUMMY_CIA = {
  events: [{ id: 'dummy-1', headline: "Nvidia CEO Jensen Huang's return sparks AI rally", date: new Date().toISOString() }],
  reports: [],
};

export function CIAProvider({ children }) {
  const [reports, setReports] = useState(DUMMY_UI ? DUMMY_CIA.reports : []);
  const [events, setEvents] = useState(DUMMY_UI ? DUMMY_CIA.events : []);
  const [loading, setLoading] = useState(!DUMMY_UI);
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false);
  const { notifyMarketEventsReady } = useMonitor();

  const fetchLatest = useCallback(async () => {
    if (DUMMY_UI) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${CIA_API_URL}/latest-run`);
      if (!res.ok) throw new Error(`CIA API error: ${res.status}`);
      const data = await res.json();
      if (data.status === 'processing') {
        setError('Pipeline is running. Please wait and refresh.');
        return;
      }
      setEvents(data.events || []);
      setReports(data.reports || []);
      if ((data.events || []).length > 0) {
        notifyMarketEventsReady();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [notifyMarketEventsReady]);

  const { cockpitReady } = useAuth();

  useEffect(() => {
    if (!cockpitReady) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchLatest();
  }, [cockpitReady, fetchLatest]);

  return (
    <CIAContext.Provider value={{ reports, events, loading, error, refresh: fetchLatest }}>
      {children}
    </CIAContext.Provider>
  );
}

export function useCIA() {
  return useContext(CIAContext);
}
