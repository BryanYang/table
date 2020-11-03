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
import addEventListener from 'rc-util/lib/Dom/addEventListener';
import warning from 'rc-util/lib/warning';
import { Provider, create } from 'mini-store';
import ResizeObserver from 'rc-resize-observer';
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
import useColumns from './hooks/useColumns';
import { useFrameState, useTimeoutLock } from './hooks/useFrame';
import { getPathValue, mergeObject, validateValue, getColumnsKey } from './utils/valueUtil';
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

// Used for conditions cache
const EMPTY_DATA = [];

// Used for customize scroll
const EMPTY_SCROLL_TARGET = {};

export const INTERNAL_HOOKS = 'rc-table-internal-hook';

interface MemoTableContentProps {
  children: React.ReactNode;
  pingLeft: boolean;
  pingRight: boolean;
  props: any;
}

const MemoTableContent = React.memo<MemoTableContentProps>(
  ({ children }) => children as React.ReactElement,

  (prev, next) => {
    if (!shallowEqual(prev.props, next.props)) {
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
  summary?: (data: RecordType[]) => React.ReactNode;

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

  const scrollPosition: ScrollPosition = 'both';


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


  // ==================== Store ==========================
  const store = React.useMemo(() => create({
    currentHoverKey: null,
    fixedColumnsHeadRowsHeight: [],
    fixedColumnsBodyRowsHeight: {},
  }), []);

  const syncFixedTableRowHeight = React.useCallback(() => {
    const bodyTable = scrollBodyRef.current;
    const headTable = scrollHeaderRef.current;
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
  }, [])

  const debouncedWindowResize = React.useMemo(() => {
    return debounce(handleWindowResize, 150);
  }, [handleWindowResize])


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

  const columnContext = React.useMemo(
    () => ({
      columns,
      flattenColumns,
    }),
    [columns, flattenColumns],
  );

  // ====================== Scroll ======================
  const fullTableRef = React.useRef<HTMLDivElement>();
  const scrollHeaderRef = React.useRef<HTMLDivElement>();
  const scrollBodyRef = React.useRef<HTMLDivElement>();
  const [pingedLeft, setPingedLeft] = React.useState(false);
  const [pingedRight, setPingedRight] = React.useState(false);
  const [scrollTop, setScrollTop] = React.useState(0);
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
      width: scroll.x === true ? 'auto' : scroll.x,
      minWidth: '100%',
    };
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

  const onScroll = ({
    currentTarget,
    scrollLeft,
  }: {
    currentTarget: HTMLElement;
    scrollLeft?: number;
  }) => {
    // console.log(currentTarget);
    const mergedScrollLeft = typeof scrollLeft === 'number' ? scrollLeft : currentTarget.scrollLeft;

    const compareTarget = currentTarget || EMPTY_SCROLL_TARGET;
    if (!getScrollTarget() || getScrollTarget() === compareTarget) {
      setScrollTarget(compareTarget);

      forceScroll(mergedScrollLeft, scrollHeaderRef.current);
      forceScroll(mergedScrollLeft, scrollBodyRef.current);
      forceScroll(mergedScrollLeft, stickyRef.current?.setScrollLeft);
    }

    if (currentTarget) {
      const { scrollWidth, clientWidth } = currentTarget;
      setPingedLeft(mergedScrollLeft > 0);
      setPingedRight(mergedScrollLeft < scrollWidth - clientWidth);
    }
  };

  const triggerOnScroll = () => {
    if (scrollBodyRef.current) {
      onScroll({ currentTarget: scrollBodyRef.current } as React.UIEvent<HTMLDivElement>);
    }
  };

  const onFullTableResize = ({ width }) => {
    // console.log(width);
    triggerOnScroll();
    // setComponentWidth(fullTableRef.current ? fullTableRef.current.offsetWidth : width);
    setComponentWidth(scroll?.x ? Number(scroll.x) : width);
  };

  // Sync scroll bar when init or `horizonScroll` changed
  React.useEffect(() => triggerOnScroll, []);
  React.useEffect(() => {
    if (horizonScroll) {
      triggerOnScroll();
    }
  }, [horizonScroll]);

  // eslint-disable-next-line consistent-return
  React.useEffect(() => {
    if (fixColumn) {
      handleWindowResize();
      const resizeEvent = addEventListener(window, 'resize', debouncedWindowResize);
      return () => {
        resizeEvent.remove();
      }
    }
  }, [])


  // ================== INTERNAL HOOKS ==================
  React.useEffect(() => {
    if (internalHooks === INTERNAL_HOOKS && internalRefs) {
      internalRefs.body.current = scrollBodyRef.current;
    }
  });


  // vertical scroll
  React.useEffect(() => {
    if (isSticky) {
      const scrollVertical = () => {
        const { top } = scrollBodyRef.current.getBoundingClientRect();
        setScrollTop(-top);
      }
      window.addEventListener('scroll', scrollVertical);
      return () => {
        window.removeEventListener('scroll', scrollVertical)
      }
    }
    return undefined;
  }, [])

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
      return scroll.x === 'max-content' ? 'auto' : 'fixed';
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
    />
  );

  const bodyColGroup = (
    <ColGroup colWidths={flattenColumns.map(({ width }) => width)} columns={flattenColumns} />
  );

  const footerTable = summary && <Footer>{summary(mergedData)}</Footer>;
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

  if (fixHeader || isSticky) {
    let bodyContent: React.ReactNode;

    if (typeof customizeScrollBody === 'function') {
      bodyContent = customizeScrollBody(mergedData, {
        scrollbarSize,
        ref: scrollBodyRef,
        onScroll,
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
            {bodyTable}
            {footerTable}
          </TableComponent>

          {isSticky && (
            <StickyScrollBar
              ref={stickyRef}
              offsetScroll={offsetScroll}
              scrollBodyRef={scrollBodyRef}
              onScroll={onScroll}
            />
          )}
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
          {footerTable}
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
      flattenColumns: fixLeftColumns,
      componentWidth: fixLeftColumns.map(c => Number(c.width) || 0).reduce((a, b) => a + b, 0) + (expandedRowRender ? 60 : 0),
      fixed: 'left',
    }
  };

  const BodyContextValueOnlyFixedRightColumns = {
    ...BodyContextValue, ...{
      columns: fixRightColumns,
      flattenColumns: fixRightColumns,
      componentWidth: fixRightColumns.map(c => Number(c.width) || 0).reduce((a, b) => a + b, 0),
      fixed: 'right',
    }
  };


  const renderLeftFixedTable = () => {
    // console.log(BodyContextValueOnlyFixedLeftColumns);
    // console.log(scrollTableStyle);
    let groupTableNodeLeft: React.ReactNode;
    const bodyColGroupLeft = (
      <ColGroup colWidths={BodyContextValueOnlyFixedLeftColumns.flattenColumns.map(({ width }) => width)} columns={BodyContextValueOnlyFixedLeftColumns.flattenColumns} />
    );

    if (fixHeader || isSticky) {
      const bodyContent = (
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
            {bodyColGroupLeft}
            {bodyTable}
            {footerTable}
          </TableComponent>

          {isSticky && (
            <StickyScrollBar
              ref={stickyRef}
              offsetScroll={offsetScroll}
              scrollBodyRef={scrollBodyRef}
              onScroll={onScroll}
            />
          )}
        </div>
      );

      groupTableNodeLeft = (
        <div
          style={{
            ...scrollXStyle,
            ...scrollYStyle,
          }}
          className={classNames(`${prefixCls}-content`)}
          onScroll={onScroll}
        >
          <div className={classNames(`${prefixCls}-fixed-left`)}>
            {/* Header Table */}
            {showHeader !== false && (
              <FixedHeader
                noData={!mergedData.length}
                {...headerProps}
                // {...columnContext}
                columns={fixLeftColumns}
                flattenColumns={fixLeftColumns}
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
      >
        <div className={classNames(`${prefixCls}-fixed-left`)}>
          <TableComponent style={{ tableLayout: mergedTableLayout, width: BodyContextValueOnlyFixedLeftColumns.componentWidth }}>
            {bodyColGroupLeft}
            {showHeader !== false && <Header fixed="left" {...headerProps} columns={fixLeftColumns} flattenColumns={fixLeftColumns} />}
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
    // console.log(BodyContextValueOnlyFixedLeftColumns);
    const bodyColGroupRight = (
      <ColGroup colWidths={BodyContextValueOnlyFixedRightColumns.flattenColumns.map(({ width }) => width)} columns={BodyContextValueOnlyFixedRightColumns.flattenColumns} />
    );
    return <BodyContext.Provider value={BodyContextValueOnlyFixedRightColumns}>
      <div
        style={{
          ...scrollXStyle,
          ...scrollYStyle,
        }}
        className={classNames(`${prefixCls}-content`)}
        onScroll={onScroll}
      >
        <div className={classNames(`${prefixCls}-fixed-right`)}>
          <TableComponent style={{ tableLayout: mergedTableLayout, width: BodyContextValueOnlyFixedRightColumns.componentWidth }}>
            {bodyColGroupRight}
            {showHeader !== false && <Header fixed="right" {...headerProps} columns={fixRightColumns} flattenColumns={fixRightColumns} />}
            {bodyTable}
            {footerTable}
          </TableComponent>
        </div>

      </div>
    </BodyContext.Provider>
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
          props={{ ...props, mergedExpandedKeys }}
        >
          {title && <Panel className={`${prefixCls}-title`}>{title(mergedData)}</Panel>}
          <div className={`${prefixCls}-container`}>
            <>
              {renderMainTable()}
              {fixLeftColumns.length > 0 && renderLeftFixedTable()}
              {fixRightColumns.length > 0 && renderRightFixedTable()}
            </>
          </div>
          {footer && <Panel className={`${prefixCls}-footer`}>{footer(mergedData)}</Panel>}
        </MemoTableContent>
      </Provider>
    </div>
  );

  if (horizonScroll) {
    fullTable = <ResizeObserver onResize={onFullTableResize}>{fullTable}</ResizeObserver>;
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
      scrollTop,
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
      scrollTop,
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
