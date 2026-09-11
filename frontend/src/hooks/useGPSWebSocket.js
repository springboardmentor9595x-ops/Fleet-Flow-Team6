import { useEffect, useRef, useState } from "react";
import { createGPSWebSocket } from "../api/websocket";

// ==========================================================
// GPS WebSocket Hook
// ==========================================================

export default function useGPSWebSocket() {
  const socketRef = useRef(null);
  const [gpsData, setGpsData] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimer = null;

    const connect = () => {
      if (!isMounted) return;

      const wsClient = createGPSWebSocket(
        // When GPS data is received
        (data) => {
          if (isMounted) {
            setGpsData(data);
          }
        },
        // When connected
        () => {
          if (isMounted) {
            setConnected(true);
          }
        },
        // When disconnected
        () => {
          if (isMounted) {
            setConnected(false);
            // Retry after 5s if still mounted
            reconnectTimer = setTimeout(connect, 5000);
          }
        },
        // When error occurs
        () => {
          if (isMounted) {
            setConnected(false);
          }
        }
      );

      socketRef.current = wsClient;
    };

    connect();

    // ------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------
    return () => {
      isMounted = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  return {
    gpsData,
    connected,
    socket: socketRef.current,
  };
}