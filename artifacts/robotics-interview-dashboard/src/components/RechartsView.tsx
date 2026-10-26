import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ChartDatum {
  label: string;
  value: number;
}

const CHART_PALETTE = ["#16869a", "#edb52c", "#466896", "#3aa582", "#bd5047", "#7c6fae", "#e07b39", "#5b8c5a"];

export interface RechartsViewProps {
  kind: "pie" | "line";
  data: ChartDatum[];
  xAxisLabel: string;
  yAxisLabel: string;
}

/**
 * The recharts-backed views, kept in their own module so the charting
 * library is only downloaded when a team actually builds a custom chart.
 * It is the single heaviest dependency in the app and every phone pays for
 * it on the first paint otherwise.
 */
export function RechartsView({ kind, data, xAxisLabel, yAxisLabel }: RechartsViewProps) {
  if (kind === "pie") {
    return (
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2} strokeWidth={0}>
              {data.map((entry, index) => (
                <Cell key={`${entry.label}-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 28, left: -14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4eceb" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#7b8a8f" }}
            interval="preserveStart"
            angle={-25}
            dy={10}
            label={{ value: xAxisLabel, position: "insideBottom", offset: -18, fontSize: 10, fill: "#7b8a8f" }}
          />
          <YAxis allowDecimals={yAxisLabel !== "Applicant count"} tick={{ fontSize: 10, fill: "#7b8a8f" }} label={{ value: yAxisLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "#7b8a8f" }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#16869a" strokeWidth={2} dot={{ r: 3, fill: "#16869a" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RechartsView;
