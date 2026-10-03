import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../../lib/api";
import type { UsageLimits } from "../../lib/types";
import { ErrorNote } from "./ui";

const MB = 1024 * 1024;
const AREA_LABEL = { "project-files": "Project photos & files", "quote-uploads": "Inquiry uploads" };

function fmtSize(bytes: number) {
  return bytes >= 1024 * MB ? `${(bytes / 1024 / MB).toFixed(2)} GB` : `${(bytes / MB).toFixed(1)} MB`;
}

function Meter({ label, used, limitMb, detail }: { label: string; used: number; limitMb: number; detail?: string }) {
  const pct = (used / (limitMb * MB)) * 100;
  const level = pct >= 90 ? "error" : pct >= 75 ? "warn" : "ok";
  return (
    <div className="meter">
      <div className="meter-head">
        <strong>{label}</strong>
        <span>
          {fmtSize(used)} of {fmtSize(limitMb * MB)} <small className="muted">({pct < 1 && pct > 0 ? "<1" : Math.round(pct)}%)</small>
        </span>
      </div>
      <div className="meter-bar" role="meter" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span className={`meter-${level}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {detail && <small className="muted">{detail}</small>}
    </div>
  );
}

/** Owner-only: files (in Cloudflare R2) and database (Supabase) in use against the plans' limits. */
export function SpaceUsed() {
  const qc = useQueryClient();
  // Refreshed every 10 minutes while the page is open; the numbers move slowly.
  const used = useQuery({ queryKey: ["space-used"], queryFn: api.fetchSpaceUsed, refetchInterval: 10 * 60 * 1000 });
  const fileUsage = useQuery({ queryKey: ["file-usage"], queryFn: api.fetchFileUsage, refetchInterval: 10 * 60 * 1000 });
  const limits = useQuery({ queryKey: ["usage-limits"], queryFn: api.fetchUsageLimits });
  const [editing, setEditing] = useState<UsageLimits | null>(null);
  const save = useMutation({
    mutationFn: () => api.saveUsageLimits(editing!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usage-limits"] });
      setEditing(null);
    },
  });

  const areas = fileUsage.data?.areas ?? [];
  const storageBytes = areas.reduce((sum, a) => sum + a.bytes, 0);
  const files = areas.reduce((sum, a) => sum + a.files, 0);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Space used</h2>
        {limits.data && !editing && (
          <button className="link-btn small" onClick={() => setEditing(limits.data)}>
            Change limits
          </button>
        )}
      </div>
      {used.data && fileUsage.data && limits.data ? (
        <>
          <Meter
            label="Files (Cloudflare R2)"
            used={storageBytes}
            limitMb={limits.data.storage_limit_mb}
            detail={[
              `${files} file${files === 1 ? "" : "s"}`,
              ...areas.filter((a) => a.files > 0).map((a) => `${AREA_LABEL[a.area]} ${fmtSize(a.bytes)}`),
            ].join(" · ")}
          />
          <Meter label="Database" used={Number(used.data.database_bytes)} limitMb={limits.data.database_limit_mb} />
        </>
      ) : (
        <p className="muted">{used.isLoading || fileUsage.isLoading || limits.isLoading ? "Loading…" : null}</p>
      )}
      {editing && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <p className="muted small">
            Files: Cloudflare R2 includes 10240 MB free, then about $0.015 per GB each month, so set this to what you're
            happy to pay for (e.g. 30720 MB ≈ $0.30/month). Database: Supabase Free is 500 MB, Pro is 8192 MB.
          </p>
          <div className="grid-2 tight">
            <label>
              Files limit (MB)
              <input type="number" min={1} required value={editing.storage_limit_mb} onChange={(e) => setEditing({ ...editing, storage_limit_mb: Number(e.target.value) })} />
            </label>
            <label>
              Database limit (MB)
              <input type="number" min={1} required value={editing.database_limit_mb} onChange={(e) => setEditing({ ...editing, database_limit_mb: Number(e.target.value) })} />
            </label>
          </div>
          <div className="btn-row">
            <button className="btn primary" disabled={save.isPending}>
              Save
            </button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <ErrorNote error={used.error ?? fileUsage.error ?? limits.error ?? save.error} />
    </section>
  );
}
