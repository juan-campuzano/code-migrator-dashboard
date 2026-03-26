import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./dashboard/dashboard.module').then((m) => m.DashboardModule),
  },
  {
    path: 'metrics',
    loadChildren: () =>
      import('./metrics/metrics.module').then((m) => m.MetricsModule),
  },
  {
    path: 'mcp',
    loadChildren: () =>
      import('./mcp/mcp.module').then((m) => m.McpModule),
  },
];
