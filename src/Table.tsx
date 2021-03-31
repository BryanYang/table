/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Feature:
 *  - fixed not need to set width
 *  - support `rowExpandable` to config row expand logic
 *  - add `summary` to support `() => ReactNode`
 *
 * Update:
 *  - `dataIndex` is `array[]` now
 *  - `expandable` wrap all the expand related props
 *
 * Removed:
 *  - expandIconAsCell
 *  - useFixedHeader
 *  - rowRef
 *  - columns[number].onCellClick
 *  - onRowClick
 *  - onRowDoubleClick
 *  - onRowMouseEnter
 *  - onRowMouseLeave
 *  - getBodyWrapper
 *  - bodyStyle
 *
 * Deprecated:
 *  - All expanded props, move into expandable
 */

/* eslint-disable @typescript-eslint/no-use-before-define */
import * as React from 'react';
import classNames from 'classnames';
import shallowEqual from 'shallowequal';
import ResizeObserver from 'resize-observer-polyfill';
import addEventListener from 'rc-util/lib/Dom/addEventListener';
import warning from 'rc-util/lib/warning';
import { Provider, create } from 'mini-store';
import ResizeObserverCom from 'rc-resize-observer';
import getScrollBarSize from 'rc-util/lib/getScrollBarSize';
import ColumnGroup from './sugar/ColumnGroup';
import Column from './sugar/Column';
import FixedHeader from './Header/FixedHeader';
import Header from './Header/Header';
import {
  GetRowKey,
  ColumnsType,
  TableComponents,
  Key,
  DefaultRecordType,
  TriggerEventHandler,
  GetComponentProps,
  ExpandableConfig,
  LegacyExpandableProps,
  GetComponent,
  PanelRender,
  TableLayout,
  ExpandableType,
  RowClassName,
  CustomizeComponent,
  ColumnType,
  CustomizeScrollBody,
  TableSticky,
  ScrollPosition,
} from './interface';
import TableContext from './context/TableContext';
import BodyContext from './context/BodyContext';
import Body from './Body';
import { Tr, Td, TrComProps } from './Body/Summary';
import useColumns from './hooks/useColumns';
import { useFrameState, useTimeoutLock } from './hooks/useFrame';
import { getPathValue, mergeObject, validateValue, getColumnsKey } from './utils/valueUtil';
import { getScrollParent } from './utils/domUtil';
import ResizeContext from './context/ResizeContext';
// import useStickyOffsets from './hooks/useStickyOffsets';
import ColGroup from './ColGroup';
import { getExpandableProps, getDataAndAriaProps } from './utils/legacyUtil';
import debounce from './utils/debounce';
import Panel from './Panel';
import Footer, { FooterComponents } from './Footer';
import { findAllChildrenKeys, renderExpandIcon } from './utils/expandUtil';
// import { getCellFixedInfo } from './utils/fixUtil';
import StickyScrollBar from './stickyScrollBar';
import useSticky from './hooks/useSticky';
import { useChromeVersion } from './hooks/useAgent';

// Used for conditions cache
const EMPTY_DATA = [];

// Used for customize scroll
const EMPTY_SCROLL_TARGET = {};

export const INTERNAL_HOOKS = 'rc-table-internal-hook';

interface MemoTableContentProps {
  children: React.ReactNode;
  pingLeft: boolean;
  pingRight: boolean;
  scrollBarSize: number;
  props: any;
  // 修复固定列底部超出滚动条的bug. 
  hasData: boolean;
  isHorizonScroll: boolean;
}

const doNothing = () => null;

const MemoTableContent = React.memo<MemoTableContentProps>(
  ({ children }) => children as React.ReactElement,
  // 返回 false 的话刷新， true 则不刷新
  (prev, next) => {
    if (!shallowEqual(prev.props, next.props)) {
      return false;
    }

    if (prev.isHorizonScroll !== next.isHorizonScroll || prev.hasData !== next.hasData) {
      return false;
    }

    if (prev.scrollBarSize !== next.scrollBarSize) {
      return false;
    }


    // No additional render when pinged status change.
    // This is not a bug.
    return prev.pingLeft !== next.pingLeft || prev.pingRight !== next.pingRight;
  },
);

export interface TableProps<RecordType = unknown> extends LegacyExpandableProps<RecordType> {
  prefixCls?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  data?: RecordType[];
  columns?: ColumnsType<RecordType>;
  rowKey?: string | GetRowKey<RecordType>;
  tableLayout?: TableLayout;

  // Fixed Columns
  scroll?: { x?: number | true | string; y?: number | string };

  // Expandable
  /** Config expand rows */
  expandable?: ExpandableConfig<RecordType>;
  indentSize?: number;
  rowClassName?: string | RowClassName<RecordType>;

  // Additional Part
  title?: PanelRender<RecordType>;
  footer?: PanelRender<RecordType>;
  summary?: (data: RecordType[], Tr: React.FC<TrComProps<RecordType>>, Td: React.FC<any>) => React.ReactNode;

  // Customize
  id?: string;
  showHeader?: boolean;
  components?: TableComponents<RecordType>;
  onRow?: GetComponentProps<RecordType>;
  onHeaderRow?: GetComponentProps<ColumnType<RecordType>[]>;
  emptyText?: React.ReactNode | (() => React.ReactNode);

  direction?: 'ltr' | 'rtl';

  // =================================== Internal ===================================
  /**
   * @private Internal usage, may remove by refactor. Should always use `columns` instead.
   *
   * !!! DO NOT USE IN PRODUCTION ENVIRONMENT !!!
   */
  internalHooks?: string;

  /**
   * @private Internal usage, may remove by refactor. Should always use `columns` instead.
   *
   * !!! DO NOT USE IN PRODUCTION ENVIRONMENT !!!
   */
  // Used for antd table transform column with additional column
  transformColumns?: (columns: ColumnsType<RecordType>) => ColumnsType<RecordType>;

