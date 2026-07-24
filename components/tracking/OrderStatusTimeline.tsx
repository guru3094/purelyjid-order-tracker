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

function normalizeStatus(
  status: string | null
): string {
  return (
    status
      ?.trim()
      .toUpperCase()
      .replaceAll(" ", "_")
      .replaceAll("-", "_") ?? ""
  );
}

function formatStatusLabel(
  status: string | null
): string {
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
  const normalizedStatus =
    normalizeStatus(currentStatus);

  const currentStageIndex =
    TIMELINE_STAGES.findIndex(
      (stage) =>
        stage.code === normalizedStatus
    );

  if (currentStageIndex === -1) {
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
      {TIMELINE_STAGES.map(
        (stage, index) => {
          const completed =
            index < currentStageIndex;

          const current =
            index === currentStageIndex;

          const active =
            completed || current;

          const isLast =
            index ===
            TIMELINE_STAGES.length - 1;

          return (
            <li
              key={stage.code}
              className="relative flex gap-4"
            >
              {!isLast && (
                <div
                  className={`absolute left-[11px] top-6 h-full w-0.5 ${
                    completed
                      ? "bg-emerald-500"
                      : "bg-slate-200"
                  }`}
                />
              )}

              <div
                className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  completed
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : current
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-300 bg-white text-slate-400"
                }`}
              >
                {completed ? "✓" : index + 1}
              </div>

              <div className="min-h-16 pb-5">
                <p
                  className={`text-sm font-semibold ${
                    active
                      ? "text-slate-950"
                      : "text-slate-400"
                  }`}
                >
                  {stage.label}
                </p>

                {current && (
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Current status
                  </p>
                )}
              </div>
            </li>
          );
        }
      )}
    </ol>
  );
}
