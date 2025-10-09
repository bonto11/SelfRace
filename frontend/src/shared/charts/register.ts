// register.ts
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartData, 
  ChartOptions
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

if (typeof window !== "undefined") {
  // uvidíš raz v konzole na /activity
  console.log("[charts] registered controllers/plugins");
}