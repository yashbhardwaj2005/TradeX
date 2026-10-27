import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { money } from '../utils/format';
import { Empty } from './Shared';
const colors = ['#9590f2', '#5aaab8', '#dcab7e', '#c78cae', '#76b99d', '#708cb7', '#999b6a'];
export function PerformanceChart({ snapshots = [], height = 260 }) {
  if (snapshots.length < 2)
    return (
      <div className="chart-empty" style={{ minHeight: height }}>
        <Empty
          title="Your story starts here"
          description="Make your first trade. Account snapshots will build your performance history over time."
        />
      </div>
    );
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={snapshots} margin={{ top: 15, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9690f2" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#9690f2" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#232b3c" strokeDasharray="3 4" vertical={false} />
        <XAxis
          dataKey="createdAt"
          tickFormatter={(v) =>
            new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
          }
          tick={{ fill: '#68758c', fontSize: 10 }}
          minTickGap={55}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={['auto', 'auto']}
          tickFormatter={(v) => `₹${(v / 10000000).toFixed(2)}L`}
          tick={{ fill: '#68758c', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={65}
        />
        <Tooltip
          contentStyle={{
            background: '#171e2e',
            border: '1px solid #333e55',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => new Date(v).toLocaleString('en-IN')}
          formatter={(value) => [money(value), 'Account equity']}
        />
        <Area
          type="linear"
          dataKey="equity"
          stroke="#a39ef9"
          fill="url(#equityFill)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
export function AllocationChart({ allocation = [], equity = 0 }) {
  return (
    <>
      <div className="allocation-graphic">
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Pie
              data={allocation}
              dataKey="value"
              nameKey="name"
              innerRadius={69}
              outerRadius={85}
              paddingAngle={allocation.length > 1 ? 3 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {allocation.map((a, i) => (
                <Cell key={a.name} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => money(value)}
              contentStyle={{
                background: '#171e2e',
                border: '1px solid #333e55',
                borderRadius: 8,
                fontSize: 11,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="allocation-center">
          <span>ACCOUNT EQUITY</span>
          <strong>{money(equity, 0)}</strong>
        </div>
      </div>
      <div className="allocation-legend">
        {allocation.map((a, i) => (
          <div key={a.name}>
            <span>
              <i style={{ background: colors[i % colors.length] }} />
              {a.name}
            </span>
            <strong>{equity ? ((a.value / equity) * 100).toFixed(1) : '0'}%</strong>
          </div>
        ))}
      </div>
    </>
  );
}
