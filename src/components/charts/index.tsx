"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";

const COLORS = ["#0d9488", "#115e59", "#f59e0b", "#dc2626", "#16a34a", "#ea580c"];

interface AreaChartProps {
  data: any[];
  xKey: string;
  yKeys: { key: string; name: string; color?: string }[];
  height?: number;
}

export function AreaChartComponent({ data, xKey, yKeys, height = 300 }: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fontFamily: "inherit" }} />
        <YAxis tick={{ fontSize: 12, fontFamily: "inherit" }} />
        <Tooltip
          contentStyle={{
            direction: "rtl",
            fontFamily: "inherit",
            borderRadius: "0.5rem",
            border: "1px solid #e2e8f0",
          }}
        />
        <Legend wrapperStyle={{ fontFamily: "inherit", fontSize: 12 }} />
        {yKeys.map((k, i) => (
          <Area
            key={k.key}
            type="monotone"
            dataKey={k.key}
            name={k.name}
            stroke={k.color || COLORS[i % COLORS.length]}
            fill={k.color || COLORS[i % COLORS.length]}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface BarChartProps {
  data: any[];
  xKey: string;
  yKeys: { key: string; name: string; color?: string }[];
  height?: number;
}

export function BarChartComponent({ data, xKey, yKeys, height = 300 }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fontFamily: "inherit" }} />
        <YAxis tick={{ fontSize: 12, fontFamily: "inherit" }} />
        <Tooltip
          contentStyle={{
            direction: "rtl",
            fontFamily: "inherit",
            borderRadius: "0.5rem",
            border: "1px solid #e2e8f0",
          }}
        />
        <Legend wrapperStyle={{ fontFamily: "inherit", fontSize: 12 }} />
        {yKeys.map((k, i) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            name={k.name}
            fill={k.color || COLORS[i % COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

interface PieChartProps {
  data: { name: string; value: number }[];
  height?: number;
}

export function PieChartComponent({ data, height = 300 }: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            direction: "rtl",
            fontFamily: "inherit",
            borderRadius: "0.5rem",
            border: "1px solid #e2e8f0",
          }}
        />
        <Legend wrapperStyle={{ fontFamily: "inherit", fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface LineChartProps {
  data: any[];
  xKey: string;
  yKeys: { key: string; name: string; color?: string }[];
  height?: number;
}

export function LineChartComponent({ data, xKey, yKeys, height = 300 }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fontFamily: "inherit" }} />
        <YAxis tick={{ fontSize: 12, fontFamily: "inherit" }} />
        <Tooltip
          contentStyle={{
            direction: "rtl",
            fontFamily: "inherit",
            borderRadius: "0.5rem",
            border: "1px solid #e2e8f0",
          }}
        />
        <Legend wrapperStyle={{ fontFamily: "inherit", fontSize: 12 }} />
        {yKeys.map((k, i) => (
          <Line
            key={k.key}
            type="monotone"
            dataKey={k.key}
            name={k.name}
            stroke={k.color || COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

interface RadialGaugeProps {
  value: number;
  max?: number;
  label?: string;
  height?: number;
}

export function RadialGaugeComponent({ value, max = 100, label, height = 200 }: RadialGaugeProps) {
  const data = [{ name: label || "value", value, fill: value >= 80 ? "#16a34a" : value >= 50 ? "#f59e0b" : "#dc2626" }];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadialBarChart
        cx="50%"
        cy="50%"
        innerRadius="60%"
        outerRadius="100%"
        barSize={20}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <RadialBar background dataKey="value" cornerRadius={10} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

export { COLORS };
