const NOISE_FILTERS = [
  "Bad MAC",
  "Session error:",
  "Closing session:",
  "Closing open session",
  "Removing old closed session",
  "closing stale connection",
  "Failed to decrypt message with any known session",
  "failed to decrypt message",
  "Decrypted message with closed session",
  "error in handling message",
  "init queries",
];

export function installConsoleFilter(): void {
  const origError = console.error.bind(console);
  const origInfo = console.info.bind(console);
  const origWarn = console.warn.bind(console);
  const origLog = console.log.bind(console);

  const shouldSuppress = (text: string) => NOISE_FILTERS.some((f) => text.includes(f));

  console.error = (...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ");
    if (shouldSuppress(text)) return;
    origError(...args);
  };
  console.info = (...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ");
    if (shouldSuppress(text)) return;
    origInfo(...args);
  };
  console.warn = (...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ");
    if (shouldSuppress(text)) return;
    origWarn(...args);
  };
  console.log = (...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ");
    if (shouldSuppress(text)) return;
    origLog(...args);
  };
}
