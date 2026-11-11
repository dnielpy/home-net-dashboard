import { SpeedTestCard } from "@/components/live-cards/speed-test-card";
import type { LatestSpeedTest } from "@/lib/api";

/** Shown under the chain once a sweep reaches internet. Grows from zero height, which slides the chain up. */
export function LiveCards({ visible, speedTest }: { visible: boolean; speedTest: LatestSpeedTest | null }) {
  return (
    <div
      className={`grid w-full transition-[grid-template-rows,opacity] duration-700 ease-out ${
        visible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        {visible && (
          <div className="live-cards-in mx-auto max-w-2xl pt-2">
            <SpeedTestCard initialResult={speedTest} />
          </div>
        )}
      </div>
    </div>
  );
}
