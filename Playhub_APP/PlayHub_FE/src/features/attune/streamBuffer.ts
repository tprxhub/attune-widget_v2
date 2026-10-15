/** Coalesces tiny streamed fragments so React renders a reply at most once per frame window. */
export function createStreamBuffer(
  onFlush: (text: string) => void,
  schedule: (callback: () => void) => unknown = (callback) => setTimeout(callback, 32),
  cancel: (handle: unknown) => void = (handle) =>
    clearTimeout(handle as ReturnType<typeof setTimeout>),
) {
  let pending = "";
  let timer: unknown;
  let scheduled = false;

  const flush = () => {
    if (scheduled) cancel(timer);
    scheduled = false;
    const text = pending;
    pending = "";
    if (text) onFlush(text);
  };

  return {
    push(text: string) {
      pending += text;
      if (scheduled) return;
      scheduled = true;
      timer = schedule(() => {
        scheduled = false;
        const chunk = pending;
        pending = "";
        if (chunk) onFlush(chunk);
      });
    },
    flush,
    cancel() {
      if (scheduled) cancel(timer);
      scheduled = false;
      pending = "";
    },
  };
}
