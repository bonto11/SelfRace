// register.ts
import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
Chart.register(annotationPlugin, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

