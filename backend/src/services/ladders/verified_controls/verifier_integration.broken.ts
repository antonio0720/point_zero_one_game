import { Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, firstValueFrom, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface LadderEntry {
  id: string;
  [key: string]: unknown;
}

export interface VerificationStatus {
  status: 'VERIFIED' | 'FAILED';
  [key: string]: unknown;
}

interface VerifierGrpcService {
  GetVerificationStatus(input: { ladderEntryId: string }): Promise<VerificationStatus> | VerificationStatus;
}

@Injectable()
export class VerifierIntegrationService {
  private readonly verifier: VerifierGrpcService;

  constructor(private readonly grpcClient: ClientGrpc) {
    this.verifier = this.grpcClient.getService<VerifierGrpcService>('Verifier');
  }

  public getVerificationStatus(ladderEntryId: string): Observable<VerificationStatus> {
    return from(
      Promise.resolve(this.verifier.GetVerificationStatus({ ladderEntryId })),
    ).pipe(
      map((response) =>
        typeof (response as { toObject?: () => VerificationStatus }).toObject === 'function'
          ? (response as { toObject: () => VerificationStatus }).toObject()
          : (response as VerificationStatus),
      ),
      catchError((error) => throwError(() => error)),
    );
  }

  public async processLadderEntry(ladderEntry: LadderEntry): Promise<void> {
    const verificationStatus = await firstValueFrom(
      this.getVerificationStatus(ladderEntry.id),
    );

    if (verificationStatus.status === 'VERIFIED') {
      return;
    }
  }
}

export const VerifierService = {
  GetVerificationStatus: {
    requestStream: false,
    responseStream: false,
    requestType: 'LadderEntryId',
    responseType: 'VerificationStatus',
  },
} as const;
