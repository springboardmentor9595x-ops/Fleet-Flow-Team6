// ==========================================================
// WebSocket Configuration
// ==========================================================

const getWSUrl = () => {
  if (import.meta.env?.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname || "localhost";
  return `${protocol}//${host}:8000/ws`;
};

// ==========================================================
// Create WebSocket Connection
// ==========================================================

export const createGPSWebSocket = (
  onMessage,
  onOpen,
  onClose,
  onError
) => {
  const url = getWSUrl();
  let socket = null;
  let isClosedIntentionally = false;

  try {
    socket = new WebSocket(url);
  } catch (err) {
    if (onError) onError(err);
    return {
      close: () => {},
      send: () => {},
      readyState: 3,
    };
  }

  // --------------------------------------------------------
  // Connection Opened
  // --------------------------------------------------------
  socket.onopen = () => {
    if (isClosedIntentionally) {
      try {
        socket.close();
      } catch (_) {}
      return;
    }

    console.log("WebSocket connected successfully to", url);

    if (onOpen) {
      onOpen();
    }
  };

  // --------------------------------------------------------
  // Message Received
  // --------------------------------------------------------
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) {
        onMessage(data);
      }
    } catch (error) {
      console.warn("Invalid WebSocket message:", error);
    }
  };

  // --------------------------------------------------------
  // Connection Closed
  // --------------------------------------------------------
  socket.onclose = (event) => {
    if (!isClosedIntentionally) {
      if (onClose) {
        onClose(event);
      }
    }
  };

  // --------------------------------------------------------
  // Connection Error
  // --------------------------------------------------------
  socket.onerror = (error) => {
    if (!isClosedIntentionally) {
      console.warn("WebSocket connection notice:", error);
      if (onError) {
        onError(error);
      }
    }
  };

  return {
    get readyState() {
      return socket ? socket.readyState : 3;
    },
    send: (data) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(typeof data === "string" ? data : JSON.stringify(data));
      }
    },
    close: () => {
      isClosedIntentionally = true;
      if (!socket) return;

      if (socket.readyState === WebSocket.CONNECTING) {
        socket.onopen = () => {
          try {
            socket.close();
          } catch (_) {}
        };
      } else if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.close();
        } catch (_) {}
      }
    },
    rawSocket: socket,
  };
};