import type { BandwidthBucket } from "@/lib/api";

export const BUCKET_LABELS: Record<BandwidthBucket, string> = { "10min": "10 minutes", hour: "hour", day: "day" };

// Keeps every range between 6 and 72 points
export function bucketFor(hours: number): BandwidthBucket {
  if (hours <= 6) return "10min";
  return hours <= 72 ? "hour" : "day";
}
