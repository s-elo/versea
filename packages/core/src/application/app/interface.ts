/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceSymbol } from '../../utils';

export const IAppKey = createServiceSymbol('IApp');

export interface AppHooks {
  bootstrap?: () => Promise<any>;
  mount: () => Promise<any>;
  unmount: () => Promise<any>;
}

export interface IApp {
  /** 应用名称 */
  name: string;

  /** 应用的路径 */
  path: string;

  /** 传给子应用的属性 */
  props: Record<string, any>;

  /** 加载应用的方法 */
  loadApp: () => Promise<AppHooks>;
}

export interface AppProps {
  name: string;
  path: string;
  props: Record<string, any>;
  loadApp: () => Promise<AppHooks>;
}
