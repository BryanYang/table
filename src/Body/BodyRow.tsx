import * as React from 'react';
import classNames from 'classnames';
import { connect } from 'mini-store';
import Cell from '../Cell';
import TableContext from '../context/TableContext';
import BodyContext from '../context/BodyContext';
import { getColumnsKey } from '../utils/valueUtil';
import { ColumnType, CustomizeComponent, GetComponentProps, Key, GetRowKey, TableStoreState, TableStore, DefaultRecordType, RowHoverEventHandler, } from '../interface';
import ExpandedRow from './ExpandedRow';

export interface BodyRowProps<RecordType> {
  record: RecordType;
  index: number;
  className?: string;
  style?: React.CSSProperties;
  heightFun?: (fixed?: boolean | string) => null | {
    height: number | undefined;
    expandedRowsHeight: number | undefined;
  };
  recordKey: Key;
  expandedKeys: Set<Key>;
  rowComponent: CustomizeComponent;
  cellComponent: CustomizeComponent;
  onRow: GetComponentProps<RecordType>;
  rowExpandable: (record: RecordType) => boolean;
  indent?: number;
  rowKey: React.Key;
  getRowKey: GetRowKey<RecordType>;
  childrenColumnName: string;
  ancestorKeys?: Key[];
  store?: TableStore;
  hovered?: boolean;
  onHover?: RowHoverEventHandler;
}

