import {
  AppConfig,
  buildProviderModule,
  IApp,
  IAppService,
  IConfig,
  IHooks,
  IPlugin,
  IPrefetchService,
  IRouter,
  IRouteState,
  IStarter,
  provideValue,
  PrefetchOptions,
} from '@versea/core';
import { Container } from 'inversify';

export * from '@versea/core';

export class Versea {
  public container: Container;

  constructor(config: Partial<IConfig> = {}) {
    provideValue(config, IConfig);
    this.container = new Container({ defaultScope: 'Singleton' });
    this.container.load(buildProviderModule(this.container));
  }

  public get appService(): IAppService {
    return this.container.get<IAppService>(IAppService);
  }

  public get hooks(): IHooks {
    return this.container.get<IHooks>(IHooks);
  }

  public get router(): IRouter {
    return this.container.get<IRouter>(IRouter);
  }

  public get routeState(): IRouteState {
    return this.container.get<IRouteState>(IRouteState);
  }

  public get starter(): IStarter {
    return this.container.get<IStarter>(IStarter);
  }

  public registerApp(config: AppConfig): IApp {
    return this.appService.registerApp(config);
  }

  public registerApps(configList: AppConfig[]): IApp[] {
    return this.appService.registerApps(configList);
  }

  public registerRootParcel(config: AppConfig): IApp {
    return this.appService.registerRootParcel(config);
  }

  public async start(): Promise<void> {
    return this.starter.start();
  }

  public async reroute(navigationEvent?: Event): Promise<void> {
    return this.router.reroute(navigationEvent);
  }

  public async prefetch(apps: string[], options?: PrefetchOptions): Promise<void> {
    const prefetchService = this.container.get<IPrefetchService>(IPrefetchService);
    await prefetchService.fetch(apps, options);
  }

  /** 使用插件 */
  public use(
    plugin:
      | string
      | symbol
      | ((container: Container) => void)
      | {
          apply: (container: Container) => void;
        },
  ): void {
    if (typeof plugin === 'function') {
      plugin(this.container);
      return;
    }

    if (typeof plugin === 'object') {
      plugin.apply(this.container);
      return;
    }

    if (typeof plugin === 'string' || typeof plugin === 'symbol') {
      this.container.get<IPlugin>(plugin).apply();
      return;
    }
  }
}
