import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pencil, Trash2, Clock, Users, Wallet, Star, Film,
  MapPin, StickyNote, FolderOpen, Package,
} from 'lucide-react';
import { Activity, CATEGORY_CONFIG } from '@/types/zeeky';
import CategoryIcon from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useTranslation } from 'react-i18next';
import { getActivityCategory } from '@/lib/categoryTranslations';
import { formatActivityDate, activityDateTimeSource } from '@/lib/dateLocale';
import { formatDuration, getActivityDurationMins } from '@/lib/durationFormat';

interface Props {
  activity: Activity | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export default function ActivityDetailSheet({ activity, onClose, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const navigate       = useNavigate();
  const currencySymbol = useCurrencyStore(s => s.symbol);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const dragStartY = useRef(0);
  const dragging   = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  if (!activity) return null;

  const locale =
    i18n.language === 'en' ? 'en-US' :
    i18n.language === 'fr' ? 'fr-FR' : 'tr-TR';

  const config  = CATEGORY_CONFIG[activity.category] ?? { label: activity.category, color: '#78909C' };
  const details = activity.details || {};

  // ── Build detail rows ────────────────────────────────────────────────────
  const companions   = details.companions as string[] | undefined;
  const isAlone      = details.alone as boolean | undefined;
  const durationText = details.durationText as string | undefined;
  const durationMins = getActivityDurationMins(activity);
  const amount       = details.amount as number | undefined;
  const subcategory  = details.subcategory as string | undefined;
  const quality      = details.quality as number | undefined;
  const rating       = details.rating as number | undefined;
  const contentName  = details.type as string | undefined;
  const sleepStart   = details.sleepStart as string | undefined;
  const wakeUp       = details.wakeUp as string | undefined;
  const location     = details.location as { lat: number; lng: number } | undefined;
  const locationName = details.locationName as string | undefined;

  const starRating = activity.category === 'uyudum' ? quality : activity.category === 'izledim' ? rating : undefined;

  const hasCoords = location && location.lat != null && location.lng != null
    && !Number.isNaN(location.lat) && !Number.isNaN(location.lng);

  const mapUrl = hasCoords
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${location!.lat},${location!.lng}&zoom=15&size=580x280&markers=${location!.lat},${location!.lng},red-pushpin`
    : null;
  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${location!.lat},${location!.lng}`
    : locationName
      ? `https://www.google.com/maps/search/${encodeURIComponent(locationName)}`
      : null;

  const rows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [];

  if (companions && companions.length > 0) {
    rows.push({
      icon: <Users className="w-4 h-4" />, label: t('history.detail.with_people'),
      value: <div className="flex flex-wrap gap-1">{companions.map((c, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{c}</span>)}</div>,
    });
  } else if (isAlone) {
    rows.push({ icon: <Users className="w-4 h-4" />, label: t('history.detail.with_people'), value: <span className="text-sm">{t('history.detail.alone')}</span> });
  }
  if (durationMins != null) {
    rows.push({
      icon: <Clock className="w-4 h-4" />,
      label: t('history.detail.duration'),
      value: <span className="text-sm">{formatDuration(durationMins, t) ?? ''}</span>,
    });
  } else if (durationText) {
    rows.push({ icon: <Clock className="w-4 h-4" />, label: t('history.detail.duration'), value: <span className="text-sm">{durationText}</span> });
  }
  if (sleepStart && wakeUp) {
    rows.push({ icon: <Clock className="w-4 h-4" />, label: t('history.detail.duration'), value: <span className="text-sm">{sleepStart} – {wakeUp}</span> });
  }
  if (amount !== undefined) {
    rows.push({ icon: <Wallet className="w-4 h-4" />, label: t('history.detail.amount'), value: <span className="text-sm font-semibold">{amount.toLocaleString(locale)} {currencySymbol}</span> });
  }
  if (activity.category === 'yeme-içme' && (activity.quantity != null || (activity.quantity_unit && activity.quantity_unit.trim()))) {
    const qParts = [activity.quantity != null ? String(activity.quantity) : null, activity.quantity_unit?.trim()].filter(Boolean);
    rows.push({
      icon: <Package className="w-4 h-4" />,
      label: `${t('add_action.quantity')} / ${t('add_action.quantity_unit')}`,
      value: <span className="text-sm">{qParts.join(' · ')}</span>,
    });
  }
  if (subcategory) {
    rows.push({ icon: <FolderOpen className="w-4 h-4" />, label: t('history.detail.category'), value: <span className="text-sm capitalize">{subcategory}</span> });
  }
  if (starRating !== undefined) {
    rows.push({
      icon: <Star className="w-4 h-4" />, label: t('history.detail.rating'),
      value: <div className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("w-4 h-4", i < starRating ? "fill-warning text-warning" : "text-muted-foreground/30")} />)}</div>,
    });
  }
  if (contentName && activity.category === 'izledim') {
    rows.push({ icon: <Film className="w-4 h-4" />, label: t('history.detail.content'), value: <span className="text-sm">{contentName}</span> });
  }

