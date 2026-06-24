import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Conexión EXCLUSIVA por cable USB usando la Web Serial API.
 * No hay lógica Bluetooth: se usa navigator.serial.requestPort() para abrir
 * el selector de puertos del sistema y hablar con el Arduino Uno por USB.
 *
 * Funciona en Chrome / Edge de escritorio sobre HTTPS o localhost.
 */

// ---- Tipos mínimos de Web Serial (autocontenidos) ----
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  addEventListener?(type: "disconnect", listener: () => void): void;
  removeEventListener?(type: "disconnect", listener: () => void): void;
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
  addEventListener?(type: "disconnect", listener: () => void): void;
  removeEventListener?(type: "disconnect", listener: () => void): void;
}

function getSerial(): SerialLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as { serial?: SerialLike };
  return nav.serial ?? null;
}

const BAUD_RATE = 9600;

export function useSerial() {
  const portRef = useRef<SerialPortLike | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const keepReadingRef = useRef(false);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Última línea recibida y log acumulado desde el Arduino.
  const [lastLine, setLastLine] = useState<string>("");
  const [incoming, setIncoming] = useState<string[]>([]);

  const supported = getSerial() !== null;

  // Limpieza interna del estado cuando se pierde el puerto.
  const cleanup = useCallback(async () => {
    keepReadingRef.current = false;
    try {
      await readerRef.current?.cancel();
    } catch {
      /* ignore */
    }
    try {
      readerRef.current?.releaseLock();
    } catch {
      /* ignore */
    }
    readerRef.current = null;
    try {
      await writerRef.current?.close();
    } catch {
      /* ignore */
    }
    try {
      writerRef.current?.releaseLock();
    } catch {
      /* ignore */
    }
    writerRef.current = null;
    try {
      await portRef.current?.close();
    } catch {
      /* ignore */
    }
    portRef.current = null;
    setConnected(false);
  }, []);

  // Lector asíncrono: escucha continuamente lo que el Arduino envía por USB
  // y parte el flujo en líneas separadas por "\n".
  const startReading = useCallback(async (port: SerialPortLike) => {
    if (!port.readable) return;
    keepReadingRef.current = true;
    const decoder = new TextDecoder();
    let buffer = "";

    while (keepReadingRef.current && port.readable) {
      const reader = port.readable.getReader();
      readerRef.current = reader;
      try {
        while (keepReadingRef.current) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          buffer += decoder.decode(value, { stream: true });
          let nl = buffer.indexOf("\n");
          while (nl !== -1) {
            const line = buffer.slice(0, nl).replace(/\r$/, "").trim();
            buffer = buffer.slice(nl + 1);
            if (line) {
              setLastLine(line);
              setIncoming((prev) => [...prev.slice(-49), line]);
            }
            nl = buffer.indexOf("\n");
          }
        }
      } catch (e) {
        // Desconexión repentina mientras leíamos.
        if (keepReadingRef.current) {
          setError(
            e instanceof Error
              ? `Se perdió la conexión: ${e.message}`
              : "Se perdió la conexión con el Arduino.",
          );
        }
        break;
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* ignore */
        }
      }
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    const serial = getSerial();
    if (!serial) {
      setError(
        "Tu navegador no soporta Web Serial. Usa Google Chrome o Microsoft Edge en una computadora de escritorio.",
      );
      return false;
    }
    try {
      // Abre el selector de puertos USB del sistema operativo.
      const port = await serial.requestPort();
      await port.open({ baudRate: BAUD_RATE });
      portRef.current = port;
      writerRef.current = port.writable?.getWriter() ?? null;
      setConnected(true);
      setError(null);

      // Detecta desconexión física del cable.
      port.addEventListener?.("disconnect", () => {
        setError("El Arduino se desconectó del puerto USB.");
        void cleanup();
      });

      // Arranca el lector en segundo plano (no bloquea).
      void startReading(port);
      return true;
    } catch (e) {
      // Si el usuario cierra el selector sin elegir puerto, no es un error grave.
      const msg =
        e instanceof Error ? e.message : "No se pudo conectar al Arduino.";
      const userCancelled = /No port selected|cancel/i.test(msg);
      setError(
        userCancelled
          ? "No se seleccionó ningún puerto USB."
          : `No se pudo conectar al Arduino por USB: ${msg}`,
      );
      setConnected(false);
      return false;
    }
  }, [cleanup, startReading]);

  const writeLine = useCallback(async (line: string) => {
    if (!writerRef.current) {
      setError("No hay un Arduino conectado por USB.");
      return false;
    }
    try {
      const data = new TextEncoder().encode(line + "\n");
      await writerRef.current.write(data);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? `Error al enviar: ${e.message}` : "Error al enviar.",
      );
      return false;
    }
  }, []);

  // Mensaje para la pantalla LCD. Protocolo: "MSG:<texto>"
  const send = useCallback(
    (message: string) => writeLine("MSG:" + message),
    [writeLine],
  );

  // Comando del motor. Protocolo: "F" adelante, "B" atrás, "S" parar
  const sendCommand = useCallback(
    (cmd: "F" | "B" | "S") => writeLine("CMD:" + cmd),
    [writeLine],
  );

  const disconnect = useCallback(async () => {
    await cleanup();
    setError(null);
  }, [cleanup]);

  const clearIncoming = useCallback(() => {
    setIncoming([]);
    setLastLine("");
  }, []);

  // Cierra el puerto si el componente se desmonta.
  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  return {
    supported,
    connected,
    error,
    lastLine,
    incoming,
    connect,
    send,
    sendCommand,
    disconnect,
    clearIncoming,
  };
}
