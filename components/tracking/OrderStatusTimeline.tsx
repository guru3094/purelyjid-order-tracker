interface OrderStatusTimelineProps {
  currentStatus: string | null;
}

interface TimelineStage {
  code: string;
  label: string;
}

const TIMELINE_STAGES: TimelineStage[] = [
  {
    code: "ORDER_RECEIVED",
    label: "Order received",
  },
  {
    code: "ORDER_CONFIRMED",
    label: "Order confirmed",
  },
  {
    code: "PROCESSING",
    label: "Processing",
  },
  {
    code: "SHIPPED",
    label: "Shipped",
  },
  {
    code: "OUT_FOR_DELIVERY",
    label: "Out for delivery",
  },
  {
    code: "DELIVERED",
    label: "Delivered",
  },
];

/*
 * Maps every operational status to one of the six customer-facing
 * tracking stages. Add future Google Sheet statuses here without
 * changing the six progress items shown to the customer.
 */
const STATUS_TO_STAGE_INDEX: Record<string, number> = {
  // Stage 1: Order received
  ORDER_RECEIVED: 0,
  PAYMENT_PENDING: 0,
  PHOTO_PENDING: 0,

  // Stage 2: Order confirmed
  PREPARING: 1,
  ORDER_CONFIRMED: 1,
  PHOTO_RECEIVED: 1,
  DESIGN_APPROVAL_PENDING: 1,
  CUSTOMER_APPROVAL_PENDING: 1,
  DESIGN_APPROVED: 1,

  // Stage 3: Processing
  PROCESSING: 2,
  PACKED: 2,
  READY_FOR_PICKUP: 2,
  DESIGN_IN_PROGRESS: 2,
  DEHYDRATION_IN_PROGRESS: 2,
  PRODUCTION_IN_PROGRESS: 2,
  RESIN_CASTING_IN_PROGRESS: 2,
  FINISHING_IN_PROGRESS: 2,
  QUALITY_CHECK: 2,
  PACKAGING_IN_PROGRESS: 2,

  // Stage 4: Shipped
  SHIPPED: 3,
  READY_FOR_DISPATCH: 3,
  DISPATCHED: 3,

  // Stage 5: Out for delivery
  OUT_FOR_DELIVERY: 4,
  READY_FOR_DELIVERY: 4,

  // Stage 6: Delivered / completed
  DELIVERED: 5,
  PICKED_UP: 5,
  COMPLETED: 5,
};

const EXCEPTION_STATUSES = new Set([
  "CANCELLED",
  "ON_HOLD",
  "DELAYED",
  "RETURNED",
]);

function normalizeStatus(status: string | null): string {
  return (
    status
      ?.trim()
      .toUpperCase()
      .replaceAll(" ", "_")
      .replaceAll("-", "_") ?? ""
  );
}

function formatStatusLabel(status: string | null): string {
  if (!status) {
    return "Status not available";
  }

  return status
    .trim()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

export default function OrderStatusTimeline({
  currentStatus,
}: OrderStatusTimelineProps) {
  const normalizedStatus = normalizeStatus(currentStatus);
  const currentStageIndex =
    STATUS_TO_STAGE_INDEX[normalizedStatus];

  if (EXCEPTION_STATUSES.has(normalizedStatus)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-950">
          Current status
        </p>

        <p className="mt-2 text-sm text-amber-800">
          {formatStatusLabel(currentStatus)}
        </p>

        <p className="mt-2 text-xs leading-5 text-amber-700">
          Please refer to the order remarks for more details.
        </p>
      </div>
    );
  }

  if (currentStageIndex === undefined) {
    return (
      <div className="rounded-2xl bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-900">
          Current status
        </p>

        <p className="mt-2 text-sm text-slate-600">
          {formatStatusLabel(currentStatus)}
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {TIMELINE_STAGES.map((stage, index) => {
        const checked = index <= currentStageIndex;
        const current = index === currentStageIndex;
        const connectorCompleted = index < currentStageIndex;
        const isLast = index === TIMELINE_STAGES.length - 1;

        return (
          <li
            key={stage.code}
            className="relative flex gap-4"
          >
            {!isLast && (
              <div
                className={`absolute left-[11px] top-6 h-full w-0.5 ${
                  connectorCompleted
                    ? "bg-emerald-500"
                    : "bg-slate-200"
                }`}
              />
            )}

            <div
              className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                checked
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-300 bg-white text-slate-400"
              } ${
                current
                  ? "ring-4 ring-emerald-100"
                  : ""
              }`}
            >
              {checked ? "✓" : index + 1}
            </div>

            <div className="min-h-16 pb-5">
              <p
                className={`text-sm font-semibold ${
                  checked
                    ? "text-slate-950"
                    : "text-slate-400"
                }`}
              >
                {stage.label}
              </p>

              {current && (
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  Current status: {formatStatusLabel(currentStatus)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