  // ── Drag to dismiss ──────────────────────────────────────────────────────
  const handleDragStart = (e: React.TouchEvent) => { dragStartY.current = e.touches[0].clientY; dragging.current = true; };
  const handleDragMove  = (e: React.TouchEvent) => { if (!dragging.current) return; setDragOffset(Math.max(0, e.touches[0].clientY - dragStartY.current)); };
  const handleDragEnd   = () => { dragging.current = false; if (dragOffset > 100) onClose(); setDragOffset(0); };

  const handleDelete = () => { onDelete(activity.id); setShowDeleteConfirm(false); onClose(); };

  return (
    <>
      <div className="fixed inset-0 z-[300] bg-black/60" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[301] bg-card rounded-t-3xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col"
        style={{
          transform: `translateY(${dragOffset}px)`,
          transition: dragging.current ? 'none' : 'transform 200ms ease',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center py-3 cursor-grab flex-shrink-0"
          onTouchStart={handleDragStart} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <CategoryIcon category={activity.category} size="lg" />
              <div>
                <h2 className="text-lg font-bold">{activity.title}</h2>
                <span
                  className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                  style={{ backgroundColor: config.color + '20', color: config.color }}
                >
                  {getActivityCategory(activity.category)}
                </span>
                <p className="text-xs text-muted-foreground mt-1">{formatActivityDate(activityDateTimeSource(activity))}</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => { onClose(); navigate('/add', { state: { editId: activity.id } }); }}
                className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center active:scale-90 transition-transform"
                aria-label={t('history.detail.edit_activity')}
              >
                <Pencil className="w-4 h-4 text-accent" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center active:scale-90 transition-transform"
                aria-label={t('history.detail.delete_activity')}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            </div>
          </div>

          {/* Map */}
          {mapUrl ? (
            <div className="mb-5">
              <a href={googleMapsUrl!} target="_blank" rel="noopener noreferrer">
                <img src={mapUrl} alt={t('history.detail.location')} className="w-full rounded-2xl object-cover" style={{ height: 180 }} loading="lazy" />
              </a>
              {locationName && <p className="text-xs text-muted-foreground mt-1.5">{locationName}</p>}
              <a href={googleMapsUrl!} target="_blank" rel="noopener noreferrer" className="text-xs text-accent font-medium mt-1 inline-block">{t('history.detail.view_on_map')}</a>
            </div>
          ) : locationName ? (
            <a href={googleMapsUrl!} target="_blank" rel="noopener noreferrer" className="block mb-5">
              <div className="w-full rounded-2xl bg-muted flex flex-col items-center justify-center gap-2" style={{ height: 180 }}>
                <MapPin className="w-6 h-6 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">{t('history.detail.location')}: {locationName}</p>
              </div>
            </a>
          ) : null}

          {/* Detail rows */}
          {rows.length > 0 && (
            <div className="mb-5">
              {rows.map((row, i) => (
                <div key={i} className={cn("flex items-center gap-3 py-3", i < rows.length - 1 && "border-b border-border")}>
                  <span className="text-muted-foreground">{row.icon}</span>
                  <span className="text-xs text-muted-foreground font-medium w-24 flex-shrink-0">{row.label}</span>
                  <div className="flex-1">{row.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Note */}
          {activity.note && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">{t('history.detail.notes')}</span>
              </div>
              <div className="bg-muted rounded-xl p-3">
                <p className="text-sm italic text-foreground/80">{activity.note}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-card rounded-2xl p-6 mx-8 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-center mb-4">{t('history.delete_confirm')}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground font-semibold text-sm">{t('history.cancel')}</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
