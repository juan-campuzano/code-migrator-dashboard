import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  Repository,
  IngestionRecord,
  RepositoryMetadata,
  RepositoryLanguage,
  RepositoryFramework,
  RepositoryDependency,
  FreshnessResponse,
} from '../models/repository.models';

@Injectable()
export class RepositoryService {
  private readonly apiBase = '/api';

  constructor(private readonly http: HttpClient) {}

  listRepositories(): Observable<Repository[]> {
    return this.http.get<Repository[]>(`${this.apiBase}/repositories`);
  }

  triggerIngestion(source: { type: string; path?: string; url?: string }): Observable<{ ingestionId: string }> {
    return this.http.post<{ ingestionId: string }>(`${this.apiBase}/ingestions`, { source });
  }

  getIngestionStatus(ingestionId: string): Observable<IngestionRecord> {
    return this.http.get<IngestionRecord>(`${this.apiBase}/ingestions/${ingestionId}`);
  }

  getRepositoryMetadata(repositoryId: string): Observable<RepositoryMetadata> {
    return this.http.get<RepositoryMetadata>(`${this.apiBase}/repositories/${repositoryId}/metadata`);
  }

  getLanguages(repositoryId: string): Observable<RepositoryLanguage[]> {
    return this.http.get<RepositoryLanguage[]>(`${this.apiBase}/repositories/${repositoryId}/languages`);
  }

  getFrameworks(repositoryId: string): Observable<RepositoryFramework[]> {
    return this.http.get<RepositoryFramework[]>(`${this.apiBase}/repositories/${repositoryId}/frameworks`);
  }

  getDependencies(repositoryId: string): Observable<RepositoryDependency[]> {
    return this.http.get<RepositoryDependency[]>(`${this.apiBase}/repositories/${repositoryId}/dependencies`);
  }

  updateTokens(tokens: { provider: string; token: string }): Observable<void> {
    return this.http.put<void>(`${this.apiBase}/settings/tokens`, tokens);
  }

  getTokens(): Observable<{ providers: string[] }> {
    return this.http.get<{ providers: string[] }>(`${this.apiBase}/settings/tokens`);
  }

  getFreshness(repositoryId: string, ecosystem?: string): Observable<FreshnessResponse> {
    let params = new HttpParams();
    if (ecosystem) {
      params = params.set('ecosystem', ecosystem);
    }
    return this.http.get<FreshnessResponse>(
      `${this.apiBase}/repositories/${repositoryId}/freshness`,
      { params },
    );
  }

  refreshFreshness(repositoryId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiBase}/repositories/${repositoryId}/freshness/refresh`,
      {},
    );
  }
}
