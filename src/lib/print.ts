// ---------------------------------------------------------------------------
// P2 / Slice B5 — mock print pipeline.
//
// The call site (the PATCH status route) only ever talks to the PrintQueue
// interface, never to hardware. Swap ConsolePrinter for an Epson TM
// ESC/POS-over-LAN or SUNMI cloud adapter in P6 WITHOUT touching the route.
// Keep this file free of `pg`/hardware imports so it stays trivially testable.
// ---------------------------------------------------------------------------

export type PrintLine = {
  name: string;
  quantity: number;
  options: string[]; // e.g. ["少冰", "微糖"]
};

export type PrintJob = {
  orderPublicId: string;
  tableLabel: string | null; // null for non-dine-in sources
  source: string;
  lines: PrintLine[];
  total: number;
};

export interface PrintQueue {
  enqueue(job: PrintJob): Promise<void>;
}

// Default dev implementation: log the ticket to the server console.
export class ConsolePrinter implements PrintQueue {
  async enqueue(job: PrintJob): Promise<void> {
    const where = job.tableLabel ? `桌號 ${job.tableLabel}` : job.source;
    const body = job.lines
      .map(
        (l) =>
          `   ${l.quantity}x ${l.name}` +
          (l.options.length ? ` (${l.options.join(", ")})` : ""),
      )
      .join("\n");
    console.log(
      `🧾 KITCHEN TICKET  order=${job.orderPublicId}  ${where}\n${body}\n   TOTAL ${job.total}`,
    );
  }
}

// Module-level singleton. In P6 this becomes a durable queue (DB table /
// BullMQ) so a printer outage doesn't drop tickets.
let queue: PrintQueue = new ConsolePrinter();

export function getPrintQueue(): PrintQueue {
  return queue;
}

// Lets tests (or a future bootstrap) inject a different adapter.
export function setPrintQueue(next: PrintQueue): void {
  queue = next;
}