  /**
   * @private Internal usage, may remove by refactor.
   *
   * !!! DO NOT USE IN PRODUCTION ENVIRONMENT !!!
   */
  internalRefs?: {
    body: React.MutableRefObject<HTMLDivElement>;
  };

  sticky?: boolean | TableSticky;
}

function Table<RecordType extends DefaultRecordType>(props: TableProps<RecordType>) {
  const {
    prefixCls,
    className,
    rowClassName,
    style,
    data,
    rowKey,
    scroll,
    tableLayout,
    direction,

    // Additional Part
    title,
    footer,
    summary,

    // Customize
    id,
    showHeader,
    components,
    emptyText,
    onRow,
    onHeaderRow,

    // Internal
    internalHooks,
    transformColumns,
    internalRefs,

    sticky,
  } = props;

  const mergedData = data || EMPTY_DATA;
  const hasData = !!mergedData.length;

  // ===================== Effects ======================
  const [scrollbarSize, setScrollbarSize] = React.useState(0);

  // const scrollPosition: ScrollPosition = 'both';


  React.useEffect(() => {
    setScrollbarSize(getScrollBarSize());
  });

  // ===================== Warning ======================
  if (process.env.NODE_ENV !== 'production') {
    [
      'onRowClick',
      'onRowDoubleClick',
      'onRowContextMenu',
      'onRowMouseEnter',
      'onRowMouseLeave',
    ].forEach(name => {
      warning(props[name] === undefined, `\`${name}\` is removed, please use \`onRow\` instead.`);
    });

    warning(
      !('getBodyWrapper' in props),
      '`getBodyWrapper` is deprecated, please use custom `components` instead.',
    );
  }

  // ==================== Customize =====================
  const mergedComponents = React.useMemo(
    () => mergeObject<TableComponents<RecordType>>(components, {}),
    [components],
  );

  let lastScrollTop: number = 0;
  let lastScrollLeft: number = 0;

  // ==================== Store ==========================
  const store = React.useMemo(() => create({
    currentHoverKey: null,
    fixedColumnsHeadRowsHeight: {},
    fixedColumnsBodyRowsHeight: {},
    expandedRowKeys: [],
    expandedRowsHeight: {},
  }), []);

  const syncFixedTableRowHeight = React.useCallback(() => {
    if (!fixColumn) {
      return;
    }
    const bodyTable = scrollBodyRef.current;
    const headTable = scrollHeaderRef.current;
    if (!bodyTable) return;
    const headRows = headTable
      ? headTable.querySelectorAll('thead')
      : bodyTable.querySelectorAll('thead');
    const bodyRows = bodyTable.querySelectorAll(`.${prefixCls}-row`) || [];
    const state = store.getState();
    const fixedColumnsHeadRowsHeight = [].map.call(
      headRows,
      (row: HTMLElement) => row.getBoundingClientRect().height || 'auto',
    );
    const fixedColumnsBodyRowsHeight = [].reduce.call(
      bodyRows,
      (acc: Record<string, number | 'auto'>, row: HTMLElement) => {
        const rowkey = row.getAttribute('data-row-key');
        const height =
          row.getBoundingClientRect().height || state.fixedColumnsBodyRowsHeight[rowkey] || 'auto';
        acc[rowkey] = height;
        return acc;
      },
      {},
    );
    if (
      shallowEqual(state.fixedColumnsHeadRowsHeight, fixedColumnsHeadRowsHeight) &&
      shallowEqual(state.fixedColumnsBodyRowsHeight, fixedColumnsBodyRowsHeight)
    ) {
      return;
    }

    // console.log(fixedColumnsHeadRowsHeight);
    // console.log(fixedColumnsBodyRowsHeight);
    store.setState({
      fixedColumnsHeadRowsHeight,
      fixedColumnsBodyRowsHeight,
    });
  }, []);

  // const setScrollPosition = React.useCallback((position: ScrollPosition) => {
  //   scrollPosition = position;
  //   const tableNode = fullTableRef.current;
  //   if (tableNode) {
  //     if (position === 'both') {
  //       classes(tableNode)
  //         .remove(new RegExp(`^${prefixCls}-scroll-position-.+$`))
  //         .add(`${prefixCls}-scroll-position-left`)
  //         .add(`${prefixCls}-scroll-position-right`);
  //     } else {
  //       classes(tableNode)
  //         .remove(new RegExp(`^${prefixCls}-scroll-position-.+$`))
  //         .add(`${prefixCls}-scroll-position-${position}`);
  //     }
  //   }
  // }, [])

  const handleWindowResize = React.useCallback(() => {
    syncFixedTableRowHeight();
    // console.log(scrollBodyRef.current.scrollWidth);
  }, [])

  const debouncedWindowResize = React.useMemo(() => {
    return debounce(handleWindowResize, 150);
  }, [handleWindowResize])

  React.useEffect(() => {
    debouncedWindowResize();
  })


  const getComponent = React.useCallback<GetComponent>(
    (path, defaultComponent) =>
      getPathValue<CustomizeComponent, TableComponents<RecordType>>(mergedComponents, path) ||
      defaultComponent,
    [mergedComponents],
  );

  const getRowKey = React.useMemo<GetRowKey<RecordType>>(() => {
    if (typeof rowKey === 'function') {
      return rowKey;
    }
    return (record: RecordType) => {
      const key = record && record[rowKey];

      if (process.env.NODE_ENV !== 'production') {
        warning(
          key !== undefined,
          'Each record in table should have a unique `key` prop, or set `rowKey` to an unique primary key.',
        );
      }

      return key;
    };
  }, [rowKey]);

  // ====================== Expand ======================
  const expandableConfig = getExpandableProps(props);

  const {
    expandIcon,
    expandedRowKeys,
    defaultExpandedRowKeys,
    defaultExpandAllRows,
    expandedRowRender,
    onExpand,
    onExpandedRowsChange,
    expandRowByClick,
    rowExpandable,
    expandIconColumnIndex,
    expandedRowClassName,
    childrenColumnName,
    indentSize,
  } = expandableConfig;

  const mergedExpandIcon = expandIcon || renderExpandIcon;
  const mergedChildrenColumnName = childrenColumnName || 'children';
  const expandableType = React.useMemo<ExpandableType>(() => {
    if (expandedRowRender) {
      return 'row';
    }
    /* eslint-disable no-underscore-dangle */
    /**
     * Fix https://github.com/ant-design/ant-design/issues/21154
     * This is a workaround to not to break current behavior.
     * We can remove follow code after final release.
     *
     * To other developer:
     *  Do not use `__PARENT_RENDER_ICON__` in prod since we will remove this when refactor
     */
    if (
      (props.expandable &&
        internalHooks === INTERNAL_HOOKS &&
        (props.expandable as any).__PARENT_RENDER_ICON__) ||
      mergedData.some(
        record => record && typeof record === 'object' && record[mergedChildrenColumnName],
      )
    ) {
      return 'nest';
    }
    /* eslint-enable */
    return false;
  }, [!!expandedRowRender, mergedData]);

  const [innerExpandedKeys, setInnerExpandedKeys] = React.useState<Key[]>(() => {
    if (defaultExpandedRowKeys) {
      return defaultExpandedRowKeys;
    }
    if (defaultExpandAllRows) {
      return findAllChildrenKeys<RecordType>(mergedData, getRowKey, mergedChildrenColumnName);
    }
    return [];
  });
  const mergedExpandedKeys = React.useMemo(
    () => new Set(expandedRowKeys || innerExpandedKeys || []),
    [expandedRowKeys, innerExpandedKeys],
  );

  const onTriggerExpand: TriggerEventHandler<RecordType> = React.useCallback(
    (record: RecordType) => {
      const key = getRowKey(record, mergedData.indexOf(record));

      let newExpandedKeys: Key[];
      const hasKey = mergedExpandedKeys.has(key);
      if (hasKey) {
        mergedExpandedKeys.delete(key);
        newExpandedKeys = [...mergedExpandedKeys];
      } else {
        newExpandedKeys = [...mergedExpandedKeys, key];
      }

      setInnerExpandedKeys(newExpandedKeys);
      if (onExpand) {
        onExpand(!hasKey, record);
      }
      if (onExpandedRowsChange) {
        onExpandedRowsChange(newExpandedKeys);
      }
    },
    [getRowKey, mergedExpandedKeys, mergedData, onExpand, onExpandedRowsChange],
  );

  // ====================== Column ======================
  const [componentWidth, setComponentWidth] = React.useState(0);

  const [columns, flattenColumns] = useColumns(
    {
      ...props,
      ...expandableConfig,
      expandable: !!expandedRowRender,
      expandedKeys: mergedExpandedKeys,
      getRowKey,
      // https://github.com/ant-design/ant-design/issues/23894
      onTriggerExpand,
      expandIcon: mergedExpandIcon,
      expandIconColumnIndex,
      direction,
    },
    internalHooks === INTERNAL_HOOKS ? transformColumns : null,
  );

  // console.log(columns, flattenColumns);

  const columnContext = React.useMemo(
    () => ({
      columns,
      flattenColumns,
    }),
    [columns, flattenColumns],
  );

  // ====================== Scroll ======================
  const fullTableRef = React.useRef<HTMLDivElement>();
  const tableContainerRef = React.useRef<HTMLDivElement>();
  const scrollHeaderRef = React.useRef<HTMLDivElement>();
  const scrollBodyRef = React.useRef<HTMLDivElement>();
  const leftTableRef = React.useRef<HTMLDivElement>();
  const rightTableRef = React.useRef<HTMLDivElement>();
  const fixedColumnsBodyLeft = React.useRef<HTMLDivElement>();
  const fixedColumnsBodyRight = React.useRef<HTMLDivElement>();
  const footRef = React.useRef();

  const [pingedLeft, setPingedLeft] = React.useState(false);
  const [pingedRight, setPingedRight] = React.useState(false);
  // 当前是否有水平滚动条
  const [isHorizonScroll, setIsHorizonScroll] = React.useState(true);
  // const [scrollTop, setScrollTop] = React.useState(0);
  const [colsWidths, updateColsWidths] = useFrameState(new Map<React.Key, number>());

  // Convert map to number width
  const colsKeys = getColumnsKey(flattenColumns);
  const pureColWidths = colsKeys.map(columnKey => colsWidths.get(columnKey));
  const colWidths = React.useMemo(() => pureColWidths, [pureColWidths.join('_')]);
  // const stickyOffsets = useStickyOffsets(colWidths, flattenColumns.length, direction);
  const fixHeader = scroll && validateValue(scroll.y);
  const horizonScroll = scroll && validateValue(scroll.x);
  const fixColumn = horizonScroll && flattenColumns.some(({ fixed }) => fixed);
  const fixLeftColumns: ColumnType<RecordType>[] = columns.filter(({ fixed }) => fixed === 'left');
  const fixRightColumns: ColumnType<RecordType>[] = columns.filter(({ fixed }) => fixed === 'right');
  const fixLeftFlattenColumns = flattenColumns.filter(({ fixed }) => fixed === 'left');
  const fixRightFlattenColumns = flattenColumns.filter(({ fixed }) => fixed === 'right');
  const ChromeVersion = useChromeVersion();


  // const colsLeftKeys = getColumnsKey(fixLeftColumns);
  // const pureColLeftWidths = colsLeftKeys.map(columnKey => colsWidths.get(columnKey));
  // const colLeftWidths = React.useMemo(() => pureColLeftWidths, [pureColLeftWidths.join('_')]);

  // Sticky
  const stickyRef = React.useRef<{ setScrollLeft: (left: number) => void }>();
  const { isSticky, offsetHeader, offsetScroll, stickyClassName } = useSticky(sticky, prefixCls);

  let scrollXStyle: React.CSSProperties;
  let scrollYStyle: React.CSSProperties;
  let scrollTableStyle: React.CSSProperties;

  if (fixHeader) {
    scrollYStyle = {
      overflowY: 'scroll',
      maxHeight: scroll.y,
    };
  }

  if (horizonScroll) {
    scrollXStyle = { overflowX: 'auto' };
    // When no vertical scrollbar, should hide it
    // https://github.com/ant-design/ant-design/pull/20705
    // https://github.com/ant-design/ant-design/issues/21879
    if (!fixHeader) {
      scrollYStyle = { overflowY: 'hidden' };
    }
    scrollTableStyle = {
      width: (!scroll || scroll?.x === true) ? 'auto' : scroll.x,
      minWidth: '100%',
    };
    if (scrollTableStyle.width === 'max-content') {
      // https://caniuse.com/?search=max-content
      // polyfill for max-content at chrome before version 45.
      if (ChromeVersion < 45) {
        scrollTableStyle.width = '-webkit-max-content';
      }
    }
  }

  const onColumnResize = React.useCallback((columnKey: React.Key, width: number) => {
    updateColsWidths(widths => {
      const newWidths = new Map(widths);
      newWidths.set(columnKey, width);
      return newWidths;
    });
  }, []);

  const [setScrollTarget, getScrollTarget] = useTimeoutLock(null);

  function forceScroll(scrollLeft: number, target: HTMLDivElement | ((left: number) => void)) {
    if (!target) {
      return;
    }
    if (typeof target === 'function') {
      target(scrollLeft);
    } else if (target.scrollLeft !== scrollLeft) {
      // eslint-disable-next-line no-param-reassign
      target.scrollLeft = scrollLeft;
    }
  }

  const handleBodyScrollTop = target => {
    // Fix https://github.com/ant-design/ant-design/issues/9033
    // const { headTable, bodyTable, fixedColumnsBodyLeft, fixedColumnsBodyRight } = this;
    if (!target) return;
    if (target.scrollTop !== lastScrollTop && scroll.y && target !== scrollHeaderRef.current) {
      const { scrollTop: scrollTopTarget } = target;
      if (fixedColumnsBodyLeft.current && target !== fixedColumnsBodyLeft.current) {
        fixedColumnsBodyLeft.current.scrollTop = scrollTopTarget;
      }
      if (fixedColumnsBodyRight.current && target !== fixedColumnsBodyRight.current) {
        fixedColumnsBodyRight.current.scrollTop = scrollTopTarget;
      }
      if (scrollBodyRef.current && target !== scrollBodyRef.current) {
        scrollBodyRef.current.scrollTop = scrollTopTarget;
      }
    }
    // Remember last scrollTop for scroll direction detecting.
    lastScrollTop = target.scrollTop;
  };

  const onScrollTop = e => {
    // console.log(111);

    // handleBodyScrollTop(e.target);
    if (!getScrollTarget() || getScrollTarget() === e.target) {
      setScrollTarget(e.target);
      handleBodyScrollTop(e.target);
    }
    // console.log(!getScrollTarget() || getScrollTarget() === e.target);
  }

  const onScroll = ({
    currentTarget,
    scrollLeft,
  }: {
    currentTarget: HTMLElement;
    scrollLeft?: number;
  }, ignoreCheck?: boolean) => {
    const mergedScrollLeft = typeof scrollLeft === 'number' ? scrollLeft : currentTarget.scrollLeft;
    const compareTarget = currentTarget || EMPTY_SCROLL_TARGET;
    if (ignoreCheck || !getScrollTarget() || getScrollTarget() === compareTarget) {
      setScrollTarget(compareTarget);
      handleBodyScrollTop(currentTarget);

      if ((lastScrollLeft === 0 || mergedScrollLeft !== lastScrollLeft) && scroll?.x) {
        setScrollTarget(compareTarget);

        forceScroll(mergedScrollLeft, scrollHeaderRef.current);
        forceScroll(mergedScrollLeft, scrollBodyRef.current);
        forceScroll(mergedScrollLeft, stickyRef.current?.setScrollLeft);

        lastScrollLeft = mergedScrollLeft;

        if (currentTarget) {
          const { scrollWidth, clientWidth } = currentTarget;
          setPingedLeft(mergedScrollLeft > 0);
          setPingedRight(mergedScrollLeft < scrollWidth - clientWidth);
        }
      }
    }
  }

  const triggerOnScroll = () => {
    if (scrollBodyRef.current) {
      onScroll({ currentTarget: scrollBodyRef.current } as React.UIEvent<HTMLDivElement>);
    }
  };

  const isBodyScroll = () => {
    if (scrollBodyRef.current?.getBoundingClientRect) {
      const { width } = scrollBodyRef.current?.getBoundingClientRect();
      const { scrollWidth } = scrollBodyRef.current;
      setIsHorizonScroll(scrollWidth > width);
    }
  }

  const onFullTableResize = ({ width }) => {
    triggerOnScroll();
    // setComponentWidth(fullTableRef.current ? fullTableRef.current.offsetWidth : width);
    setComponentWidth(scroll?.x ? Number(scroll.x) : width);
    syncFixedTableRowHeight();
    isBodyScroll();
  };

  // Sync scroll bar when init or `horizonScroll` changed
  React.useEffect(() => triggerOnScroll, []);
  React.useEffect(() => {
    if (horizonScroll) {
      triggerOnScroll();
    }
  }, [horizonScroll]);

  // eslint-disable-next-line consistent-return
  // React.useEffect(() => {
  //   if (fixColumn) {
  //     handleWindowResize();
  //     const resizeEvent = addEventListener(window, 'resize', debouncedWindowResize);
  //     return () => {
  //       resizeEvent.remove();
  //     }
  //   }
  // }, [])


  // ================== INTERNAL HOOKS ==================
  React.useEffect(() => {
    if (internalHooks === INTERNAL_HOOKS && internalRefs) {
      internalRefs.body.current = scrollBodyRef.current;
    }
  });


  const thead: HTMLElement | undefined = React.useMemo(() => {
    return scrollBodyRef.current?.querySelector?.(`.${prefixCls}-thead`);
  }, [scrollBodyRef?.current, fixHeader]);

  const summaryEles: NodeListOf<Element> | undefined = React.useMemo(() => {
    return fullTableRef?.current && fullTableRef.current.querySelectorAll(`.${prefixCls}-summary`) as unknown as NodeListOf<HTMLElement>;

  }, [fullTableRef?.current]);

  const [leftThead, setLeftThead] = React.useState<HTMLElement>(null);
  const [rightThead, setRightThead] = React.useState<HTMLElement>(null);
  let stickyHeader: HTMLElement | undefined;
  // let stickyHeaderHeight = 0;
  // let summaryEles: NodeListOf<HTMLElement>;
  const [firstScrollParent, setFirstScrollParent] = React.useState(null);
  const [firstoffsetParentTop, setFirstOffsetParentTop] = React.useState(0);
  const [footOffsetParentTop, setFootOffsetParentTop] = React.useState(0);

  React.useEffect(() => {
    setLeftThead(leftTableRef?.current && leftTableRef.current.querySelector(`.${prefixCls}-thead`) as HTMLElement);
    setRightThead(rightTableRef?.current && rightTableRef.current.querySelector(`.${prefixCls}-thead`) as HTMLElement);
    stickyHeader = fullTableRef?.current && fullTableRef.current.querySelector(`.${prefixCls}-sticky-header`);
    // stickyHeaderHeight = stickyHeader ? stickyHeader.getBoundingClientRect().height : 0;
    // console.log(summaryEle);
  })

  const stickySummary = React.useCallback(() => {
    if (footRef.current && firstScrollParent) {

      let { scrollTop } = firstScrollParent;
      if (firstScrollParent === document.body) {
        scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
      }
      let summaryTop = scrollTop - footOffsetParentTop;
      if (summaryTop > 0) summaryTop = 0;
      requestAnimationFrame(() => {
        [].forEach.call(summaryEles, summaryEle => {
          if (summaryEle.style) {
            // eslint-disable-next-line no-param-reassign
            summaryEle.style.transform = `translateY(${summaryTop}px)`
          }
        })
      })
    }
  }, [footRef.current, firstScrollParent, summaryEles, footOffsetParentTop]);



  React.useEffect(() => {
    if (!isSticky) return;
    let clear: Function = () => null;
    if (tableContainerRef.current && firstScrollParent) {
      setTimeout(() => {
        const offsetParentTop = firstoffsetParentTop;
        stickySummary();
        const { remove } = addEventListener(firstScrollParent === document.body ? document : firstScrollParent, 'scroll', () => {
          let { scrollTop } = firstScrollParent;
          if (firstScrollParent === document.body) {
            scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
          }
          const top = scrollTop - offsetParentTop - 1;
          let lock = false;
          let lastIs0 = false;
          if (top > 0) {
            const translate = top;
            if (!lock) {
              requestAnimationFrame(() => {
                lock = true;
                lastIs0 = false;
                if (thead) thead.style.transform = `translateY(${Math.round(translate)}px)`;
                if (leftThead) leftThead.style.transform = `translateY(${Math.round(translate)}px)`;
                if (rightThead) rightThead.style.transform = `translateY(${Math.round(translate)}px)`;
                if (stickyHeader) {
                  stickyHeader.style.transform = `translateY(${Math.round(translate)}px`;
                }
                lock = false;
              })
            }
          } else if (!lastIs0) {
            if (thead) thead.style.transform = `translateY(0px)`;
            if (leftThead) leftThead.style.transform = `translateY(0px)`;
            if (rightThead) rightThead.style.transform = `translateY(0px)`;
            if (stickyHeader) stickyHeader.style.transform = `translateY(0px)`;
            lastIs0 = true;
          }
          stickySummary();
        });
        clear = () => {
          remove();
        };
      }, 500)
    }

    // eslint-disable-next-line consistent-return
    return () => {
      clear();
    };
  }, [tableContainerRef.current, isSticky, summary, isHorizonScroll, firstScrollParent, firstoffsetParentTop, stickySummary])

  // 监听所有父元素的resize. 变化后。重新寻找第一个滚动的父元素
  React.useEffect(() => {
    // eslint-disable-next-line 
    if (tableContainerRef.current) {
      const myObserver = new ResizeObserver(debounce(() => {
        const first = getScrollParent(tableContainerRef.current);
        if (first && tableContainerRef.current) {
          const { top: ctop = 0, height } = tableContainerRef.current.getBoundingClientRect();
          if (height === 0) return;
          const { top: ptop } = first.getBoundingClientRect();
          const offsetParentTop = ctop - ptop + first.scrollTop;
          setFirstOffsetParentTop(offsetParentTop);
          setFirstScrollParent(first);
        }


        if (footRef && footRef.current) {
          // @ts-ignore
          footRef.current.style.transform = 'translateY(0px)';
          setTimeout(() => {
            // @ts-ignore
            const { top: ftop = 0, height: footHeight } = footRef!.current!.getBoundingClientRect();
            const { top: ptop, height } = first.getBoundingClientRect();
            setFootOffsetParentTop(ftop - ptop - height + footHeight);
          }, 100)
        }

      }, 500))
      let p = tableContainerRef.current.parentElement;
      while (p) {
        myObserver.observe(p);
        p = p.parentElement;
      }
    }
  }, [tableContainerRef.current, footRef.current])


  // ====================== Render ======================
  const TableComponent = getComponent(['table'], 'table');

  // Table layout
  const mergedTableLayout = React.useMemo<TableLayout>(() => {
    if (tableLayout) {
      return tableLayout;
    }
    // https://github.com/ant-design/ant-design/issues/25227
    // When scroll.x is max-content, no need to fix table layout
    // it's width should stretch out to fit content
    if (fixColumn) {
      return scroll?.x === 'max-content' ? 'auto' : 'fixed';
    }
    if (fixHeader || flattenColumns.some(({ ellipsis }) => ellipsis)) {
      return 'fixed';
    }
    return 'auto';
  }, [fixHeader, fixColumn, flattenColumns, tableLayout]);

  let groupTableNode: React.ReactNode;

  // Header props
  const headerProps = {
    colWidths,
    columCount: flattenColumns.length,
    // stickyOffsets,
    onHeaderRow,
    fixHeader,
  };

  // Empty
  const emptyNode: React.ReactNode = React.useMemo(() => {
    // const { fixed } = React.useContext(BodyContext);
    // if (fixed) return null;
    if (hasData) {
      return null;
    }

    if (typeof emptyText === 'function') {
      return emptyText();
    }
    return emptyText;
  }, [hasData, emptyText]);

  // Body
  const bodyTable = (
    <Body
      data={mergedData}
      measureColumnWidth={fixHeader || horizonScroll || isSticky}
      expandedKeys={mergedExpandedKeys}
      rowExpandable={rowExpandable}
      getRowKey={getRowKey}
      onRow={onRow}
      emptyNode={emptyNode}
      childrenColumnName={mergedChildrenColumnName}
      store={store}
    />
  );

  const bodyColGroup = (
    <ColGroup colWidths={flattenColumns.map(({ width }) => width)} columns={flattenColumns} />
  );

  const footerTable = summary && <Footer ref={footRef}>{summary(mergedData, Tr, Td)}</Footer>;
  const customizeScrollBody = getComponent(['body']) as CustomizeScrollBody<RecordType>;

  if (
    process.env.NODE_ENV !== 'production' &&
    typeof customizeScrollBody === 'function' &&
    hasData &&
    !fixHeader
  ) {
    warning(false, '`components.body` with render props is only work on `scroll.y`.');
  }

  // const getGroupTable

  if (fixHeader) {
    let bodyContent: React.ReactNode;

    if (typeof customizeScrollBody === 'function') {
      bodyContent = customizeScrollBody(mergedData, {
        scrollbarSize,
        ref: scrollBodyRef,
        onScroll: (props: {
          scrollTop: number;
          scrollLeft: number;
        }) => {
          onScroll({
            currentTarget: props as HTMLDivElement,
            scrollLeft: props.scrollLeft,
          }, true);
        },
      });
      headerProps.colWidths = flattenColumns.map(({ width }, index) => {
        const colWidth = index === columns.length - 1 ? (width as number) - scrollbarSize : width;
        if (typeof colWidth === 'number' && !Number.isNaN(colWidth)) {
          return colWidth;
        }
        warning(
          false,
          'When use `components.body` with render props. Each column should have a fixed value.',
        );

        return 0;
      }) as number[];
    } else {
      bodyContent = (
        <div
          style={{
            ...scrollXStyle,
            ...scrollYStyle,
          }}
          onScroll={onScroll}
          ref={scrollBodyRef}
          className={classNames(`${prefixCls}-body`)}
        >
          <TableComponent
            style={{
              ...scrollTableStyle,
              tableLayout: mergedTableLayout,
            }}
          >
            {bodyColGroup}
            {showHeader !== false && <Header {...headerProps} hidden {...columnContext} />}
            {bodyTable}
            {summary && <Footer ref={footRef}>{summary(mergedData, Tr, Td)}</Footer>}
          </TableComponent>
        </div>
      );
    }
    // console.log(showHeader);
    groupTableNode = (
      <>
        {/* Header Table */}
        {showHeader !== false && (
          <FixedHeader
            noData={!mergedData.length}
            {...headerProps}
            {...columnContext}
            direction={direction}
            // Fixed Props
            offsetHeader={offsetHeader}
            stickyClassName={stickyClassName}
            ref={scrollHeaderRef}
            onScroll={onScroll}
          />
        )}
        {/* Body Table */}
        {bodyContent}
      </>
    );
  } else {
    groupTableNode = (
      <div
        style={{
          ...scrollXStyle,
          ...scrollYStyle,
        }}
        className={classNames(`${prefixCls}-content`)}
        onScroll={onScroll}
        ref={scrollBodyRef}
      >
        <TableComponent style={{ ...scrollTableStyle, tableLayout: mergedTableLayout }}>
          {bodyColGroup}
          {showHeader !== false && <Header {...headerProps} {...columnContext} />}
          {bodyTable}
          {/* {footerTable} */}
          {summary && <Footer ref={footRef}>{summary(mergedData, Tr, Td)}</Footer>}
        </TableComponent>
      </div>
    );
  }


  const ariaProps = getDataAndAriaProps(props);

  const renderMainTable = () => {
    return groupTableNode;
  }

  const BodyContextValue = React.useMemo(
    () => ({
      ...columnContext,
      tableLayout: mergedTableLayout,
      rowClassName,
      expandedRowClassName,
      componentWidth,
      fixHeader,
      fixColumn,
      horizonScroll,
      expandIcon: mergedExpandIcon,
      expandableType,
      expandRowByClick,
      expandedRowRender,
      onTriggerExpand,
      expandIconColumnIndex,
      indentSize,
    }),
    [
      columnContext,
      mergedTableLayout,
      rowClassName,
      expandedRowClassName,
      componentWidth,
      fixHeader,
      fixColumn,
      horizonScroll,
      mergedExpandIcon,
      expandableType,
      expandRowByClick,
      expandedRowRender,
      onTriggerExpand,
      expandIconColumnIndex,
      indentSize,
    ],
  );

  const BodyContextValueOnlyFixedLeftColumns = {
    ...BodyContextValue, ...{
      columns: fixLeftColumns,
      flattenColumns: fixLeftFlattenColumns,
      componentWidth: fixLeftFlattenColumns.map(c => Number(c.width) || 0).reduce((a, b) => a + b, 0) + (expandedRowRender ? 60 : 0),
      fixed: 'left',
    }
  };

  const BodyContextValueOnlyFixedRightColumns = {
    ...BodyContextValue, ...{
      columns: fixRightColumns,
      flattenColumns: fixRightFlattenColumns,
      componentWidth: fixRightFlattenColumns.map(c => Number(c.width) || 0).reduce((a, b) => a + b, 0),
      fixed: 'right',
    }
  };


  const renderLeftFixedTable = () => {
    // console.log(scrollbarSize)
    // console.log(BodyContextValueOnlyFixedLeftColumns);
    // console.log(scrollTableStyle);
    let groupTableNodeLeft: React.ReactNode;
    const bodyColGroupLeft = (
      <ColGroup colWidths={BodyContextValueOnlyFixedLeftColumns.flattenColumns.map(({ width }) => width)} columns={BodyContextValueOnlyFixedLeftColumns.flattenColumns} />
    );
    let bodyContent: React.ReactNode;

    if (fixHeader) {
      if (typeof customizeScrollBody === 'function') {
        bodyContent = customizeScrollBody(mergedData, {
          scrollbarSize,
          ref: fixedColumnsBodyLeft,
          onScroll: (props: {
            scrollTop: number;
          }) => {
            handleBodyScrollTop(props);
          },
          fixed: 'left',
        });
      } else {
        bodyContent = (
          <div
            style={{
              ...scrollYStyle,
              overflowX: 'hidden',
              marginRight: -scrollbarSize,
            }}
            onScroll={onScrollTop}
            ref={fixedColumnsBodyLeft}
            className={classNames(`${prefixCls}-body-inner`)}
          >
            <TableComponent
              style={{
                ...scrollTableStyle,
                tableLayout: mergedTableLayout,
                width: BodyContextValueOnlyFixedLeftColumns.componentWidth,
                minWidth: BodyContextValueOnlyFixedLeftColumns.componentWidth,
              }}
            >
              {bodyColGroupLeft}
              {bodyTable}
              {footerTable}
            </TableComponent>
            { hasData && isHorizonScroll && <div className="place-holder" style={{ height: scrollbarSize }}></div>}
          </div>
        );
      }


      groupTableNodeLeft = (
        <div
          style={{
            ...scrollXStyle,
            ...scrollYStyle,
          }}
          className={classNames(`${prefixCls}-content`)}
          ref={leftTableRef}
        >
          <div className={classNames(`${prefixCls}-fixed-left`)}>
            {/* Header Table */}
            {showHeader !== false && (
              <FixedHeader
                noData={!mergedData.length}
                // {...headerProps}
                // {...columnContext}
                colWidths={fixLeftFlattenColumns.map(c => Number(c.width))}
                fixHeader
                fixed="left"
                onHeaderRow={onHeaderRow}
                columCount={fixLeftFlattenColumns.length}
                columns={fixLeftColumns}
                flattenColumns={fixLeftFlattenColumns}
                direction={direction}
                // Fixed Props
                offsetHeader={offsetHeader}
                stickyClassName={stickyClassName}
                // ref={scrollHeaderRef}
                onScroll={doNothing}
              />
            )}

            {/* Body Table */}
            <div
              className={classNames(`${prefixCls}-body-outer`)}
              style={{
                marginBottom: (hasData && isHorizonScroll) ? -scrollbarSize : 0,
                paddingBottom: 0,
              }}
            >
              {bodyContent}
            </div>

          </div>
        </div>
      );
    } else {
      groupTableNodeLeft = (<div
        style={{
          ...scrollXStyle,
          ...scrollYStyle,
        }}
        className={classNames(`${prefixCls}-content`)}
        onScroll={onScroll}
        ref={leftTableRef}
      >
        <div className={classNames(`${prefixCls}-fixed-left`)}>
          <TableComponent style={{ tableLayout: mergedTableLayout, width: BodyContextValueOnlyFixedLeftColumns.componentWidth }}>
            {bodyColGroupLeft}
            {showHeader !== false && <Header fixed="left" {...headerProps} columns={fixLeftColumns} flattenColumns={fixLeftFlattenColumns} />}
            {bodyTable}
            {footerTable}
          </TableComponent>
        </div>
      </div>)
    }

    return <BodyContext.Provider value={BodyContextValueOnlyFixedLeftColumns}>
      {groupTableNodeLeft}
    </BodyContext.Provider >
  }

  const renderRightFixedTable = () => {
    let groupTableNodeRight: React.ReactNode;
    let bodyContent: React.ReactNode;
    const bodyColGroupRight = (
      <ColGroup colWidths={BodyContextValueOnlyFixedRightColumns.flattenColumns.map(({ width }) => width)} columns={BodyContextValueOnlyFixedRightColumns.flattenColumns} />
    );

    if (fixHeader) {
      if (typeof customizeScrollBody === 'function') {
        bodyContent = customizeScrollBody(mergedData, {
          scrollbarSize,
          ref: fixedColumnsBodyRight,
          onScroll: (props: {
            scrollTop: number;
          }) => {
            handleBodyScrollTop(props);
          },
          fixed: 'right',
        })
      } else {
        bodyContent = (
          <div
            style={{
              ...scrollXStyle,
              ...scrollYStyle,
              ...{
                marginBottom: (hasData && isHorizonScroll) ? -scrollbarSize : 0,
              },
              overflowX: 'hidden',
            }}
            onScroll={onScrollTop}
            ref={fixedColumnsBodyRight}
            className={classNames(`${prefixCls}-body-inner`)}
          >
            <TableComponent
              style={{
                ...scrollTableStyle,
                tableLayout: mergedTableLayout,
                width: BodyContextValueOnlyFixedRightColumns.componentWidth,
                minWidth: BodyContextValueOnlyFixedRightColumns.componentWidth,
              }}
            >
              {bodyColGroupRight}
              {bodyTable}
              {footerTable}
            </TableComponent>
            {
              hasData && isHorizonScroll && <div className="place-holder" style={{ height: scrollbarSize }}></div>
            }
          </div>
        );
      }


      groupTableNodeRight = (
        <div
          style={{
            ...scrollXStyle,
            ...scrollYStyle,
          }}
          className={classNames(`${prefixCls}-content`)}
          ref={rightTableRef}
        // onScroll={onScroll}
        >
          <div className={classNames(`${prefixCls}-fixed-right`)}>
            {/* Header Table */}
            {showHeader !== false && (
              <FixedHeader
                noData={!mergedData.length}
                // {...headerProps}
                // {...columnContext}
                colWidths={fixRightFlattenColumns.map(c => Number(c.width))}
                fixHeader
                fixed="right"
                onHeaderRow={onHeaderRow}
                columCount={fixRightFlattenColumns.length}
                columns={fixRightColumns}
                flattenColumns={fixRightFlattenColumns}
                direction={direction}
                // Fixed Props
                offsetHeader={offsetHeader}
                stickyClassName={stickyClassName}
                // ref={scrollHeaderRef}
                onScroll={onScroll}
              />
            )}

            {/* Body Table */}
            <div
              className={`${prefixCls}-body-outer`}
              style={{
                // marginBottom: -15,
                paddingBottom: 0,
              }}
            >
              {bodyContent}
            </div>

          </div>
        </div>
      );
    } else {
      groupTableNodeRight = (<div
        style={{
          ...scrollXStyle,
          ...scrollYStyle,
        }}
        className={classNames(`${prefixCls}-content`)}
        onScroll={onScroll}
        ref={rightTableRef}
      >
        <div className={classNames(`${prefixCls}-fixed-right`)}>
          <TableComponent style={{ tableLayout: mergedTableLayout, width: BodyContextValueOnlyFixedRightColumns.componentWidth }}>
            {bodyColGroupRight}
            {showHeader !== false && <Header fixed="right" {...headerProps} columns={fixRightColumns} flattenColumns={fixRightFlattenColumns} />}
            {bodyTable}
            {footerTable}
          </TableComponent>
        </div>
      </div>)
    }

    return <BodyContext.Provider value={BodyContextValueOnlyFixedRightColumns}>
      {groupTableNodeRight}
    </BodyContext.Provider >
  }

  let fullTable = (
    <div
      className={classNames(prefixCls, className, {
        [`${prefixCls}-rtl`]: direction === 'rtl',
        [`${prefixCls}-ping-left`]: pingedLeft,
        [`${prefixCls}-ping-right`]: pingedRight,
        [`${prefixCls}-layout-fixed`]: tableLayout === 'fixed',
        [`${prefixCls}-fixed-header`]: fixHeader,
        /** No used but for compatible */
        [`${prefixCls}-fixed-column`]: fixColumn,
        [`${prefixCls}-scroll-horizontal`]: horizonScroll,
        [`${prefixCls}-has-fix-left`]: flattenColumns[0] && flattenColumns[0].fixed,
        [`${prefixCls}-has-fix-right`]:
          flattenColumns[flattenColumns.length - 1] &&
          flattenColumns[flattenColumns.length - 1].fixed === 'right',
      })}
      style={style}
      id={id}
      ref={fullTableRef}
      {...ariaProps}
    >
      <Provider store={store}>
        <MemoTableContent
          pingLeft={pingedLeft}
          pingRight={pingedRight}
          scrollBarSize={scrollbarSize}
          isHorizonScroll={isHorizonScroll}
          hasData={hasData}
          props={{ ...props, mergedExpandedKeys }}
        >
          {title && <Panel className={`${prefixCls}-title`}>{title(mergedData)}</Panel>}
          <div ref={tableContainerRef} className={`${prefixCls}-container`}>
            <>
              {renderMainTable()}
              {fixLeftColumns.length > 0 && hasData && renderLeftFixedTable()}
              {fixRightColumns.length > 0 && hasData && renderRightFixedTable()}
              {
                isSticky && (
                  <StickyScrollBar
                    ref={stickyRef}
                    offsetScroll={offsetScroll}
                    scrollBodyRef={scrollBodyRef}
                    onScroll={onScroll}
                    scrollbarSize={scrollbarSize}
                  />
                )
              }
            </>
          </div>
          {footer && <Panel className={`${prefixCls}-footer`}>{footer(mergedData)}</Panel>}
        </MemoTableContent>
      </Provider>
    </div>
  );

  if (horizonScroll) {
    fullTable = <ResizeObserverCom onResize={onFullTableResize}>{fullTable}</ResizeObserverCom>;
  }

  const TableContextValue = React.useMemo(
    () => ({
      prefixCls,
      getComponent,
      scrollbarSize,
      direction,
      // fixedInfoList: flattenColumns.map((_, colIndex) =>
      //   getCellFixedInfo(colIndex, colIndex, flattenColumns, stickyOffsets, direction),
      // ),
      isSticky,
      // scrollTop,
    }),
    [
      prefixCls,
      getComponent,
      scrollbarSize,
      direction,
      flattenColumns,
      // stickyOffsets,
      direction,
      isSticky,
      // scrollTop,
    ],
  );



  const ResizeContextValue = React.useMemo(() => ({ onColumnResize }), [onColumnResize]);

  return (
    <TableContext.Provider value={TableContextValue}>
      <BodyContext.Provider value={BodyContextValue}>
        <ResizeContext.Provider value={ResizeContextValue}>{fullTable}</ResizeContext.Provider>
      </BodyContext.Provider>
    </TableContext.Provider>
  );
}

Table.Column = Column;

Table.ColumnGroup = ColumnGroup;

Table.Summary = FooterComponents;

Table.defaultProps = {
  rowKey: 'key',
  prefixCls: 'rc-table',
  emptyText: () => 'No Data',
};

export default Table;
