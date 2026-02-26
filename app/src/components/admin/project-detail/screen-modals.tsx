'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Upload } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import type { ScreenItem } from '@/lib/types';
import { useTranslation } from '@/lib/i18n/context';

/* ---- Add Screen Modal ---- */
interface AddScreenModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
}

export function AddScreenModal({ open, onClose, onAdd }: AddScreenModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  const handleAdd = () => {
    onAdd(name);
    setName('');
  };

  const handleClose = () => {
    onClose();
    setName('');
  };

  return (
    <Modal open={open} onClose={handleClose} title={t('projectDetail.addScreenTitle')} size="sm">
      <div className="space-y-4">
        <div>
          <label htmlFor="screen-name" className="block text-sm font-medium mb-1.5">{t('projectDetail.screenName')}</label>
          <input
            id="screen-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('projectDetail.screenNamePlaceholder')}
            className="w-full px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            autoFocus
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!name}
          className="w-full py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
        >
          {t('projectDetail.addScreen')}
        </button>
      </div>
    </Modal>
  );
}

/* ---- Upload Screenshot Modal ---- */
interface UploadScreenshotModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}

export function UploadScreenshotModal({ open, onClose, onUpload, uploading }: UploadScreenshotModalProps) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);

  return (
    <Modal open={open} onClose={() => { onClose(); setDragging(false); }} title={t('projectDetail.uploadTitle')} size="sm">
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-border'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && file.type.startsWith('image/')) {
              onUpload(file);
            }
          }}
        >
          <Upload className="w-8 h-8 text-muted mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-muted mb-3">
            {dragging ? t('projectDetail.dropHere') : t('projectDetail.dragDrop')}
          </p>
          <input
            type="file"
            accept="image/*"
            aria-label="Choose screenshot image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
            className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-hover"
          />
        </div>
        {uploading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            {t('projectDetail.uploading')}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---- Delete Screen Confirmation Modal ---- */
interface DeleteScreenModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteScreenModal({ open, onClose, onConfirm }: DeleteScreenModalProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={t('projectDetail.deleteScreenTitle')} size="sm">
      <p className="text-sm text-muted mb-4">{t('projectDetail.deleteScreenConfirm')}</p>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-gray-50">
          {t('common.cancel')}
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
        >
          {t('common.delete')}
        </button>
      </div>
    </Modal>
  );
}

/* ---- Version History Modal ---- */
interface VersionHistoryModalProps {
  screen: ScreenItem | null;
  onClose: () => void;
}

export function VersionHistoryModal({ screen, onClose }: VersionHistoryModalProps) {
  const { t } = useTranslation();
  return (
    <Modal open={!!screen} onClose={onClose} title={`${t('projectDetail.versionHistory')} — ${screen?.name}`}>
      <div className="grid grid-cols-2 gap-4">
        {screen?.screenshot_versions
          .sort((a, b) => b.version - a.version)
          .map((v) => (
            <div key={v.id} className="border border-border rounded-xl overflow-hidden">
              <Image src={v.image_url} alt={`v${v.version}`} width={640} height={360} sizes="50vw" className="w-full aspect-video object-cover" />
              <div className="p-2 flex items-center justify-between">
                <span className="text-sm font-medium">v{v.version}</span>
                <span className="text-xs text-muted">{new Date(v.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
      </div>
    </Modal>
  );
}
