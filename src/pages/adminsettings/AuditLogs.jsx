import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MainLayout from "../../layout/MainLayout";
import api from "../../api/axios";
import "./AuditLogs.css";

const AUDIT_FILTER_CACHE_KEY = "audit_log_filters";

function getTodayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCurrentSessionId() {
  try {
    const user = JSON.parse(sessionStorage.getItem("user") || "null");
    return user?.session_id || "";
  } catch {
    return "";
  }
}

function toCsv(rows) {
  const headers = [
    "created_at",
    "username",
    "role",
    "session_id",
    "event",
    "page",
    "ip_address",
    "user_agent",
    "details",
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [
      r.created_at,
      r.username,
      r.role,
      r.session_id,
      r.event,
      r.page,
      r.ip_address,
      r.user_agent,
      JSON.stringify(r.details || {}),
    ]
      .map(esc)
      .join(",")
  );
  return [headers.join(","), ...body].join("\n");
}

export default function AuditLogs() {
  const [, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    username: "",
    ip: "",
    from: getTodayYmd(),
    to: getTodayYmd(),
    limit: 30,
  });
  const [offset, setOffset] = useState(0);
  const [paging, setPaging] = useState({ total: 0, has_next: false });
  const [summaryCounts, setSummaryCounts] = useState({
    total: 0,
    login_success: 0,
    login_failed: 0,
    logout: 0,
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshSec, setRefreshSec] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [archiveInfo, setArchiveInfo] = useState({ found: false, file_path: "", log_date: "" });

  const fetchLogs = useCallback(async (nextOffset = offset, activeFilters = filters) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("limit", String(activeFilters.limit || 200));
      params.set("offset", String(nextOffset || 0));
      if (activeFilters.username.trim()) params.set("username", activeFilters.username.trim());
      if (activeFilters.ip.trim()) params.set("ip", activeFilters.ip.trim());
      if (activeFilters.from.trim()) params.set("from", activeFilters.from.trim());
      if (activeFilters.to.trim()) params.set("to", activeFilters.to.trim());

      setSearchParams(params, { replace: true });
      const res = await api.get(`/api/audit/logs?${params.toString()}`);
      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      setArchiveInfo({
        found: Boolean(res.data?.archive?.found),
        file_path: res.data?.archive?.file_path || "",
        log_date: res.data?.archive?.log_date || "",
      });
      setLogs(rows);
      setOffset(nextOffset || 0);
      const apiTotal = Number(res.data?.paging?.total);
      const fallbackTotal = (nextOffset || 0) + rows.length;
      setPaging({
        total: Number.isFinite(apiTotal) ? Math.max(apiTotal, fallbackTotal) : fallbackTotal,
        has_next:
          typeof res.data?.paging?.has_next === "boolean"
            ? res.data.paging.has_next
            : rows.length === 30,
      });
      setSummaryCounts({
        total: Number(res.data?.summary?.total || 0),
        login_success: Number(res.data?.summary?.login_success || 0),
        login_failed: Number(res.data?.summary?.login_failed || 0),
        logout: Number(res.data?.summary?.logout || 0),
      });
    } catch (err) {
      console.error("Fetch audit logs failed:", err);
      setError(err.response?.data?.message || "Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  }, [filters, offset, setSearchParams]);

  useEffect(() => {
    const currentSessionId = getCurrentSessionId();
    let restored = false;
    try {
      const raw = sessionStorage.getItem(AUDIT_FILTER_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.session_id && parsed.session_id === currentSessionId) {
        const nextFilters = {
          username: parsed.filters?.username || "",
          ip: parsed.filters?.ip || "",
          from: parsed.filters?.from || getTodayYmd(),
          to: parsed.filters?.to || getTodayYmd(),
          limit: 30,
        };
        const nextOffset = Number(parsed.offset || 0);
        setFilters(nextFilters);
        setOffset(nextOffset);
        restored = true;
        if ((nextFilters.username || "").trim()) {
          setTimeout(() => {
            fetchLogs(nextOffset, nextFilters);
          }, 0);
        } else {
          setLogs([]);
          setPaging({ total: 0, has_next: false });
          setSummaryCounts({
            total: 0,
            login_success: 0,
            login_failed: 0,
            logout: 0,
          });
        }
      }
    } catch (err) {
      console.warn("Failed to restore audit filter cache", err);
    }

    if (!restored) {
      setLogs([]);
      setPaging({ total: 0, has_next: false });
      setSummaryCounts({
        total: 0,
        login_success: 0,
        login_failed: 0,
        logout: 0,
      });
      setOffset(0);
    }
  }, []);

  useEffect(() => {
    if (!autoRefresh || logs.length === 0 || !filters.username.trim()) return;
    const timer = setInterval(() => {
      fetchLogs(offset, filters);
    }, Math.max(5, Number(refreshSec) || 10) * 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshSec, fetchLogs, offset, logs.length, filters]);

  const pageStats = useMemo(() => {
    const stats = {
      totalRows:
        Number(summaryCounts.total || 0) > 0
          ? Number(summaryCounts.total || 0)
          : Math.max(paging.total || 0, offset + logs.length),
      loginSuccess: Number(summaryCounts.login_success || 0),
      loginFailed: Number(summaryCounts.login_failed || 0),
      logout: Number(summaryCounts.logout || 0),
    };
    return stats;
  }, [summaryCounts, paging.total, offset, logs.length]);

  const currentPage = Math.floor(offset / filters.limit) + 1;
  const totalPages = Math.max(1, Math.ceil((paging.total || 0) / filters.limit));

  const exportCsv = async () => {
    try {
      setExporting(true);
      const chunkSize = 1000;
      let nextOffset = 0;
      let hasNext = true;
      const allRows = [];

      while (hasNext) {
        const params = new URLSearchParams();
        params.set("limit", String(chunkSize));
        params.set("offset", String(nextOffset));
        if (filters.username.trim()) params.set("username", filters.username.trim());
        if (filters.ip.trim()) params.set("ip", filters.ip.trim());
        if (filters.from.trim()) params.set("from", filters.from.trim());
        if (filters.to.trim()) params.set("to", filters.to.trim());

        const res = await api.get(`/api/audit/logs?${params.toString()}`);
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        allRows.push(...rows);

        if (typeof res.data?.paging?.has_next === "boolean") {
          hasNext = res.data.paging.has_next;
        } else {
          hasNext = rows.length === chunkSize;
        }
        nextOffset += chunkSize;
      }

      const csvRows = allRows.length ? allRows : logs;
      const csv = toCsv(csvRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export CSV failed:", err);
      alert("Failed to export full audit logs.");
    } finally {
      setExporting(false);
    }
  };

  const applyFilters = () => {
    const today = getTodayYmd();
    const normalizedFilters = {
      ...filters,
      from: filters.from?.trim() || today,
      to: filters.to?.trim() || today,
      limit: 30,
    };

    if (!normalizedFilters.username.trim()) {
      setFilters(normalizedFilters);
      setOffset(0);
      setLogs([]);
      setPaging({ total: 0, has_next: false });
      setSummaryCounts({
        total: 0,
        login_success: 0,
        login_failed: 0,
        logout: 0,
      });
      setError("Enter username and click Apply.");
      const payload = {
        session_id: getCurrentSessionId(),
        offset: 0,
        filters: {
          username: "",
          ip: normalizedFilters.ip || "",
          from: normalizedFilters.from || "",
          to: normalizedFilters.to || "",
        },
      };
      sessionStorage.setItem(AUDIT_FILTER_CACHE_KEY, JSON.stringify(payload));
      return;
    }

    setError("");
    setFilters(normalizedFilters);

    const nextOffset = 0;
    const payload = {
      session_id: getCurrentSessionId(),
      offset: nextOffset,
      filters: {
        username: normalizedFilters.username || "",
        ip: normalizedFilters.ip || "",
        from: normalizedFilters.from || "",
        to: normalizedFilters.to || "",
      },
    };
    sessionStorage.setItem(AUDIT_FILTER_CACHE_KEY, JSON.stringify(payload));
    fetchLogs(nextOffset, normalizedFilters);
  };

  const clearFilters = () => {
    const resetFilters = {
      username: "",
      ip: "",
      from: "",
      to: "",
      limit: 30,
    };
    setFilters(resetFilters);
    setOffset(0);
    setError("");
    setArchiveInfo({ found: false, file_path: "", log_date: "" });
    setSearchParams({}, { replace: true });
    sessionStorage.removeItem(AUDIT_FILTER_CACHE_KEY);
    setLogs([]);
    setPaging({ total: 0, has_next: false });
    setSummaryCounts({
      total: 0,
      login_success: 0,
      login_failed: 0,
      logout: 0,
    });
  };

  const downloadDateTxt = () => {
    const date = (filters.from || "").trim();
    const to = (filters.to || "").trim();
    if (!date || !to || date !== to) {
      alert("Select same From and To date to download date-wise TXT.");
      return;
    }
    const params = new URLSearchParams();
    params.set("date", date);
    if ((filters.username || "").trim()) params.set("username", filters.username.trim());
    if ((filters.ip || "").trim()) params.set("ip", filters.ip.trim());
    const url = `${api.defaults.baseURL}/api/audit/archives/download?${params.toString()}`;
    window.open(url, "_blank");
  };

  useEffect(() => {
    const payload = {
      session_id: getCurrentSessionId(),
      offset,
      filters: {
        username: filters.username || "",
        ip: filters.ip || "",
        from: filters.from || "",
        to: filters.to || "",
      },
    };
    sessionStorage.setItem(AUDIT_FILTER_CACHE_KEY, JSON.stringify(payload));
  }, [filters.username, filters.ip, filters.from, filters.to, offset]);

  return (
    <MainLayout>
      <div className="audit-page">
        <div className="audit-header">
          <h2>Audit Logs</h2>
          <div className="audit-actions">
            <button onClick={exportCsv} disabled={!logs.length || exporting}>
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
            <label className="audit-auto">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto Refresh
            </label>
            <select
              value={refreshSec}
              onChange={(e) => setRefreshSec(Number(e.target.value) || 10)}
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>
        </div>

        <div className="audit-filters">
          <input
            placeholder="Filter by username"
            value={filters.username}
            onChange={(e) => setFilters((p) => ({ ...p, username: e.target.value }))}
          />
          <input
            placeholder="Filter by IP"
            value={filters.ip}
            onChange={(e) => setFilters((p) => ({ ...p, ip: e.target.value }))}
          />
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
          />
          <button
            onClick={clearFilters}
            disabled={loading}
            className="audit-filter-btn"
          >
            Clear
          </button>
          <button
            onClick={applyFilters}
            disabled={loading}
            className="audit-filter-btn"
          >
            Apply
          </button>
          <button
            onClick={downloadDateTxt}
            disabled={loading}
            className="audit-filter-btn"
            title="Download TXT"
          >
            ⬇
          </button>
        </div>

        <div className="audit-summary">
          <div className="audit-card">
            <div className="label">Total Rows</div>
            <div className="value">{pageStats.totalRows}</div>
          </div>
          <div className="audit-card">
            <div className="label">Login Success</div>
            <div className="value">{pageStats.loginSuccess}</div>
          </div>
          <div className="audit-card">
            <div className="label">Login Failed</div>
            <div className="value">{pageStats.loginFailed}</div>
          </div>
          <div className="audit-card">
            <div className="label">Logout</div>
            <div className="value">{pageStats.logout}</div>
          </div>
        </div>

        {error && <div className="audit-error">{error}</div>}
        {!error && archiveInfo.found && (
          <div className="audit-error" style={{ background: "#f0f7ff", color: "#0f172a", borderColor: "#bfdbfe" }}>
            Archived logs loaded for {archiveInfo.log_date}. File: {archiveInfo.file_path}
          </div>
        )}

        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Session</th>
                <th>Event</th>
                <th>Page</th>
                <th>IP</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>{row.username || "-"}</td>
                  <td>{row.role || "-"}</td>
                  <td className="mono">{row.session_id || "-"}</td>
                  <td>{row.event}</td>
                  <td>{row.page || "-"}</td>
                  <td>{row.ip_address || "-"}</td>
                  <td className="mono small">{JSON.stringify(row.details || {})}</td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={8} className="audit-empty">
                    No logs for selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="audit-pagination">
          <button
            onClick={() => fetchLogs(Math.max(0, offset - 30))}
            disabled={loading || offset <= 0}
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => fetchLogs(offset + 30)}
            disabled={loading || !paging.has_next}
          >
            Next
          </button>
        </div>

      </div>
    </MainLayout>
  );
}
