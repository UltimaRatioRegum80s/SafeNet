import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Map, WifiOff, Clock, LogOut, Navigation, User, Shield, Plus, Building2, ArrowUpRight } from 'lucide-react';
import { useFeedIncidents } from '@/features/incidents/useFeedIncidents';
import {
  TAXONOMY_GROUPS,
  TAXONOMY_GROUP_ORDER,
  TaxonomyGroupId,
  resolveToV2Type
} from '@/features/report/taxonomyV2';
import { useAuthStore } from '@/store/auth';
import { logout as endSession } from '@/lib/auth';
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
    // One sign-out path for the whole app: cancel in-flight requests, drop the
    // cached queries and this account's web storage, end the server session,
    // then clear the offline database and caches. See client/src/lib/auth.ts.
    await endSession();
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
 <div className="nn-dashboard">
  <div className="nn-page-heading"><div><p className="nn-eyebrow">A LITTLE CLOSER. A LITTLE SAFER.</p><h1>Your neighborhood,<br/><span>at a glance.</span></h1></div></div>
  <div className="nn-location-line"><MapPin size={15}/><strong>{isCityFallback&&cityFallback?cityFallback.cityName:'Near you'}</strong><span>Last 24 hours</span>{locationStatus==='stale'&&<span><WifiOff size={13}/> Cached</span>}</div>
  <section className="nn-overview-hero"><div className="nn-hero-copy"><span className="nn-live-label"><span/> COMMUNITY PULSE</span><h2>{!hasAnyLocation?'Find your neighborhood':totalCount===0?'No recent reports.':totalCount+' local '+(totalCount===1?'update.':'updates.')}</h2><p>{!hasAnyLocation?'Enable location or set your city to explore nearby activity.':totalCount===0?'Stay connected to the people and places around you.':'See what your neighbors are sharing, and stay in the know.'}</p><button onClick={()=>setLocation('/community/map')} className="nn-hero-link">Explore the map <ArrowUpRight size={18}/></button></div><div className="nn-radar" aria-hidden="true"><i/><i/><i/><span><Shield size={30}/></span><b/><b/></div></section>
  {isCityFallback&&cityFallback&&<p className="nn-location-note"><Navigation size={14}/><span>Using {cityFallback.cityName}. Enable location for a more precise view.</span></p>}
  <div className="nn-section-heading"><h2>What would you like to do?</h2></div>
  <div className="nn-quick-actions"><button onClick={()=>setLocation('/community/report')}><span className="nn-action-icon"><Plus size={23}/></span><strong>Share a report</strong><small>Let neighbors know</small><ArrowUpRight size={17}/></button><button onClick={()=>setLocation('/community/services')}><span className="nn-action-icon amber"><Building2 size={23}/></span><strong>Find local help</strong><small>Services & requests</small><ArrowUpRight size={17}/></button></div>
  <div className="nn-section-heading"><h2>Nearby activity</h2><button onClick={()=>setLocation('/community/feed')}>View feed <ArrowUpRight size={15}/></button></div>
  <div className="nn-category-grid">{TAXONOMY_GROUP_ORDER.map(g=><button key={g} onClick={()=>handleGroupClick(g)} className={'nn-category nn-category-'+g}><span className="nn-category-dot" style={{background:GROUP_COLORS[g]}}/><span>{TAXONOMY_GROUPS[g].label}</span><strong>{hasAnyLocation?groupCounts[g]:'—'}</strong><ArrowUpRight size={14}/></button>)}</div>
  <div className="nn-personal-row"><span className="nn-personal-icon"><User size={20}/></span><div><strong>Your contribution</strong><p>{myTotalCount===0?'Your next observation could help a neighbor.':myTotalCount+' reports shared nearby in the last 24 hours.'}</p></div><span className="nn-personal-count">{myTotalCount}</span></div>
  <details className="nn-insights"><summary>Explore community insights <span>Categories & your reports</span></summary><div className="nn-insights-body">{hasAnyLocation?<RingsGauge counts={groupCounts} total={totalCount} onGroupClick={handleGroupClick}/>:<p>Enable location to see nearby activity.</p>}{pieData.length>0&&<ChartContainer config={CHART_CONFIG} className="aspect-square max-h-52 w-full"><PieChart><ChartTooltip content={<ChartTooltipContent nameKey="label"/>}/><Pie data={pieData} dataKey="value" nameKey="label" innerRadius="52%" outerRadius="76%" paddingAngle={2} strokeWidth={0} activeIndex={activeDonutIndex??undefined} activeShape={ActiveDonutSlice} label={PieLabel} labelLine={false} onClick={(_data,index)=>setActiveDonutIndex(prev=>prev===index?null:index)}>{pieData.map(entry=><Cell key={entry.name} fill={entry.fill}/>)}</Pie></PieChart></ChartContainer>}{myTotalCount>0&&<div className="flex flex-wrap gap-2 mt-4">{TAXONOMY_GROUP_ORDER.filter(g=>myGroupCounts[g]>0).map(g=><span key={g} className={'rounded-full px-3 py-1 text-xs '+getGroupBadgeClasses(g)}>{myGroupCounts[g]} {TAXONOMY_GROUPS[g].label}</span>)}</div>}</div></details>
  <p className="nn-dashboard-footnote"><Shield size={14}/> Community reports help you stay aware. They do not replace emergency services.</p>
  <Button variant="ghost" className="nn-logout" onClick={handleLogout} disabled={loggingOut} data-testid="logout-button"><LogOut size={16}/>{loggingOut?'Logging out…':'Log out'}</Button>
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
