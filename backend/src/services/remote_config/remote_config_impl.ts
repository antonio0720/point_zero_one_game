import { RemoteConfigService } from './remote-config.service';

declare class RemoteConfigImpl implements RemoteConfigService {
  constructor(private readonly remoteConfigApi: string) {}

  /**
   * Get the flags for cockpit modules.
   */
  public async getCockpitModulesFlags(): Promise<CockpitModuleFlag[]> {
    // Implementation details omitted for brevity.
  }

  /**
   * Get the flags for overlays.
   */
  public async getOverlaysFlags(): Promise<OverlayFlag[]> {
    // Implementation details omitted for brevity.
  }

  /**
   * Inject early pressure event.
   */
  public injectEarlyPressureEvent(event: PressureEvent): void {
    // Implementation details omitted for brevity.
  }

  /**
   * Set macro twist timing.
   */
  public setMacroTwistTiming(timing: MacroTwistTiming): void {
    // Implementation details omitted for brevity.
  }

  /**
   * Get after-screen variants.
   */
  public getAfterScreenVariants(): AfterScreenVariant[] {
    // Implementation details omitted for brevity.
  }
}

export { RemoteConfigImpl };

