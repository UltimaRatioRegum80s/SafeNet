import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Map, WifiOff, Clock, LogOut, Navigation, User } from 'lucide-react';
import { useFeedIncidents } from '@/features/incidents/useFeedIncidents';
import {
  TAXONOMY_GROUPS,
  TAXONOMY_GROUP_ORDER,
  TaxonomyGroupId,
  resolveToV2Type
} from '@/features/report/taxonomyV2';
import { useAuthStore } from '@/store/auth';
import { clearAllOfflineData } from '@/lib/offlineDb';
import { queryClient } from '@/lib/queryClient';
import { useCityFallbackCoords } from '@/hooks/useCityFallbackCoords';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { PieChart, Pie, Cell, Sector } from 'recharts';

const DEFAULT_SINCE_HOURS = 24;

type GroupCounts = Record<TaxonomyGroupId, number>;

const GROUP_COLORS: Record<TaxonomyGroupId, string> = {
  critical: '#ef4444',
  emergency: '#f97316',
  services: '#f59e0b',
  nabor_note: '#06b6d4',
};

const CHART_CONFIG: ChartConfig = {
  critical: { label: 'Critical', color: GROUP_COLORS.critical },
  emergency: { label: 'Emergency', color: GROUP_COLORS.emergency },
  services: { label: 'Services', color: GROUP_COLORS.services },
  nabor_note: { label: 'Nabor Note', color: GROUP_COLORS.nabor_note },
};

