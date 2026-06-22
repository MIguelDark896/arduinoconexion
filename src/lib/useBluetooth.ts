import { useCallback, useRef, useState } from "react";

interface BluetoothRemoteGATTCharacteristic {
  writeValue(value: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(
    characteristic: string | number,
  ): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(
    service: string | number,
  ): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice extends EventTarget {
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
}

interface Bluetooth {
  requestDevice(options: any): Promise<BluetoothDevice>;
}

function getBluetooth(): Bluetooth | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as { bluetooth?: Bluetooth };
  return nav.bluetooth ?? null;
}

export function useBluetooth() {
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const characteristicRef =
    useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = getBluetooth() !== null;

  const onDisconnected = useCallback(() => {
    setConnected(false);
    deviceRef.current = null;
    characteristicRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    const bluetooth = getBluetooth();
    if (!bluetooth) {
      setError(
        "Tu navegador no soporta Web Bluetooth. Usa Chrome o Edge en escritorio/Android.",
      );
      return false;
    }
    try {
      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [0xffe0, "6e400001-b5a3-f393-e0a9-e50e24dcca9e"],
      });

      deviceRef.current = device;
      device.addEventListener("gattserverdisconnected", onDisconnected);

      const server = await device.gatt?.connect();
      if (!server) throw new Error("No se pudo conectar al servidor GATT");

      let service, characteristic;
      try {
        service = await server.getPrimaryService(0xffe0);
        characteristic = await service.getCharacteristic(0xffe1);
      } catch (e) {
        service = await server.getPrimaryService(
          "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
        );
        characteristic = await service.getCharacteristic(
          "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
        );
      }

      characteristicRef.current = characteristic;
      setConnected(true);
      return true;
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "Error de conexión Bluetooth.",
      );
      setConnected(false);
      return false;
    }
  }, [onDisconnected]);

  const writeLine = useCallback(async (line: string) => {
    if (!characteristicRef.current) {
      setError("No hay un dispositivo Bluetooth conectado.");
      return false;
    }
    try {
      const data = new TextEncoder().encode(line + "\n");
      await characteristicRef.current.writeValue(data);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error al enviar por Bluetooth.",
      );
      return false;
    }
  }, []);

  const send = useCallback(
    (message: string) => writeLine("MSG:" + message),
    [writeLine],
  );

  const sendCommand = useCallback(
    (cmd: "F" | "B" | "S") => writeLine("CMD:" + cmd),
    [writeLine],
  );

  const disconnect = useCallback(async () => {
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect();
    }
    onDisconnected();
  }, [onDisconnected]);

  return {
    supported,
    connected,
    error,
    connect,
    send,
    sendCommand,
    disconnect,
  };
}
