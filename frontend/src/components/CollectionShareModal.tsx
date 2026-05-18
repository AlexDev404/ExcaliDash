import clsx from "clsx";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api";
import { useAuth } from "../context/AuthContext";

type Props = {
  collectionId: string;
  collectionName: string;
  isOpen: boolean;
  onClose: () => void;
};

const CustomSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string; danger?: boolean }[];
  align?: "left" | "right";
}> = ({ value, onChange, options, align = "left" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative inline-flex items-center" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 outline-none transition-all"
      >
        <span>{current.label}</span>
        <ChevronDown size={14} className={clsx("transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className={clsx(
          "absolute top-full z-[100] mt-1.5 min-w-[140px] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow overflow-hidden animate-in fade-in zoom-in-95 duration-100",
          align === "right" ? "right-0" : "left-0"
        )}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(opt.value); setOpen(false); }}
              className={clsx(
                "w-full text-left px-3 py-2 text-xs font-semibold transition-colors flex items-center justify-between border-b last:border-b-0 border-slate-100 dark:border-neutral-800",
                opt.value === value
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  : opt.danger
                  ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                  : "text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800"
              )}
            >
              {opt.label}
              {opt.value === value && <Check size={12} strokeWidth={3} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const CollectionShareModal: React.FC<Props> = ({
  collectionId,
  collectionName,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const currentUserId = user?.id || null;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<api.CollectionPermissionRow[]>([]);

  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<api.ShareResolvedUser[]>([]);
  const [addPermission, setAddPermission] = useState<"view" | "edit">("view");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getCollectionSharing(collectionId);
      setPermissions(data.permissions);
    } catch (err: unknown) {
      let message = "Failed to load sharing settings";
      if (api.isAxiosError(err)) {
        const m = typeof err.response?.data?.message === "string" ? err.response.data.message : null;
        if (m) message = m;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    if (!isOpen) return;
    setUserQuery("");
    setUserResults([]);
    setAddPermission("view");
    void refresh();
  }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen) return;
    const q = userQuery.trim();
    if (q.length < 2) { setUserResults([]); return; }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const users = await api.resolveCollectionShareUsers(collectionId, q);
        const alreadyGranted = new Set(permissions.map((p) => p.granteeUserId));
        const filtered = users.filter(
          (u) => u.id !== currentUserId && !alreadyGranted.has(u.id)
        );
        if (!cancelled) setUserResults(filtered);
      } catch {
        if (!cancelled) setUserResults([]);
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [collectionId, isOpen, userQuery, currentUserId, permissions]);

  const handleAddUser = async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.upsertCollectionPermission(collectionId, { granteeUserId: userId, permission: addPermission });
      await refresh();
      setUserQuery("");
      setUserResults([]);
    } catch (err: unknown) {
      let message = "Failed to share with user";
      if (api.isAxiosError(err)) {
        const m = typeof err.response?.data?.message === "string" ? err.response.data.message : null;
        if (m) message = m;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePermission = async (permId: string, granteeUserId: string, val: string) => {
    if (val === "remove") {
      setIsLoading(true);
      setError(null);
      try {
        await api.revokeCollectionPermission(collectionId, permId);
        await refresh();
      } catch {
        setError("Failed to revoke access");
      } finally {
        setIsLoading(false);
      }
    } else {
      await api.upsertCollectionPermission(collectionId, {
        granteeUserId,
        permission: val as "view" | "edit",
      });
      void refresh();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[420px] bg-white dark:bg-neutral-900 rounded-[20px] border border-gray-200 dark:border-neutral-700 shadow-lg flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b-2 border-black/25 dark:border-neutral-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-neutral-100 truncate pr-4" title={collectionName}>
            Share "{collectionName}"
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-transparent hover:border-black/25 dark:hover:border-neutral-600 transition-all group shrink-0"
          >
            <X size={16} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>

        <div className="flex-1 px-5 py-5 space-y-5 overflow-visible">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-600 dark:border-rose-500 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-3">
              <AlertTriangle size={16} strokeWidth={3} />
              {error}
            </div>
          )}

          {/* Search + permission selector */}
          <section className="relative">
            <div className="flex gap-2">
              <div className="relative group flex-1">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  <Search size={16} strokeWidth={2.5} />
                </div>
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Add people"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-500 transition-all text-sm font-semibold placeholder:text-slate-400 shadow-sm"
                />
              </div>
              <CustomSelect
                value={addPermission}
                onChange={(v) => setAddPermission(v as "view" | "edit")}
                options={[
                  { label: "Viewer", value: "view" },
                  { label: "Editor", value: "edit" },
                ]}
              />
            </div>

            {userResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 border border-gray-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 shadow-lg overflow-hidden z-[200] animate-in fade-in slide-in-from-top-2">
                {userResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleAddUser(u.id)}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group border-b last:border-b-0 border-slate-100 dark:border-neutral-800"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-black/25 dark:border-neutral-600">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-neutral-100 truncate">{u.name}</div>
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-neutral-400 truncate">{u.email}</div>
                    </div>
                    <Plus size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors" strokeWidth={3} />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* People with access */}
          <section className="space-y-2">
            <h3 className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-neutral-500 px-1">
              People with access
            </h3>

            <div className="space-y-0">
              {/* Current user (owner) */}
              <div className="flex items-center gap-3 px-1 py-1.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-slate-600 dark:text-neutral-300 font-semibold text-sm border border-black/25 dark:border-neutral-600 shrink-0">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="text-xs font-semibold text-slate-900 dark:text-neutral-100 leading-tight">
                    {user?.name} <span className="text-slate-400 dark:text-neutral-500 font-semibold ml-1">(you)</span>
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-neutral-400 mt-0.5">{user?.email}</div>
                </div>
                <div className="text-[8px] font-semibold uppercase tracking-widest text-slate-400 dark:text-neutral-500 pr-1 shrink-0">Owner</div>
              </div>

              {permissions.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-1 py-1.5 group">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-sm border border-indigo-600 dark:border-indigo-500 shrink-0">
                    {p.granteeUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-xs font-semibold text-slate-900 dark:text-neutral-100 leading-tight truncate">{p.granteeUser.name}</div>
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-neutral-400 mt-0.5 truncate">{p.granteeUser.email}</div>
                  </div>
                  <div className="shrink-0 flex items-center h-full">
                    <CustomSelect
                      value={p.permission}
                      onChange={(val) => handleChangePermission(p.id, p.granteeUserId, val)}
                      options={[
                        { label: "Viewer", value: "view" },
                        { label: "Editor", value: "edit" },
                        { label: "Remove access", value: "remove", danger: true },
                      ]}
                      align="right"
                    />
                  </div>
                </div>
              ))}

              {permissions.length === 0 && (
                <p className="px-1 py-2 text-xs text-slate-400 dark:text-neutral-500 font-semibold">
                  No one else has access to this collection yet.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex items-center justify-end border-t-2 border-black/25 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800/50 rounded-b-[18px]">
          <button
            onClick={onClose}
            className="px-8 py-2.5 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white border border-black/25 font-semibold text-[10px] uppercase tracking-[0.2em] hover:shadow-md transition-all"
          >
            DONE
          </button>
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-white/20 dark:bg-black/10 backdrop-blur-[1px] flex items-center justify-center z-[300] pointer-events-none rounded-[24px]">
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 p-5 rounded-2xl shadow-xl">
              <RefreshCw size={28} strokeWidth={3} className="animate-spin text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
