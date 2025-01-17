import {
  ExtensibleEntity,
  logError,
  logWarn,
  memoizePromise,
  VerseaError,
  VerseaNotFoundContainerError,
} from '@versea/shared';
import { omit } from 'ramda';

import { IAppSwitcherContext } from '../../app-switcher/app-switcher-context/interface';
import { IStatus } from '../../enum/status';
import { IHooks } from '../../hooks/interface';
import { MatchedRoute } from '../../navigation/route/interface';
import { provide } from '../../provider';
import { IAppService } from '../app-service/interface';
import {
  IApp,
  AppConfig,
  AppDependencies,
  AppProps,
  AppConfigProps,
  AppLifeCycles,
  AppMountedResult,
} from './interface';

export * from './interface';

@provide(IApp, 'Constructor')
export class App extends ExtensibleEntity implements IApp {
  public readonly name: string;

  public status: IStatus[keyof IStatus];

  public isLoaded = false;

  protected readonly _loadApp?: (props: AppProps) => Promise<AppLifeCycles>;

  protected readonly _props: AppConfigProps;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected readonly _Status: IStatus;

  protected readonly _appService: IAppService;

  protected readonly _hooks: IHooks;

  /** 加载应用返回的声明周期 */
  protected _lifeCycles: AppLifeCycles = {};

  /** 处理容器应用渲染完成控制器 */
  protected _containerController?: AppMountedResult['containerController'];

  protected readonly _parcels: IApp[] = [];

  /**
   * 生成一个 App 实例
   * @param config App 实例化的参数
   * @param dependencies 由于 App 继承 ExtensibleEntity，导致无法使用依赖注入，依赖必须自己管理。
   */
  constructor(config: AppConfig, dependencies: AppDependencies) {
    super(config);
    // 绑定依赖
    this._Status = dependencies.Status;
    this._appService = dependencies.appService;
    this._hooks = dependencies.hooks;

    this.name = config.name;
    this._props = config.props ?? {};
    this._loadApp = config.loadApp;
    this.status = this._Status.NotLoaded;
  }

  @memoizePromise()
  public async load(context?: IAppSwitcherContext): Promise<void> {
    if (this.status !== this._Status.NotLoaded && this.status !== this._Status.LoadError) {
      throw new VerseaError(`Can not load app "${this.name}" with status "${this.status}".`);
    }

    if (!this._loadApp) {
      this.status = this._Status.Broken;
      throw new VerseaError(`Can not find loadApp prop on app "${this.name}".`);
    }

    this.status = this._Status.LoadingSourceCode;
    try {
      const lifeCycles = await this._loadApp(this.getProps(context));
      this.isLoaded = true;
      this.status = this._Status.NotMounted;
      this._setLifeCycles(lifeCycles);
    } catch (error) {
      this.status = this._Status.LoadError;
      throw error;
    }
  }

  @memoizePromise()
  public async mount(context?: IAppSwitcherContext, route?: MatchedRoute): Promise<void> {
    if (this.status !== this._Status.NotMounted) {
      throw new VerseaError(`Can not mount app "${this.name}" with status "${this.status}".`);
    }

    if (!this._lifeCycles.mount) {
      this.status = this._Status.Mounted;
      return;
    }

    this.status = this._Status.Mounting;
    try {
      const result = await this._lifeCycles.mount(this.getProps(context, route));
      this._containerController = result?.containerController;
      this.status = this._Status.Mounted;
    } catch (error) {
      // 没有寻找到容器的错误可以被再次渲染
      if (error instanceof VerseaNotFoundContainerError) {
        this.status = this._Status.Mounted;
      } else {
        this.status = this._Status.Broken;
      }
      throw error;
    }
  }

  @memoizePromise()
  public async unmount(context?: IAppSwitcherContext, route?: MatchedRoute): Promise<void> {
    if (this.status !== this._Status.Mounted) {
      throw new VerseaError(`Can not unmount app "${this.name}" with status "${this.status}".`);
    }

    this.status = this._Status.Unmounting;

    await Promise.all(
      this._parcels.map(async (app): Promise<void> => {
        // mount 过程中，等待 mount 完成之后再执行 unmount
        if (app.status === this._Status.Mounting) {
          await app.mount();
        }

        if (app.status === this._Status.Mounted) {
          await app.unmount();
        }
      }),
    );

    if (!this._lifeCycles.unmount) {
      this.status = this._Status.NotMounted;
      return;
    }

    try {
      await this._lifeCycles.unmount(this.getProps(context, route));
      this.status = this._Status.NotMounted;
    } catch (error) {
      this.status = this._Status.Broken;
      throw error;
    }
  }

  @memoizePromise()
  public async waitForChildContainer(containerName: string, context: IAppSwitcherContext): Promise<void> {
    if (this.status !== this._Status.Mounted) {
      logError(`Can not run waiting because app "${this.name}" status is "${this.status}".`);
      return;
    }

    const appProps = this.getProps(context);
    if (!this._containerController) {
      logWarn(`Can not find waiting for function, it may cause mounting child app error.`, this.name);
      await this._hooks.waitForChildContainer.call({ containerName, appProps });
      return;
    }

    await this._containerController.wait(containerName, appProps);
    return;
  }

  public getProps(context?: IAppSwitcherContext, route?: MatchedRoute): AppProps {
    const props: Record<string, unknown> = typeof this._props === 'function' ? this._props(this.name) : this._props;
    return {
      ...props,
      app: this,
      context,
      route,
    };
  }

  public registerParcel(config: AppConfig): IApp {
    const appService = this._appService;
    if (appService.hasApp(config.name)) {
      logWarn(`Parcel "${config.name}" has been registered.`);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return appService.getApp(config.name)!;
    }

    const app = appService.registerApp(config, false);
    this._parcels.push(app);
    return app;
  }

  public async loadAndMount(): Promise<void> {
    if (!this.isLoaded) {
      await this.load();
    }

    try {
      await this.mount();
    } catch (error) {
      logError(error, this.name);
      this.status = this._Status.NotMounted;
    }
  }

  protected _setLifeCycles(lifeCycles: AppLifeCycles = {}): void {
    if (!lifeCycles.mount) {
      logWarn(`App does not export a valid mount function`, this.name);
    }

    if (!lifeCycles.unmount) {
      logWarn(`App does not export a valid unmount function`, this.name);
    }

    this._lifeCycles = lifeCycles;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected toJSON(): Record<string, unknown> {
    return omit(['_Status', '_appService'], this);
  }
}
