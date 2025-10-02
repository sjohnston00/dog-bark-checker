import {
  addMinutes,
  isAfter,
  isBefore,
  isSameMinute,
  startOfMinute,
} from "date-fns";
import type { Detection } from "~/types/db";

export type DetectionConfidenceLevelData = {
  label: "Low" | "Medium" | "High";
  min: number;
  max: number;
  detections: Detection[];
};

export function groupDetectionsByConfidenceLevel(detections: Detection[]) {
  const confidenceLevels: DetectionConfidenceLevelData[] = [
    { label: "Low", min: 0.0, max: 0.3, detections: [] },
    {
      label: "Medium",
      min: 0.3,
      max: 0.7,
      detections: [],
    },
    {
      label: "High",
      min: 0.7,
      max: 1.0,
      detections: [],
    },
  ];

  for (let index = 0; index < confidenceLevels.length; index++) {
    const cl = confidenceLevels[index];
    cl.detections = detections.filter((d) =>
      d.confidence >= cl.min && d.confidence < cl.max
    );
  }

  return confidenceLevels;
}

export type AggregatedByMinuteDetection = {
  minute: Date;
  count: number;
};

export function aggregateByDetectionsMinute(
  detections: Detection[],
  startDate: Date,
  endDate: Date,
): AggregatedByMinuteDetection[] {
  // Initialize all minutes in the range with zero values
  let current = startOfMinute(startDate);

  console.log("Aggregating from", current, "to", endDate);
  console.log("Total detections:", detections.length);

  const result: AggregatedByMinuteDetection[] = [];
  let aggregationCounter = 0;
  while (current <= endDate) {
    const count = detections.filter((d) =>
      isSameMinute(new Date(d.created_at), current)
    ).length;
    result.push({
      minute: current,
      count: count,
    });

    aggregationCounter += count;
    current = addMinutes(current, 1);
  }

  console.log("Aggregated total count:", aggregationCounter);

  // // Aggregate the actual data
  // detections.forEach((d) => {
  //   if (d.created_at >= startDate && d.created_at <= endDate) {
  //     // Round down to the minute
  //     const minuteDate = new Date(d.created_at);
  //     minuteDate.setSeconds(0, 0);
  //     const minuteKey = minuteDate.toISOString();

  //     const existing = minuteMap.get(minuteKey);
  //     if (existing) {
  //       existing.count += 1;
  //     }
  //   }
  // });

  // Sort by minute (should already be sorted, but being explicit)
  return result.sort((a, b) => a.minute.getTime() - b.minute.getTime());
}

export function findBiggestGap(records: Detection[]) {
  if (records.length < 2) return null;

  // Sort records by timestamp
  const sorted = [...records].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  let maxGap = 0;
  let gapInfo: {
    prev: Detection;
    current: Detection;
    gapMs: number;
  } | null = null;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gapMs = new Date(curr.created_at).getTime() -
      new Date(prev.created_at).getTime();

    if (gapMs > maxGap) {
      maxGap = gapMs;
      gapInfo = { prev, current: curr, gapMs };
    }
  }

  return gapInfo;
}
