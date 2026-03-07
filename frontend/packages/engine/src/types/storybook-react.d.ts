/**
 * storybook-react.d.ts — Local type shim for @storybook/react
 * Provides minimal Meta and StoryObj types so stories compile
 * without @storybook/react installed as a dev dependency.
 *
 * Place this file in: src/types/storybook-react.d.ts
 * (or any directory included in tsconfig.json compilerOptions.typeRoots)
 *
 * When storybook is installed (npx storybook init), delete this file —
 * the real types from node_modules/@storybook/react will take over.
 */

declare module '@storybook/react' {
  import type { ComponentType, ComponentProps } from 'react';

  export interface Parameters {
    layout?:      'centered' | 'fullscreen' | 'padded';
    backgrounds?: {
      default?: string;
      values?:  Array<{ name: string; value: string }>;
    };
    [key: string]: unknown;
  }

  export interface StoryContext {
    args:       Record<string, unknown>;
    parameters: Parameters;
  }

  /**
   * Meta — story file-level configuration.
   * T = the component type (e.g. typeof MyComponent).
   */
  export type Meta<T extends ComponentType<any> = ComponentType<any>> = {
    title?:       string;
    component?:   T;
    parameters?:  Parameters;
    tags?:        string[];
    argTypes?:    Partial<Record<keyof ComponentProps<T>, unknown>>;
    args?:        Partial<ComponentProps<T>>;
    decorators?:  Array<(story: () => JSX.Element, ctx: StoryContext) => JSX.Element>;
  };

  /**
   * StoryObj — individual story definition.
   * T = Meta<typeof Component> or ComponentType directly.
   */
  export type StoryObj<T = unknown> =
    T extends ComponentType<infer P>
      ? { name?: string; args?: Partial<P>; parameters?: Parameters; render?: (args: P) => JSX.Element }
      : T extends Meta<infer C>
        ? C extends ComponentType<infer P>
          ? { name?: string; args?: Partial<P>; parameters?: Parameters; render?: (args: P) => JSX.Element }
          : { name?: string; args?: Record<string, unknown>; parameters?: Parameters }
        : { name?: string; args?: Record<string, unknown>; parameters?: Parameters };
}