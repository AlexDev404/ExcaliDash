import { Folder, Loader2, Trash2, UserPlus, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import * as api from '../../api';

type Props = Record<string, never>;

export const AdminCollectionsPanel: React.FC<Props> = () => {
  const [collections, setCollections] = useState<api.AdminCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Grant form state per collection
  const [grantState, setGrantState] = useState<Record<string, {
    query: string;
    results: api.ShareResolvedUser[];
    permission: 'view' | 'edit';
    saving: boolean;
  }>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.adminGetCollections();
      // Filter out trash collections
      setCollections(data.filter(c => !c.name.startsWith('__trash__') && c.id !== 'trash'));
    } catch (err: unknown) {
      let msg = 'Failed to load collections';
      if (api.isAxiosError(err)) msg = err.response?.data?.message || msg;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const getGrant = (id: string) =>
    grantState[id] || { query: '', results: [], permission: 'view' as const, saving: false };

  const setGrant = (id: string, patch: Partial<typeof grantState[string]>) =>
    setGrantState(prev => ({ ...prev, [id]: { ...getGrant(id), ...patch } }));

  const handleQueryChange = async (collectionId: string, q: string) => {
    setGrant(collectionId, { query: q });
    if (q.trim().length < 2) { setGrant(collectionId, { results: [] }); return; }
    try {
      const results = await api.resolveCollectionShareUsers(collectionId, q.trim());
      const collection = collections.find(c => c.id === collectionId);
      const granted = new Set(collection?.permissions.map(p => p.granteeUserId) || []);
      setGrant(collectionId, {
        results: results.filter(u => u.id !== collection?.userId && !granted.has(u.id)),
      });
    } catch {
      setGrant(collectionId, { results: [] });
    }
  };

  const handleGrant = async (collectionId: string, granteeUserId: string) => {
    const g = getGrant(collectionId);
    setGrant(collectionId, { saving: true, query: '', results: [] });
    try {
      await api.adminUpsertCollectionPermission(collectionId, {
        granteeUserId,
        permission: g.permission,
      });
      await load();
    } catch (err: unknown) {
      let msg = 'Failed to grant permission';
      if (api.isAxiosError(err)) msg = err.response?.data?.message || msg;
      setError(msg);
    } finally {
      setGrant(collectionId, { saving: false });
    }
  };

  const handleUpdatePermission = async (collectionId: string, _permId: string, granteeUserId: string, permission: 'view' | 'edit') => {
    try {
      await api.adminUpsertCollectionPermission(collectionId, { granteeUserId, permission });
      await load();
    } catch (err: unknown) {
      let msg = 'Failed to update permission';
      if (api.isAxiosError(err)) msg = err.response?.data?.message || msg;
      setError(msg);
    }
  };

  const handleRevoke = async (collectionId: string, permId: string) => {
    try {
      await api.adminRevokeCollectionPermission(collectionId, permId);
      await load();
    } catch (err: unknown) {
      let msg = 'Failed to revoke permission';
      if (api.isAxiosError(err)) msg = err.response?.data?.message || msg;
      setError(msg);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl shadow-md overflow-hidden mt-6">
      <div className="px-4 sm:px-6 py-4 border-b-2 border-slate-200 dark:border-neutral-700 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center border-2 border-indigo-100 dark:border-neutral-700">
          <Folder size={20} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Collection Access</h2>
        {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm font-semibold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {collections.length === 0 && !loading && (
        <p className="px-6 py-6 text-slate-500 dark:text-neutral-500 font-medium text-sm">No collections found.</p>
      )}

      <div className="divide-y divide-slate-100 dark:divide-neutral-800">
        {collections.map((collection) => {
          const g = getGrant(collection.id);
          return (
            <div key={collection.id} className="px-4 sm:px-6 py-4 space-y-3">
              {/* Collection header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Folder size={16} className="text-indigo-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">{collection.name}</div>
                    <div className="text-xs text-slate-400 dark:text-neutral-500 truncate">
                      Owner: {collection.user.name} ({collection.user.email})
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 flex-shrink-0 mt-1">
                  {collection.permissions.length} {collection.permissions.length === 1 ? 'share' : 'shares'}
                </span>
              </div>

              {/* Existing permissions */}
              {collection.permissions.length > 0 && (
                <div className="space-y-1.5">
                  {collection.permissions.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 bg-slate-50 dark:bg-neutral-800/60 rounded-xl px-3 py-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs flex-shrink-0">
                        {p.granteeUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{p.granteeUser.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-neutral-500 truncate">{p.granteeUser.email}</div>
                      </div>
                      <select
                        value={p.permission}
                        onChange={(e) => handleUpdatePermission(collection.id, p.id, p.granteeUserId, e.target.value as 'view' | 'edit')}
                        className="text-xs font-semibold px-2 py-1 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-slate-900 dark:text-white outline-none"
                      >
                        <option value="view">Viewer</option>
                        <option value="edit">Editor</option>
                      </select>
                      <button
                        onClick={() => handleRevoke(collection.id, p.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 transition-colors"
                        title="Revoke access"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Grant form */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <input
                    type="text"
                    value={g.query}
                    onChange={(e) => handleQueryChange(collection.id, e.target.value)}
                    placeholder="Add user by name or email…"
                    className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-indigo-400"
                  />
                  {g.results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-lg z-50 overflow-hidden">
                      {g.results.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleGrant(collection.id, u.id)}
                          className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border-b last:border-b-0 border-slate-100 dark:border-neutral-800"
                        >
                          <Users size={12} className="text-indigo-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{u.name}</div>
                            <div className="text-[10px] text-slate-400 dark:text-neutral-500 truncate">{u.email}</div>
                          </div>
                          <UserPlus size={12} className="text-slate-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <select
                  value={g.permission}
                  onChange={(e) => setGrant(collection.id, { permission: e.target.value as 'view' | 'edit' })}
                  className="text-xs font-semibold px-2 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
                >
                  <option value="view">Viewer</option>
                  <option value="edit">Editor</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
