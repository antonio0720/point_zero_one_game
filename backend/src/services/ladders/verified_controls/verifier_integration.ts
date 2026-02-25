/**
 * Verifier Integration Service
 */

import { Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/** Verifier Grpc Service */
@Injectable()
export class VerifierIntegrationService {
  constructor(private readonly grpcClient: ClientGrpc) {}

  private readonly verifier = this.grpcClient.getService<VerifierService>('Verifier');

  /**
   * Get verification status for a given ladder entry ID
   * @param ladderEntryId - The ID of the ladder entry to verify
   */
  public getVerificationStatus(ladderEntryId: string): Observable<VerificationStatus> {
    return from(this.verifier.GetVerificationStatus({ ladderEntryId })).pipe(
      map((response) => response.toObject()),
      catchError((error) => Observable.throw(error))
    );
  }

  /**
   * Publish a new ladder entry if verification is successful, quarantine otherwise
   * @param ladderEntry - The ladder entry to verify and process
   */
  public async processLadderEntry(ladderEntry: LadderEntry): Promise<void> {
    const verificationStatus = await this.getVerificationStatus(ladderEntry.id).toPromise();

    if (verificationStatus.status === 'VERIFIED') {
      // Publish the ladder entry
      // ...
    } else {
      // Quarantine the ladder entry
      // ...
    }
  }
}

/** Verifier Service Grpc Definition */
export const VerifierService = {
  GetVerificationStatus: {
    requestStream: false,
    responseStream: false,
    requestType: 'LadderEntryId',
    responseType: 'VerificationStatus'
  } as const;
}

/** Ladder Entry Interface */
export interface LadderEntry {
  id: string;
  // ... other ladder entry properties
}

/** Verification Status Interface */
export interface VerificationStatus {
  status: 'VERIFIED' | 'FAILED';
  // ... other verification status properties
}
