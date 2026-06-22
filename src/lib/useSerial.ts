import { useCallback, useRef, useState } from "react";

/**
 * Minimal Web Serial typings (self-contained so the build never depends on
 * ambient DOM serial types being present).
 */
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable: WritableStream<Uint8Array> | null;
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
}
function getSerial(): SerialLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as { serial?: SerialLike };
  return nav.serial ?? null;
}

/**
 * Hook to talk to an Arduino over USB using the Web Serial API.
 * Works in Chrome/Edge over HTTPS. Sends a line of text the Arduino
 * can read with Serial.readStringUntil('\n') and print on the QAPASS LCD.
 */
export function useSerial() {
  const portRef = useRef<SerialPortLike | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(
    null,
  );
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = getSerial() !== null;

  const connect = useCallback(async () => {
    setError(null);
    const serial = getSerial();
    if (!serial) {
      setError(
        "Tu navegador no soporta Web Serial. Usa Chrome o Edge en escritorio.",
      );
      return false;
    }
    try {
      const port = await serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      const writer = port.writable?.getWriter() ?? null;
      writerRef.current = writer;
      setConnected(true);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo conectar al carro.",
      );
      setConnected(false);
      return false;
    }
  }, []);

  const writeLine = useCallback(async (line: string) => {
    if (!writerRef.current) {
      setError("No hay un carro conectado.");
      return false;
    }
    try {
      const data = new TextEncoder().encode(line + "\n");
      await writerRef.current.write(data);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar.");
      return false;
    }
  }, []);

  // Send a text message to the LCD. Protocol: "MSG:<text>"
  const send = useCallback(
    (message: string) => writeLine("MSG:" + message),
    [writeLine],
  );

  // Send a motor command. Protocol: "F" forward, "B" backward, "S" stop
  const sendCommand = useCallback(
    (cmd: "F" | "B" | "S") => writeLine("CMD:" + cmd),
    [writeLine],
  );

  const disconnect = useCallback(async () => {
    try {
      writerRef.current?.releaseLock();
      writerRef.current = null;
      await portRef.current?.close();
      portRef.current = null;
    } catch {
      // ignore
    }
    setConnected(false);
  }, []);

  return { supported, connected, error, connect, send, sendCommand, disconnect };
}