// ─── Radial ring gauge helpers ────────────────────────────────────────────────
// Clock-angle convention: 0° = 12 o'clock, increases clockwise.
function clockPt(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}
function arcD(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  if (sweepDeg <= 0) return '';
  const clampedSweep = Math.min(sweepDeg, 359.99);
  const s = clockPt(cx, cy, r, startDeg);
  const e = clockPt(cx, cy, r, startDeg + clampedSweep);
  const large = clampedSweep > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

const RING_START = 225;
const RING_SWEEP = 270;
const RING_WIDTH = 9;

const RING_DEFS: { groupId: TaxonomyGroupId; r: number }[] = [
  { groupId: 'critical',   r: 66 },
  { groupId: 'emergency',  r: 50 },
  { groupId: 'services',   r: 34 },
  { groupId: 'nabor_note', r: 18 },
];

interface RingsGaugeProps {
  counts: GroupCounts;
  total: number;
  onGroupClick: (groupId: TaxonomyGroupId) => void;
}

function RingsGauge({ counts, total, onGroupClick }: RingsGaugeProps) {
  const [hoveredRing, setHoveredRing] = useState<TaxonomyGroupId | null>(null);
  const maxCount = Math.max(...Object.values(counts), 1);
  const cx = 80;
  const cy = 86;

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="shrink-0">
        <svg
          viewBox="0 0 160 160"
          width={148}
          height={148}
          role="img"
          aria-label="Category ring gauge"
        >
          {RING_DEFS.map(({ groupId, r }) => {
            const count = counts[groupId];
            const fill = count > 0 ? RING_START + (count / maxCount) * RING_SWEEP : 0;
            const isHovered = hoveredRing === groupId;
            const color = GROUP_COLORS[groupId];
            const trackOpacity = isHovered ? 0.18 : 0.10;
            const strokeW = isHovered ? RING_WIDTH + 2 : RING_WIDTH;

            return (
              <g
                key={groupId}
                style={{ cursor: 'pointer' }}
                onClick={() => onGroupClick(groupId)}
                onMouseEnter={() => setHoveredRing(groupId)}
                onMouseLeave={() => setHoveredRing(null)}
              >
                {/* Track (background arc) */}
                <path
                  d={arcD(cx, cy, r, RING_START, RING_SWEEP)}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  opacity={trackOpacity}
                />
                {/* Filled arc proportional to count */}
                {count > 0 && (
                  <path
                    d={arcD(cx, cy, r, RING_START, fill)}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    opacity={isHovered ? 1 : 0.85}
                    style={{ transition: 'opacity 0.15s, stroke-width 0.15s' }}
                  />
                )}
                {/* End dot for count > 0 */}
                {count > 0 && (() => {
                  const tip = clockPt(cx, cy, r, RING_START + fill);
                  return (
                    <circle
                      cx={tip.x}
                      cy={tip.y}
                      r={isHovered ? 4.5 : 3.5}
                      fill={color}
                      opacity={isHovered ? 1 : 0.9}
                      style={{ transition: 'r 0.15s' }}
                    />
                  );
                })()}
              </g>
            );
          })}

          {/* Centre total */}
          <text
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            dominantBaseline="auto"
            fontSize="22"
            fontWeight="700"
            fill="currentColor"
            className="fill-slate-800 dark:fill-slate-100"
          >
            {total}
          </text>
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            dominantBaseline="auto"
            fontSize="9"
            fill="currentColor"
            className="fill-slate-500 dark:fill-slate-400"
          >
            nearby
          </text>
        </svg>
      </div>

      {/* Legend labels */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {RING_DEFS.map(({ groupId }) => {
          const group = TAXONOMY_GROUPS[groupId];
          const count = counts[groupId];
          const color = GROUP_COLORS[groupId];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <button
              key={groupId}
              onClick={() => onGroupClick(groupId)}
              className="flex items-center gap-2 text-left rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60 active:scale-[0.98]"
            >
              <span
                className="w-2.5 h-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">
                {group.emoji} {group.label}
              </span>
              <span
                className="text-sm font-bold tabular-nums shrink-0"
                style={{ color }}
              >
                {count}
              </span>
              {total > 0 && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums w-7 text-right shrink-0">
                  {pct}%
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Active donut slice shape ────────────────────────────────────────────────
function ActiveDonutSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 7}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 9}
        outerRadius={outerRadius + 11}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.4}
      />
    </g>
  );
}

// ─── Pie percentage label ────────────────────────────────────────────────────
function PieLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.52;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight={700}
      style={{ pointerEvents: 'none' }}
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function CommunityDashboard() {
  const [, setLocation] = useLocation();
  const { logout, user } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);

  const cityFallback = useCityFallbackCoords();
  const { incidents, hasValidLocation, hasAnyLocation, isCityFallback, locationStatus } = useFeedIncidents({
    cityFallback: cityFallback ?? undefined,
  });

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (_) {}
    try { await clearAllOfflineData(); } catch (_) {}
    queryClient.clear();
    logout();
    setLocation('/');
  };

  const groupCounts = useMemo<GroupCounts>(() => {
    const counts: GroupCounts = { services: 0, nabor_note: 0, emergency: 0, critical: 0 };
    const cutoff = Date.now() - DEFAULT_SINCE_HOURS * 3600 * 1000;
    for (const inc of incidents) {
      if (new Date(inc.createdAt).getTime() < cutoff) continue;
      const v2 = resolveToV2Type(inc.type);
      if (v2 && v2.groupId in counts) counts[v2.groupId as TaxonomyGroupId]++;
    }
    return counts;
  }, [incidents]);

  const myGroupCounts = useMemo<GroupCounts>(() => {
    const counts: GroupCounts = { services: 0, nabor_note: 0, emergency: 0, critical: 0 };
    if (!user?.id) return counts;
    const cutoff = Date.now() - DEFAULT_SINCE_HOURS * 3600 * 1000;
    for (const inc of incidents) {
      if (inc.userId !== user.id) continue;
      if (new Date(inc.createdAt).getTime() < cutoff) continue;
      const v2 = resolveToV2Type(inc.type);
      if (v2 && v2.groupId in counts) counts[v2.groupId as TaxonomyGroupId]++;
    }
    return counts;
  }, [incidents, user?.id]);

  const totalCount = Object.values(groupCounts).reduce((a, b) => a + b, 0);
  const myTotalCount = Object.values(myGroupCounts).reduce((a, b) => a + b, 0);

  const pieData = useMemo(() =>
    TAXONOMY_GROUP_ORDER
      .map(g => ({ name: g, label: TAXONOMY_GROUPS[g].label, value: groupCounts[g], fill: GROUP_COLORS[g] }))
      .filter(d => d.value > 0),
    [groupCounts]
  );

  const handleGroupClick = (groupId: TaxonomyGroupId) => setLocation(`/community/feed?group=${groupId}`);

  return (
    <div className="p-4 space-y-5">

      {isCityFallback && cityFallback && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 text-sm text-blue-700 dark:text-blue-300">
          <Navigation className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Showing activity near <strong>{cityFallback.cityName}</strong>. Enable location for a more precise view.</span>
        </div>
      )}

      {!hasAnyLocation && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Enable location access or set your city in your profile to see nearby activity.</span>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span>{isCityFallback && cityFallback ? cityFallback.cityName : 'Near you'}</span>
          <span className="mx-1">•</span>
          <Clock className="h-4 w-4" />
          <span>Last 24 hours</span>
        </div>
        {locationStatus === 'stale' && (
          <div className="flex items-center gap-1 text-amber-500">
            <WifiOff className="h-3.5 w-3.5" />
            <span className="text-xs">Cached</span>
          </div>
        )}
      </div>

      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
        <CardContent className="p-5">
          <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100 mb-1">
            {!hasAnyLocation ? 'Location unavailable'
              : totalCount === 0 ? 'All quiet nearby'
              : totalCount === 1 ? '1 report nearby'
              : `${totalCount} reports nearby`}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {!hasAnyLocation
              ? 'Set your city in your profile to see local activity.'
              : totalCount === 0
              ? 'No activity reported in your area recently.'
              : 'Tap a category ring below for details.'}
          </p>
        </CardContent>
      </Card>

      {/* ── Radial Ring Gauge replacing 4-card grid ── */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Category overview
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {!hasAnyLocation ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-2">
              Enable location to see nearby activity.
            </p>
          ) : (
            <RingsGauge
              counts={groupCounts}
              total={totalCount}
              onGroupClick={handleGroupClick}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Personal stats ── */}
      {user && (
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Your reports today
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {myTotalCount === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                You haven't submitted any reports in this area in the last 24 hours.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {TAXONOMY_GROUP_ORDER.filter(g => myGroupCounts[g] > 0).map(g => (
                  <span
                    key={g}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${getGroupBadgeClasses(g)}`}
                  >
                    <span>{TAXONOMY_GROUPS[g].emoji}</span>
                    <span>{myGroupCounts[g]} {TAXONOMY_GROUPS[g].label}</span>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Community breakdown donut (enhanced) ── */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Community breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {!hasAnyLocation ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-2">
              Enable location to see community activity.
            </p>
          ) : pieData.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-2">
              No community reports nearby in the last 24 hours.
            </p>
          ) : (
            <>
              <ChartContainer config={CHART_CONFIG} className="aspect-square max-h-52 w-full">
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        nameKey="label"
                        formatter={(value, _name, item) => (
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.payload.fill }} />
                            <span className="text-muted-foreground">{item.payload.label}</span>
                            <span className="font-mono font-medium tabular-nums ml-auto">
                              {value} ({Math.round((Number(value) / totalCount) * 100)}%)
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="52%"
                    outerRadius="76%"
                    paddingAngle={2}
                    strokeWidth={0}
                    activeIndex={activeDonutIndex ?? undefined}
                    activeShape={ActiveDonutSlice}
                    label={PieLabel}
                    labelLine={false}
                    cursor="pointer"
                    onClick={(_data, index) =>
                      setActiveDonutIndex(prev => (prev === index ? null : index))
                    }
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
                {pieData.map((d, i) => (
                  <button
                    key={d.name}
                    onClick={() => setActiveDonutIndex(prev => (prev === i ? null : i))}
                    className={`flex items-center gap-1.5 text-xs rounded px-1.5 py-0.5 transition-colors ${
                      activeDonutIndex === i
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: d.fill }} />
                    <span>{d.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => setLocation('/community/feed')}>
          View Feed
        </Button>
        <Button variant="default" className="flex-1 gap-2" onClick={() => setLocation('/community/map')}>
          <Map className="h-4 w-4" />
          View Map
        </Button>
      </div>

      <Button
        variant="ghost"
        className="w-full gap-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 mt-2"
        onClick={handleLogout}
        disabled={loggingOut}
        data-testid="logout-button"
      >
        <LogOut className="h-4 w-4" />
        {loggingOut ? 'Logging out…' : 'Log out'}
      </Button>
    </div>
  );
}

function getGroupBadgeClasses(groupId: TaxonomyGroupId): string {
  switch (groupId) {
    case 'services':   return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    case 'nabor_note': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300';
    case 'emergency':  return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
    case 'critical':   return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-800';
    default:           return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  }
}
