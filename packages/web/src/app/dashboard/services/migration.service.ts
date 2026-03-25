import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { MigrationStatus } from '../models/repository.models';

@Injectable()
export class MigrationService {
  private readonly apiBase = '/api';

  constructor(private readonly http: HttpClient) {}

  triggerMigration(
    repositoryId: string,
    migrationType: string,
    parameters?: Record<string, unknown>,
  ): Observable<{ migrationId: string; status: string }> {
    return this.http.post<{ migrationId: string; status: string }>(
      `${this.apiBase}/migrations`,
      { repositoryId, migrationType, parameters },
    );
  }

  getMigrationStatus(migrationId: string): Observable<MigrationStatus> {
    return this.http.get<MigrationStatus>(`${this.apiBase}/migrations/${migrationId}`);
  }
}
