/**
 * Deployment Smoke Suite Job
 */

import { DeploymentReceipt } from "../models/DeploymentReceipt";
import { IntegrityPagesSmokeCheck } from "./integrity_pages_smoke_check";
import { RunExplorerLookupSmokeCheck } from "./run_explorer_lookup_smoke_check";
import { ProofVerifyEndpointSmokeCheck } from "./proof_verify_endpoint_smoke_check";
import { LadderSubmitSmokeCheck } from "./ladder_submit_smoke_check";
import { WaitlistJoinInviteSmokeCheck } from "./waitlist_join_invite_smoke_check";
import { HostOSKitClaimSmokeCheck } from "./host_os_kit_claim_smoke_check";
import { CreatorSubmissionSmokeCheck } from "./creator_submission_smoke_check";

export class DeploymentSmokeSuiteJob {
    public async run(): Promise<DeploymentReceipt> {
        const integrityPagesResult = await IntegrityPagesSmokeCheck.run();
        const runExplorerLookupResult = await RunExplorerLookupSmokeCheck.run();
        const proofVerifyEndpointResult = await ProofVerifyEndpointSmokeCheck.run();
        const ladderSubmitResult = await LadderSubmitSmokeCheck.run();
        const waitlistJoinInviteResult = await WaitlistJoinInviteSmokeCheck.run();
        const hostOSKitClaimResult = await HostOSKitClaimSmokeCheck.run();
        const creatorSubmissionResult = await CreatorSubmissionSmokeCheck.run();

        return new DeploymentReceipt(
            integrityPagesResult.success,
            runExplorerLookupResult.success,
            proofVerifyEndpointResult.success,
            ladderSubmitResult.success,
            waitlistJoinInviteResult.success,
            hostOSKitClaimResult.success,
            creatorSubmissionResult.success
        );
    }
}

/**
 * Integrity Pages Smoke Check
 */

// ... (same for other smoke checks)
