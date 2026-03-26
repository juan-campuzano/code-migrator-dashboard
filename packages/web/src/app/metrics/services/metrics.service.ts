import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { MetricsSummaryResponse } from '../models/metrics.models';

@Injectable()
export class MetricsService {
  private readonly apiBase = '/api/metrics';

  constructor(private readonly http: HttpClient) {}

  getSummary(): Observable<MetricsSummaryResponse> {
    return this.http.get<MetricsSummaryResponse>(`${this.apiBase}/summary`);
  }
}
