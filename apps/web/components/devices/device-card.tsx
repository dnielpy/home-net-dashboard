"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import type { Device, DeviceAction } from "@/lib/api";
import { formatBytes } from "@/lib/bytes-format";
import { formatDateTime, formatElapsed } from "@/lib/outage-format";
import { formatKbs } from "@/lib/speed-format";

type Editing = "none" | "limit" | "name";

export function deviceLabel(device: Device): string {
  return device.name || "Unknown device";
}

async function sendAction(mac: string, action: DeviceAction, body: unknown): Promise<Device> {
  const response = await fetch(`/api/devices/${encodeURIComponent(mac)}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null))?.detail;
    throw new Error(typeof detail === "string" ? detail : `The router did not accept it (${response.status})`);
  }
  return response.json();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-zinc-900 tabular-nums dark:text-zinc-50">{value}</dd>
    </div>
  );
}

function Badge({ tone, children }: { tone: "red" | "amber"; children: string }) {
  const colors =
    tone === "red"
      ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
      : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${colors}`}>{children}</span>;
}

const buttonClass =
  "rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";
const primaryButtonClass =
  "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";
const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 tabular-nums outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function limitText(device: Device): string | null {
  const parts = [
    device.limit_down_kbs ? `↓ ${formatKbs(device.limit_down_kbs)}` : null,
    device.limit_up_kbs ? `↑ ${formatKbs(device.limit_up_kbs)}` : null,
  ].filter(Boolean);
  return parts.length ? `Limit ${parts.join(" ")}` : null;
}

type DeviceCardProps = {
  device: Device;
  /** When the device was read, to show how long it has been connected. */
  now: number;
  onChange: (device: Device) => void;
};

export function DeviceCard({ device, now, onChange }: DeviceCardProps) {
  const [editing, setEditing] = useState<Editing>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: DeviceAction, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      onChange(await sendAction(device.mac, action, body));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleInternet() {
    if (!device.blocked && !window.confirm(`Cut internet to ${deviceLabel(device)}?`)) return;
    await run("block", { blocked: !device.blocked });
  }

  async function saveLimit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => Math.max(0, Math.round(Number(form.get(key)) || 0));
    if (await run("limit", { down_kbs: value("down"), up_kbs: value("up") })) setEditing("none");
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (name && (await run("name", { name }))) setEditing("none");
  }

  const limit = limitText(device);

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${device.online ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`}
            />
            <Link
              href={`/devices/${encodeURIComponent(device.mac)}`}
              className="truncate font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
            >
              {deviceLabel(device)}
            </Link>
            <span className="sr-only">{device.online ? "online" : "offline"}</span>
            {device.blocked && <Badge tone="red">No internet</Badge>}
            {limit && <Badge tone="amber">{limit}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            {device.ip ?? "No IP"} · {device.mac}
          </p>
        </div>

        {device.in_router && (
          <div className="flex shrink-0 items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span aria-hidden className="hidden sm:inline">
              Internet
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!device.blocked}
              aria-label={`Internet for ${deviceLabel(device)}`}
              disabled={busy}
              onClick={toggleInternet}
              className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                device.blocked ? "bg-zinc-300 dark:bg-zinc-700" : "bg-emerald-500"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${
                  device.blocked ? "left-0.5" : "left-[1.375rem]"
                }`}
              />
            </button>
          </div>
        )}
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Download" value={device.online ? formatKbs(device.down_kbs) : "—"} />
        <Stat label="Upload" value={device.online ? formatKbs(device.up_kbs) : "—"} />
        <Stat
          label={device.online ? "Connected for" : "Last seen"}
          value={
            device.online && device.connected_since
              ? formatElapsed(now - Date.parse(device.connected_since))
              : device.last_seen
                ? formatDateTime(device.last_seen)
                : "—"
          }
        />
        <Stat
          label="Used in 24 h"
          value={`↓ ${formatBytes(device.usage_24h_down_bytes)} · ↑ ${formatBytes(device.usage_24h_up_bytes)}`}
        />
      </dl>

      {device.in_router && editing === "none" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={busy} onClick={() => setEditing("limit")}>
            Limit speed
          </button>
          <button type="button" className={buttonClass} disabled={busy} onClick={() => setEditing("name")}>
            Rename
          </button>
        </div>
      )}

      {editing === "limit" && (
        <form onSubmit={saveLimit} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs text-zinc-500 dark:text-zinc-400">
            Download limit (KB/s)
            <input
              name="down"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={device.limit_down_kbs || ""}
              placeholder="Unlimited"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="flex-1 text-xs text-zinc-500 dark:text-zinc-400">
            Upload limit (KB/s)
            <input
              name="up"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={device.limit_up_kbs || ""}
              placeholder="Unlimited"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={primaryButtonClass} disabled={busy}>
              Save
            </button>
            <button type="button" className={buttonClass} disabled={busy} onClick={() => setEditing("none")}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {editing === "name" && (
        <form onSubmit={saveName} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs text-zinc-500 dark:text-zinc-400">
            Name in the router
            <input
              name="name"
              type="text"
              required
              maxLength={32}
              defaultValue={device.name}
              autoFocus
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={primaryButtonClass} disabled={busy}>
              Save
            </button>
            <button type="button" className={buttonClass} disabled={busy} onClick={() => setEditing("none")}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </article>
  );
}
