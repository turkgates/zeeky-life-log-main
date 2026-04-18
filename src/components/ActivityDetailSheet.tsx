import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pencil, Trash2, Clock, Users, Wallet, Star, Film,
  MapPin, StickyNote, FolderOpen, Package,
  Heart, Footprints, Flame, BedDouble, Activity as ActivityIcon,
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
  const [geocodedCoords, setGeocodedCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    setGeocodedCoords(null);
    if (!activity) return;
    const details = activity.details || {};
    const locationName = details.locationName as string | undefined;
    const activityLocationText = (activity as any).location as string | undefined;
    const locationLat = (activity as any).location_lat as number | undefined;
    const locationLon = (activity as any).location_lon as number | undefined;
    const hasStoredCoords = locationLat != null && locationLon != null;
    if (hasStoredCoords) return;
    if (!activityLocationText && !locationName) return;
    const query = activityLocationText || locationName || '';
    if (!query || query.length < 3) return;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
      headers: { 'User-Agent': 'Zeeky-App/1.0' },
    })
      .then(r => r.json())
      .then(data => {
        if (data?.[0]) {
          setGeocodedCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
        }
      })
      .catch(() => {});
  }, [activity]);

  if (!activity) return null;

  const locale =
    i18n.language === 'en' ? 'en-US' :
    i18n.language === 'fr' ? 'fr-FR' : 'tr-TR';

  const config  = CATEGORY_CONFIG[activity.category] ?? { label: activity.category, color: '#78909C' };
  const details = activity.details || {};

  const isHealthKit = (activity as any).created_via === 'healthkit';
  let healthData: {
    steps?: number;
    distance_km?: number;
    calories?: number;
    sleep?: number;
    heartRate?: number;
  } = {};
  if (isHealthKit && (activity as any).raw_message) {
    try { healthData = JSON.parse((activity as any).raw_message); } catch {}
  }

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
  const activityLocationText = (activity as any).location as string | undefined;
  const locationLat = (activity as any).location_lat as number | undefined;
  const locationLon = (activity as any).location_lon as number | undefined;
  const hasStoredCoords = locationLat != null && locationLon != null;

  console.log('location debug:', {
    locationLat,
    locationLon,
    hasStoredCoords,
    activityLocation: (activity as any).location,
    activityId: activity.id,
  });

  const starRating = activity.category === 'uyudum' ? quality : activity.category === 'izledim' ? rating : undefined;

  const hasCoords = location && location.lat != null && location.lng != null
    && !Number.isNaN(location.lat) && !Number.isNaN(location.lng);

  const googleMapsUrl = hasStoredCoords
    ? `https://www.google.com/maps?q=${locationLat},${locationLon}`
    : hasCoords
    ? `https://www.google.com/maps?q=${location!.lat},${location!.lng}`
    : locationName
    ? `https://www.google.com/maps/search/${encodeURIComponent(locationName)}`
    : activityLocationText
    ? `https://www.google.com/maps/search/${encodeURIComponent(activityLocationText)}`
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
  if (activityLocationText && !hasCoords && !locationName) {
    rows.push({
      icon: <MapPin className="w-4 h-4" />,
      label: t('history.detail.location'),
      value: <span className="text-sm">{activityLocationText}</span>,
    });
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
          {hasStoredCoords ? (
            <div className="mb-5">
              <a
                href={googleMapsUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-2xl overflow-hidden"
                style={{ height: 180 }}
              >
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationLon! - 0.001},${locationLat! - 0.001},${locationLon! + 0.001},${locationLat! + 0.001}&layer=mapnik&marker=${locationLat},${locationLon}`}
                  width="100%"
                  height="180"
                  scrolling="no"
                  style={{ border: 'none', borderRadius: 16, pointerEvents: 'none' }}
                />
              </a>
            </div>
          ) : locationName ? (
            <a href={googleMapsUrl!} target="_blank" rel="noopener noreferrer" className="block mb-5">
              <div className="w-full rounded-2xl bg-muted flex flex-col items-center justify-center gap-2" style={{ height: 180 }}>
                <MapPin className="w-6 h-6 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">{t('history.detail.location')}: {locationName}</p>
              </div>
            </a>
          ) : (activityLocationText || locationName) && (geocodedCoords || googleMapsUrl) ? (
            <div className="mb-5">
              {geocodedCoords ? (
                <a
                  href={`https://www.google.com/maps?q=${geocodedCoords.lat},${geocodedCoords.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-2xl overflow-hidden"
                  style={{ height: 180 }}
                >
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${geocodedCoords.lon - 0.003},${geocodedCoords.lat - 0.003},${geocodedCoords.lon + 0.003},${geocodedCoords.lat + 0.003}&layer=mapnik&marker=${geocodedCoords.lat},${geocodedCoords.lon}`}
                    width="100%"
                    height="180"
                    scrolling="no"
                    style={{ border: 'none', borderRadius: 16, pointerEvents: 'none' }}
                  />
                </a>
              ) : (
                <a href={googleMapsUrl!} target="_blank" rel="noopener noreferrer" className="block mb-5">
                  <div className="w-full rounded-2xl bg-muted flex flex-col items-center justify-center gap-2" style={{ height: 180 }}>
                    <MapPin className="w-6 h-6 text-muted-foreground/50" />
                    <p className="text-xs text-muted-foreground">{activityLocationText || locationName}</p>
                  </div>
                </a>
              )}
              {(activityLocationText || locationName) && (
                <p className="text-xs text-muted-foreground mt-1.5">{activityLocationText || locationName}</p>
              )}
            </div>
          ) : null}

          {/* HealthKit metrics grid */}
          {isHealthKit && (
            <div className="mb-6">
              <div className="grid grid-cols-2 gap-3">
                {healthData.steps != null && (
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    <div className="flex items-center gap-2 mb-2 opacity-80">
                      <Footprints className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        {i18n.language === 'fr' ? 'Pas' : i18n.language === 'en' ? 'Steps' : 'Adım'}
                      </span>
                    </div>
                    <p className="text-2xl font-bold">{healthData.steps.toLocaleString(locale)}</p>
                  </div>
                )}
                {healthData.distance_km != null && (
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                    <div className="flex items-center gap-2 mb-2 opacity-80">
                      <ActivityIcon className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        {i18n.language === 'fr' ? 'Distance' : i18n.language === 'en' ? 'Distance' : 'Mesafe'}
                      </span>
                    </div>
                    <p className="text-2xl font-bold">
                      {healthData.distance_km.toLocaleString(locale)}
                      <span className="text-sm font-normal ml-1">km</span>
                    </p>
                  </div>
                )}
                {healthData.sleep != null && (
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-500 to-blue-700 text-white">
                    <div className="flex items-center gap-2 mb-2 opacity-80">
                      <BedDouble className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        {i18n.language === 'fr' ? 'Sommeil' : i18n.language === 'en' ? 'Sleep' : 'Uyku'}
                      </span>
                    </div>
                    <p className="text-2xl font-bold">
                      {healthData.sleep}
                      <span className="text-sm font-normal ml-1">
                        {i18n.language === 'en' ? 'h' : i18n.language === 'fr' ? 'h' : 'sa'}
                      </span>
                    </p>
                  </div>
                )}
                {healthData.heartRate != null && (
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-purple-500 to-violet-700 text-white">
                    <div className="flex items-center gap-2 mb-2 opacity-80">
                      <Heart className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        {i18n.language === 'fr' ? 'Fréq. cardiaque' : i18n.language === 'en' ? 'Heart Rate' : 'Kalp Atışı'}
                      </span>
                    </div>
                    <p className="text-2xl font-bold">
                      {healthData.heartRate}
                      <span className="text-sm font-normal ml-1">bpm</span>
                    </p>
                  </div>
                )}
                {healthData.calories != null && (
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-400 to-indigo-500 text-white col-span-2">
                    <div className="flex items-center gap-2 mb-2 opacity-80">
                      <Flame className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        {i18n.language === 'fr' ? 'Calories actives' : i18n.language === 'en' ? 'Active Calories' : 'Aktif Kalori'}
                      </span>
                    </div>
                    <p className="text-2xl font-bold">
                      {healthData.calories.toLocaleString(locale)}
                      <span className="text-sm font-normal ml-1">kcal</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

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
          {activity.note && (activity as any).created_via !== 'healthkit' && (
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
