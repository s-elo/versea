import { HookContext } from '@versea/tapable';

import { IApp } from '../../application/app/service';
import { MatchedResult } from '../../navigation/matcher/service';
import { createServiceSymbol } from '../../utils';
import { IAppSwitcherContext } from '../app-switcher-context/service';

export const ILogicLoaderHookContextKey = createServiceSymbol('ILogicLoaderHookContext');

/**
 * 逻辑 Loader 的 Hook 上下文
 * @description 在整个 load 的过程中会一直存在，会传给给中 load 的 hook。
 */
export interface ILogicLoaderHookContext extends HookContext {
  switcherContext: IAppSwitcherContext;

  /** 路由匹配的结果 */
  matchedResult: MatchedResult;

  /**
   * 需要加载的应用
   * @description 二维数组表示串行和并行。
   * @example [[A, B], [C, D]] 会优先并行加载[A, B]，再并行加载[C, D]。
   */
  targetApps: IApp[][];

  /** 当前需要加载的应用 */
  currentLoadApps: IApp[];
}

export interface LogicLoaderHookContextOptions {
  matchedResult: MatchedResult;
  switcherContext: IAppSwitcherContext;
}