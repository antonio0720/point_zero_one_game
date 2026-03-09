/**
 * Flags V2 Service for remote configuration management.
 */

import { RemoteConfigClient } from '@google-cloud/remote-config';

/**
 * Configuration flag names.
 */
export enum FlagName {
  /**
   * Enables or disables the staged rollout of a micro-patch.
   */
  STAGED_ROLLOUT = 'stagedRollout',

  /**
   * Sets the default value for a flag if it's not found in the remote config.
   */
  DEFAULT_VALUE = 'defaultValue',
}

/**
 * Represents a configuration flag with its name, type, and default value.
 */
export interface Flag {
  name: FlagName;
  type: string;
  defaultValue: any;
}

/**
 * The RemoteConfig client instance.
 */
let remoteConfigClient: RemoteConfigClient;

/**
 * Initializes the flags V2 service with a Google Cloud Remote Config client.
 *
 * @param projectId - The ID of the Google Cloud project.
 * @param location - The location of the Remote Config service.
 */
export async function init(projectId: string, location: string): Promise<void> {
  remoteConfigClient = new RemoteConfigClient({ projectId });
  await remoteConfigClient.createProject(location);
}

/**
 * Sets a flag in the Remote Config service.
 *
 * @param flag - The flag to set.
 */
export async function setFlag(flag: Flag): Promise<void> {
  const { name, type, defaultValue } = flag;
  await remoteConfigClient.setConfigurationSync({
    appId: 'PointZeroOneDigital',
    projectId,
    clientOptions: { location },
    resource: {
      parent: `projects/${projectId}/locations/${location}`,
      flags: [{ name, type, defaultValue }],
    },
  });
}

/**
 * Gets the value of a flag from the Remote Config service.
 *
 * @param flagName - The name of the flag to get.
 */
export async function getFlag(flagName: FlagName): Promise<any> {
  const response = await remoteConfigClient.getLatestRemoteConfig({
    appId: 'PointZeroOneDigital',
    projectId,
    clientOptions: { location },
  });

  return response.data?.flags?.find(({ name }) => name === flagName)?.value;
}
