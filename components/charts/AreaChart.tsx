"use client";

import {
  ResponsiveContainer,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface AreaChartProps {
  data: Array<{ date: string; value: number; value2?: number }>;
  dataKey?: string;
  dataKey2?: string;
  label?: string;
  label2?: string;
  color?: string;
  color2?: string;
  formatValue?: (value: number) => string;
  formatValue2?: (value: number) => string;
  height?: number;
}

export default function SpendAreaChart({
  data,
  dataKey = "value",
  dataKey2,
  label = "Valor",
  label2,
  color = "#F5A623",
  color2 = "#22C55E",
  formatValue = (v) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  formatValue2 = (v) => String(Math.round(v)),
  height = 300,
}: AreaChartProps) {
  const hasDualAxis = !!dataKey2;

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-4">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart data={data}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            {dataKey2 && (
              <linearGradient id="colorValue2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color2} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color2} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
          <XAxis
            dataKey="date"
            stroke="#707070"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="left"
            stroke="#707070"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatValue(v)}
          />
          {hasDualAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#707070"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatValue2(v)}
              allowDecimals={false}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "#242424",
              border: "1px solid #3A3A3A",
              borderRadius: "8px",
              color: "#F5F5F5",
              fontSize: "12px",
            }}
            formatter={(value, name) => {
              const isSecond = String(name) === (label2 || dataKey2);
              const formatted = isSecond
                ? formatValue2(Number(value))
                : formatValue(Number(value));
              return [formatted, String(name)];
            }}
            labelStyle={{ color: "#B0B0B0" }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            yAxisId="left"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorValue)"
            name={label}
          />
          {dataKey2 && (
            <Area
              type="monotone"
              dataKey={dataKey2}
              yAxisId={hasDualAxis ? "right" : "left"}
              stroke={color2}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue2)"
              name={label2 || dataKey2}
            />
          )}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
