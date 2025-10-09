'use client';

import {
  Chart as ChartJS,
  // scales
  CategoryScale,
  LinearScale,
  // controllers
  BarController,
  LineController,
  // elements
  BarElement,
  LineElement,
  PointElement,
  // plugins
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// (ak používaš anotácie, odkomentuj):
import annotationPlugin from 'chartjs-plugin-annotation';

let _registered = false;

/**
 * Zaregistruje všetko potrebné pre bar/line aj MIXED grafy.
 * Volaj iba z client komponentov.
 */
export function ensureChartJSRegistered() {
  if (_registered) return;

  ChartJS.register(
    // scales
    CategoryScale,
    LinearScale,
    // controllers
    BarController,
    LineController,
    // elements
    BarElement,
    LineElement,
    PointElement,
    // plugins
    Title,
    Tooltip,
    Legend,
    Filler,
    annotationPlugin,
  );

  _registered = true;
}
