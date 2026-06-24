import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Send,
  Copy,
  Check,
  Rocket,
  Car,
  Usb,
  Wifi,
  WifiOff,
  ChevronUp,
  ChevronDown,
  Square,
  Terminal,
  Trash2,
  AlertTriangle,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import Car3D, { type MotorState } from "@/components/Car3D";
import { useSerial } from "@/lib/useSerial";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Carro LED 3D — Envía tu mensaje" },
      {
        name: "description",
        content:
          "Escribe una palabra y mírala en un carro 3D girable con pantalla LED estilo QAPASS. Modo demo o conexión real al Arduino.",
      },
      { property: "og:title", content: "Carro LED 3D — Envía tu mensaje" },
      {
        property: "og:description",
        content:
          "Carro 3D 360° con pantalla LED. Modo demo o conexión real al Arduino vía USB.",
      },
    ],
  }),
  component: Index,
});

type Mode = "demo" | "real";

function Index() {
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState("HOLA");
  const [word, setWord] = useState("HOLA");
  const [launching, setLaunching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<Mode>("demo");
  const [motor, setMotor] = useState<MotorState>("stop");

  const serial = useSerial();

  useEffect(() => setMounted(true), []);

  const message = word.toUpperCase().slice(0, 16);

  async function handleMotor(state: MotorState) {
    setMotor(state);
    if (mode === "real") {
      if (!serial.connected) {
        const ok = await serial.connect();
        if (!ok) {
          toast.error(serial.error ?? "No se pudo conectar al carro.");
          return;
        }
      }
      const cmd = state === "forward" ? "F" : state === "backward" ? "B" : "S";
      const sent = await serial.sendCommand(cmd);
      if (!sent) toast.error(serial.error ?? "Error al enviar el comando.");
    }
  }


  async function handleSend() {
    const value = draft.trim();
    if (!value) {
      toast.error("Escribe una palabra primero.");
      return;
    }
    setWord(value);
    setLaunching(false);

    if (mode === "real") {
      if (!serial.connected) {
        const ok = await serial.connect();
        if (!ok) {
          toast.error(serial.error ?? "No se pudo conectar al carro.");
          return;
        }
      }
      const sent = await serial.send(value.toUpperCase().slice(0, 16));
      if (sent) toast.success("Mensaje enviado al carro real 🚗");
      else toast.error(serial.error ?? "Error al enviar.");
    } else {
      toast.success("Mensaje cargado en la pantalla (modo demo).");
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Mensaje copiado.");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  function handleLaunch() {
    if (launching) return;
    setLaunching(true);
    toast("¡El carro arrancó! 💨");
  }

  function handleLaunchComplete() {
    // car has disappeared; nothing else needed
  }

  async function handleConnect() {
    if (serial.connected) {
      await serial.disconnect();
      toast("Arduino desconectado.");
      return;
    }
    const ok = await serial.connect();
    if (ok) toast.success("Arduino conectado por USB 🔌");
    else toast.error(serial.error ?? "No se pudo conectar al Arduino.");
  }

  return (
    <main className="min-h-screen bg-stage">
      <Toaster position="top-center" />
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <header className="text-center">
          <h1 className="text-3xl font-extrabold tracking-widest text-foreground sm:text-4xl">
            CARRO <span className="text-primary text-glow">LED</span> 3D
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Escribe una palabra y mírala en la pantalla del carro. Gíralo 360°.
          </p>
        </header>

        {/* Word input */}
        <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Palabra para la pantalla LED
          </label>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 16))}
            placeholder="Ej: HOLA MUNDO"
            maxLength={16}
            className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-lg uppercase tracking-widest text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {draft.length}/16
          </p>
        </div>

        {/* 3D stage */}
        <div className="relative h-[360px] overflow-hidden rounded-2xl border border-border bg-background/40 sm:h-[440px]">
          {mounted ? (
            <Car3D
              word={message}
              launching={launching}
              motor={motor}
              onLaunchComplete={handleLaunchComplete}
            />

          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Cargando escena 3D…
            </div>
          )}
          {launching && (
            <button
              onClick={() => {
                setLaunching(false);
                setWord(message);
              }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-semibold text-foreground backdrop-blur transition hover:bg-card"
            >
              Traer el carro de vuelta
            </button>
          )}
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-card/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
            Arrastra para girar 360°
          </span>
        </div>

        {/* The 3 controls */}
        <div className="flex flex-col gap-3">
          {/* 1. Enviar mensaje */}
          <button
            onClick={handleSend}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-base font-bold uppercase tracking-wider text-primary-foreground transition glow-primary hover:brightness-110 active:scale-[0.99]"
          >
            <Send className="h-5 w-5" />
            Enviar mensaje
          </button>

          {/* 2. Copiar mensaje */}
          <div className="flex items-stretch gap-2 rounded-xl border border-border bg-card/60 p-2 backdrop-blur">
            <input
              readOnly
              value={message}
              className="w-full bg-transparent px-3 text-base uppercase tracking-widest text-foreground outline-none"
            />
            <button
              onClick={handleCopy}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80"
            >
              {copied ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>

          {/* 3. Activar carro */}
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="flex items-center justify-center gap-2 rounded-xl border border-accent bg-accent/10 px-5 py-3.5 text-base font-bold uppercase tracking-wider text-accent transition hover:bg-accent/20 disabled:opacity-50"
          >
            <Rocket className="h-5 w-5" />
            {launching ? "Carro en marcha…" : "Activar carro"}
          </button>
        </div>

        {/* Motor control */}
        <div className="rounded-2xl border border-border bg-card/40 p-4 backdrop-blur">
          <span className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Control del motor {mode === "real" ? "(envía al Arduino)" : "(simulación)"}
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleMotor("forward")}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-xs font-bold uppercase tracking-wider transition ${
                motor === "forward"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <ChevronUp className="h-5 w-5" />
              Adelante
            </button>
            <button
              onClick={() => handleMotor("stop")}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-xs font-bold uppercase tracking-wider transition ${
                motor === "stop"
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Square className="h-5 w-5" />
              Parar
            </button>
            <button
              onClick={() => handleMotor("backward")}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-xs font-bold uppercase tracking-wider transition ${
                motor === "backward"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <ChevronDown className="h-5 w-5" />
              Atrás
            </button>
          </div>
        </div>


        {/* Mode switch */}
        <div className="mt-2 rounded-2xl border border-border bg-card/40 p-4 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Car className="h-4 w-4 text-primary" />
              Modo de funcionamiento
            </span>
            {mode === "real" ? (
              serial.connected ? (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Wifi className="h-3.5 w-3.5" /> Conectado por USB
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <WifiOff className="h-3.5 w-3.5" /> Sin conexión
                </span>
              )
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("demo")}
              className={`rounded-xl border px-4 py-3 text-sm font-bold uppercase tracking-wider transition ${
                mode === "demo"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              Demo
            </button>
            <button
              onClick={() => setMode("real")}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold uppercase tracking-wider transition ${
                mode === "real"
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Usb className="h-4 w-4" />
              Real
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {mode === "demo"
              ? "Modo demo: todo ocurre en la simulación 3D, sin hardware."
              : "Modo real: conecta tu Arduino Uno por cable USB y envía la palabra a la pantalla QAPASS (9600 baudios). Requiere Chrome o Edge de escritorio."}
          </p>

          {mode === "real" && (
            <div className="mt-4 space-y-3">
              {/* Aviso de navegador incompatible */}
              {!serial.supported && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Tu navegador no es compatible con la Web Serial API. Abre la
                    app en Google Chrome o Microsoft Edge de escritorio para
                    conectar el Arduino por USB.
                  </span>
                </div>
              )}

              {/* Botón principal de conexión USB */}
              <button
                onClick={handleConnect}
                disabled={!serial.supported}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  serial.connected
                    ? "border border-destructive/60 text-destructive hover:bg-destructive/10"
                    : "bg-accent text-accent-foreground glow-primary hover:brightness-110 active:scale-[0.99]"
                }`}
              >
                {serial.connected ? (
                  <>
                    <Unplug className="h-5 w-5" />
                    Desconectar Arduino
                  </>
                ) : (
                  <>
                    <Usb className="h-5 w-5" />
                    Conectar Arduino (USB)
                  </>
                )}
              </button>

              {/* Error de conexión */}
              {serial.error && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {serial.error}
                </p>
              )}

              {/* Monitor serie en tiempo real */}
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Terminal className="h-3.5 w-3.5" />
                    Datos del Arduino (en vivo)
                  </span>
                  <button
                    onClick={serial.clearIncoming}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                    Limpiar
                  </button>
                </div>
                <div className="h-28 overflow-y-auto rounded-lg bg-black/40 p-2 font-mono text-xs text-primary">
                  {serial.incoming.length === 0 ? (
                    <span className="text-muted-foreground">
                      {serial.connected
                        ? "Esperando datos del Arduino…"
                        : "Conecta el Arduino para ver los datos entrantes."}
                    </span>
                  ) : (
                    serial.incoming.map((line, i) => (
                      <div key={i} className="whitespace-pre-wrap break-words">
                        <span className="text-muted-foreground">›</span> {line}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>


        <footer className="pb-6 text-center text-xs text-muted-foreground">
          Gira el carro arrastrando · pantalla LED tipo QAPASS · 360°
        </footer>
      </div>
    </main>
  );
}
