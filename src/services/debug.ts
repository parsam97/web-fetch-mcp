const enabled = !!process.env.DEBUG;
const start = Date.now();

export function debug(msg: string): void {
  if (enabled) console.error(`[DEBUG +${Date.now() - start}ms] ${msg}`);
}
