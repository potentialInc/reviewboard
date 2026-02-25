'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

/* ---- Create Project Modal ---- */
interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; slack_channel: string }) => void;
  creating: boolean;
  createdCreds: { login_id: string; initial_password: string } | null;
}

export function CreateProjectModal({
  open,
  onClose,
  onCreate,
  creating,
  createdCreds,
}: CreateProjectModalProps) {
  const [newProject, setNewProject] = useState({ name: '', slack_channel: '' });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleClose = () => {
    setNewProject({ name: '', slack_channel: '' });
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Create Project">
      {createdCreds ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">Project created. Share these credentials with the client:</p>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">Client ID</p>
                <p className="text-sm font-mono font-medium">{createdCreds.login_id}</p>
              </div>
              <button onClick={() => copyToClipboard(createdCreds.login_id, 'id')} className="p-1.5 hover:bg-gray-200 rounded-lg" aria-label="Copy Client ID">
                {copiedField === 'id' ? <Check className="w-4 h-4 text-green-500" aria-hidden="true" /> : <Copy className="w-4 h-4 text-muted" aria-hidden="true" />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">Password</p>
                <p className="text-sm font-mono font-medium">{createdCreds.initial_password}</p>
              </div>
              <button onClick={() => copyToClipboard(createdCreds.initial_password, 'pw')} className="p-1.5 hover:bg-gray-200 rounded-lg" aria-label="Copy password">
                {copiedField === 'pw' ? <Check className="w-4 h-4 text-green-500" aria-hidden="true" /> : <Copy className="w-4 h-4 text-muted" aria-hidden="true" />}
              </button>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-full py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="create-project-name" className="block text-sm font-medium mb-1.5">Project Name *</label>
            <input
              id="create-project-name"
              type="text"
              value={newProject.name}
              onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Acme Redesign"
              className="w-full px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="create-project-slack" className="block text-sm font-medium mb-1.5">Slack Channel (optional)</label>
            <input
              id="create-project-slack"
              type="text"
              value={newProject.slack_channel}
              onChange={(e) => setNewProject((p) => ({ ...p, slack_channel: e.target.value }))}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            onClick={() => onCreate(newProject)}
            disabled={!newProject.name || creating}
            className="w-full py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ---- Delete Confirmation Modal ---- */
interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
  confirmLabel?: string;
}

export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  message,
  confirmLabel = 'Delete',
}: DeleteConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Delete Project" size="sm">
      <p className="text-sm text-muted mb-4">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
