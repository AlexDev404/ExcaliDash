import { UserCog, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AdminUser } from './types';

type EditUserModalProps = {
  user: AdminUser | null;
  isOpen: boolean;
  isSelf: boolean;
  onClose: () => void;
  onSave: (
    id: string,
    data: Partial<Pick<AdminUser, 'name' | 'username' | 'role' | 'mustResetPassword' | 'isActive'>>
  ) => void | Promise<void>;
};

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  isOpen,
  isSelf,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'USER'>('USER');
  const [mustReset, setMustReset] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setUsername(user.username ?? '');
      setRole(user.role === 'ADMIN' ? 'ADMIN' : 'USER');
      setMustReset(user.mustResetPassword);
      setIsActive(user.isActive);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(user.id, {
        name: name.trim(),
        username: username.trim() || null,
        role,
        mustResetPassword: mustReset,
        isActive,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-neutral-900/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-700 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200 dark:border-neutral-700">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center border-2 border-indigo-100 dark:border-neutral-700 flex-shrink-0">
            <UserCog size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit User</h2>
            <p className="text-sm text-slate-500 dark:text-neutral-400 truncate">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-neutral-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-neutral-300 mb-2">
              Username <span className="font-normal text-slate-400 dark:text-neutral-500">(optional)</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={50}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-neutral-300 mb-2">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'ADMIN' | 'USER')}
              disabled={isSelf}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            {isSelf && (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
                You cannot change your own role.
              </p>
            )}
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-neutral-300 mb-2">
                Account Status
              </label>
              <button
                type="button"
                onClick={() => !isSelf && setIsActive(!isActive)}
                disabled={isSelf}
                className={`w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all text-sm ${
                  isActive
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300'
                } ${isSelf ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {isActive ? 'Active' : 'Inactive'}
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-neutral-300 mb-2">
                Password Reset
              </label>
              <button
                type="button"
                onClick={() => setMustReset(!mustReset)}
                className={`w-full px-4 py-3 rounded-xl border-2 font-semibold transition-all text-sm ${
                  mustReset
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
                    : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300'
                }`}
              >
                {mustReset ? 'Required' : 'Not required'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 dark:border-neutral-700 bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
