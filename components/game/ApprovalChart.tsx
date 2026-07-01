'use client'

import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'

interface ApprovalChartProps {
  approvalHistory: number[]
}

export function ApprovalChart({ approvalHistory }: ApprovalChartProps) {
  if (approvalHistory.length < 2) return null

  const data = approvalHistory.map((value, i) => ({ month: i, approval: value }))

  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-paper-faint)]">
          Approval Over Time
        </span>
        <span className="font-mono text-[10px] text-[var(--color-paper-faint)]">
          {data.length - 1} {data.length - 1 === 1 ? 'month' : 'months'}
        </span>
      </div>
      <div className="mt-2 h-[120px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <XAxis dataKey="month" hide />
            <YAxis domain={[0, 100]} hide />
            <ReferenceLine y={50} stroke="var(--color-border-strong)" strokeDasharray="2 3" />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 2,
                fontSize: 11,
                fontFamily: 'var(--font-jetbrains)',
              }}
              labelFormatter={(m) => `Month ${m}`}
              formatter={(value) => [`${Math.round(Number(value))}%`, 'Approval']}
            />
            <Line
              type="monotone"
              dataKey="approval"
              stroke="var(--color-brass)"
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 3, fill: 'var(--color-brass)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