function BodyRow<RecordType extends { children?: RecordType[] }>(props: BodyRowProps<RecordType>) {
  const {
    className,
    style,
    record,
    index,
    rowKey,
    getRowKey,
    rowExpandable,
    expandedKeys,
    onRow,
    indent = 0,
    rowComponent: RowComponent,
    cellComponent,
    childrenColumnName,
    heightFun,
    store,
    hovered,
    onHover,
  } = props;
  const { prefixCls } = React.useContext(TableContext);
  const {
    fixHeader,
    fixColumn,
    horizonScroll,
    componentWidth,
    flattenColumns,
    expandableType,
    expandRowByClick,
    onTriggerExpand,
    rowClassName,
    expandedRowClassName,
    indentSize,
    expandIcon,
    expandedRowRender,
    expandIconColumnIndex,
    fixed,
  } = React.useContext(BodyContext);
  const [expandRended, setExpandRended] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>();

  const expanded = expandedKeys && expandedKeys.has(props.recordKey);

  const setExpandedRowHeight = React.useCallback(() => {
    if (store && ref.current) {
      let { expandedRowsHeight } = store.getState();
      const { height } = ref.current.getBoundingClientRect();
      expandedRowsHeight = {
        ...expandedRowsHeight,
        [`${rowKey}-extra-row`]: height,
      };
      store.setState({ expandedRowsHeight });
    }
  }, [])

  React.useEffect(() => {
    if (expanded) {
      setExpandRended(true);
    }
    if (!fixColumn) {
      return;
    }

    if (!fixed && expanded) {
      setExpandedRowHeight();
    }

    // 这是子table情况？
    // if (!fixed && ancestorKeys.length >= 0) {
    //   this.setRowHeight();
    // }

  }, [expanded]);

  const rowSupportExpand = expandableType === 'row' && (!rowExpandable || rowExpandable(record));
  // Only when row is not expandable and `children` exist in record
  const nestExpandable = expandableType === 'nest';
  const hasNestChildren = childrenColumnName && record && record[childrenColumnName];
  const mergedExpandable = rowSupportExpand || nestExpandable;

  // =========================== onRow ===========================
  let additionalProps: React.HTMLAttributes<HTMLElement>;
  if (onRow) {
    additionalProps = onRow(record, index);
  }

  const onClick: React.MouseEventHandler<HTMLElement> = (event, ...args) => {
    if (expandRowByClick && mergedExpandable) {
      onTriggerExpand(record, event);
    }

    if (additionalProps && additionalProps.onClick) {
      additionalProps.onClick(event, ...args);
    }
  };
  
  const onMouseEnter: React.MouseEventHandler<HTMLElement> = React.useCallback((event, ...args) => {
    if (additionalProps?.onMouseEnter) {
      additionalProps.onMouseEnter(event, ...args);
    }
    onHover?.(true, rowKey)
  }, [rowKey]);

  const onMouseLeave: React.MouseEventHandler<HTMLElement> = React.useCallback((event, ...args) => {
    if (additionalProps?.onMouseLeave) {
      additionalProps.onMouseLeave(event, ...args);
    }
    onHover?.(false, '');
  }, []);

  // ======================== Base tr row ========================
  let computeRowClassName: string;
  if (typeof rowClassName === 'string') {
    computeRowClassName = rowClassName;
  } else if (typeof rowClassName === 'function') {
    computeRowClassName = rowClassName(record, index, indent);
  }

  const columnsKey = getColumnsKey(flattenColumns);

  const { height, expandedRowsHeight } = heightFun(fixed) || {};

  const baseRowNode = (
    <RowComponent
      {...additionalProps}
      data-row-key={rowKey}
      className={classNames(
        className,
        `${prefixCls}-row`,
        `${prefixCls}-row-level-${indent}`,
        computeRowClassName,
        additionalProps && additionalProps.className,
        hovered && `${prefixCls}-row-hover`,
      )}
      style={{
        height,
        ...style,
        ...(additionalProps ? additionalProps.style : null),
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {flattenColumns.map((column: ColumnType<RecordType>, colIndex) => {
        const { render, dataIndex, className: columnClassName } = column;

        // 隐藏掉下方主table的fixed列
        const shouldHidden = column.fixed && !fixed;

        const key = columnsKey[colIndex];
        // const fixedInfo = fixedInfoList[colIndex];

        // ============= Used for nest expandable =============
        let appendCellNode: React.ReactNode;
        if (colIndex === (expandIconColumnIndex || 0) && nestExpandable) {
          appendCellNode = (
            <>
              <span
                style={{ paddingLeft: `${indentSize * indent}px` }}
                className={`${prefixCls}-row-indent indent-level-${indent}`}
              />
              {expandIcon({
                prefixCls,
                expanded,
                expandable: hasNestChildren,
                record,
                onExpand: onTriggerExpand,
              })}
            </>
          );
        }

        let additionalCellProps: React.HTMLAttributes<HTMLElement>;
        if (column.onCell) {
          additionalCellProps = column.onCell(record, index);
        }

        return (
          <Cell
            className={classNames(columnClassName, { [`${prefixCls}-fixed-columns-in-body`]: shouldHidden })}
            ellipsis={column.ellipsis}
            align={column.align}
            component={cellComponent}
            prefixCls={prefixCls}
            key={key}
            record={record}
            index={index}
            dataIndex={dataIndex}
            render={render}
            shouldCellUpdate={column.shouldCellUpdate}
            appendNode={appendCellNode}
            additionalProps={additionalCellProps}
          />
        );
      })}
    </RowComponent>
  );

  // ======================== Expand Row =========================
  let expandRowNode: React.ReactElement;
  if (rowSupportExpand && (expandRended || expanded)) {
    const expandContent = expandedRowRender(record, index, indent + 1, expanded);
    const computedExpandedRowClassName =
      expandedRowClassName && expandedRowClassName(record, index, indent);
    expandRowNode = (
      <ExpandedRow
        expanded={expanded}
        className={classNames(
          `${prefixCls}-expanded-row`,
          `${prefixCls}-expanded-row-level-${indent + 1}`,
          computedExpandedRowClassName,
        )}
        prefixCls={prefixCls}
        fixHeader={fixHeader}
        fixColumn={fixColumn}
        horizonScroll={horizonScroll}
        component={RowComponent}
        componentWidth={componentWidth}
        cellComponent={cellComponent}
        style={{ height: expandedRowsHeight }}
        colSpan={flattenColumns.length}
        ref={ref}
      >
        {expandContent}
      </ExpandedRow>
    );
  }

  // ========================= Nest Row ==========================
  let nestRowNode: React.ReactElement[];
  if (hasNestChildren && expanded) {
    nestRowNode = (record[childrenColumnName] || []).map(
      (subRecord: RecordType, subIndex: number): React.ReactElement => {
        const subKey = getRowKey(subRecord, subIndex);

        return (
          <BodyRow
            {...props}
            key={subKey}
            rowKey={subKey}
            record={subRecord}
            recordKey={subKey}
            index={subIndex}
            indent={indent + 1}
          />
        );
      },
    );
  }

  return (
    <>
      {baseRowNode}
      {expandRowNode}
      {nestRowNode}
    </>
  );
}

BodyRow.displayName = 'BodyRow';

function getRowHeight(state: TableStoreState, props: BodyRowProps<DefaultRecordType>, fixed?: string | boolean) {
  const { expandedRowsHeight = {}, fixedColumnsBodyRowsHeight } = state;
  const { rowKey } = props;

  if (!fixed) {
    return null;
  }

  // console.log(fixedColumnsBodyRowsHeight);

  return {
    height: fixedColumnsBodyRowsHeight[rowKey],
    expandedRowsHeight: expandedRowsHeight[`${rowKey}-extra-row`]
  }
}

function getRowHeightFun(state: TableStoreState, props: BodyRowProps<DefaultRecordType>) {
  return (fixed?: string | boolean) => getRowHeight(state, props, fixed);
}


export default connect((state: TableStoreState, props: BodyRowProps<DefaultRecordType>) => {
  const { currentHoverKey, expandedRowKeys } = state;
  const { rowKey, ancestorKeys = [] } = props;

  const visible = ancestorKeys.length === 0 || ancestorKeys.every(k => expandedRowKeys.includes(k));

  return {
    visible,
    hovered: currentHoverKey === rowKey,
    heightFun: getRowHeightFun(state, props),
  };
})(BodyRow)

// export default BodyRow;
