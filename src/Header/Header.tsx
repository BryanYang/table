import * as React from 'react';
import { connect } from 'mini-store'
import {
  ColumnsType,
  CellType,
  // StickyOffsets,
  ColumnType,
  GetComponentProps,
  ColumnGroupType,
  TableStoreState,
  DefaultRecordType,
} from '../interface';
import HeaderRow from './HeaderRow';
import TableContext from '../context/TableContext';

function parseHeaderRows<RecordType>(
  rootColumns: ColumnsType<RecordType>,
): CellType<RecordType>[][] {
  const rows: CellType<RecordType>[][] = [];

  function fillRowCells(
    columns: ColumnsType<RecordType>,
    colIndex: number,
    rowIndex: number = 0,
  ): number[] {
    // Init rows
    rows[rowIndex] = rows[rowIndex] || [];

    let currentColIndex = colIndex;
    const colSpans: number[] = columns.filter(Boolean).map(column => {
      const cell: CellType<RecordType> = {
        key: column.key,
        className: column.className || '',
        children: column.title,
        column,
        colStart: currentColIndex,
      };

      let colSpan: number = 1;

      const subColumns = (column as ColumnGroupType<RecordType>).children;
      if (subColumns && subColumns.length > 0) {
        colSpan = fillRowCells(subColumns, currentColIndex, rowIndex + 1).reduce(
          (total, count) => total + count,
          0,
        );
        cell.hasSubColumns = true;
      }

      if ('colSpan' in column) {
        ({ colSpan } = column);
      }

      if ('rowSpan' in column) {
        cell.rowSpan = column.rowSpan;
      }

      cell.colSpan = colSpan;
      cell.colEnd = cell.colStart + colSpan - 1;
      rows[rowIndex].push(cell);

      currentColIndex += colSpan;

      return colSpan;
    });

    return colSpans;
  }

  // Generate `rows` cell data
  fillRowCells(rootColumns, 0);

  // Handle `rowSpan`
  const rowCount = rows.length;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    rows[rowIndex].forEach(cell => {
      if (!('rowSpan' in cell) && !cell.hasSubColumns) {
        // eslint-disable-next-line no-param-reassign
        cell.rowSpan = rowCount - rowIndex;
      }
    });
  }

  return rows;
}

export interface HeaderProps<RecordType> {
  columns: ColumnsType<RecordType>;
  flattenColumns: ColumnType<RecordType>[];
  // stickyOffsets: StickyOffsets;
  onHeaderRow: GetComponentProps<ColumnType<RecordType>[]>;
  fixed?: string | number;
  heightFun?: (rows: CellType<DefaultRecordType>[][]) => string | null | number;
}

function Header<RecordType>({
  // stickyOffsets,
  columns,
  flattenColumns,
  onHeaderRow,
  heightFun,
}: HeaderProps<RecordType>): React.ReactElement {
  const { prefixCls, getComponent, scrollTop } = React.useContext(TableContext);
  const rows: CellType<RecordType>[][] = React.useMemo(() => parseHeaderRows(columns), [columns]);
  const height = heightFun(rows);

  const WrapperComponent = getComponent(['header', 'wrapper'], 'thead');
  const trComponent = getComponent(['header', 'row'], 'tr');
  const thComponent = getComponent(['header', 'cell'], 'th');
  
  // const styles = scrollTop > 0 ? {
  //   transform: `translateY(${scrollTop}px)`
  // } : undefined;

  // console.log(scrollTop);
  return (
    <WrapperComponent className={`${prefixCls}-thead`} >
      {rows.map((row, rowIndex) => {
        const rowNode = (
          <HeaderRow
            key={rowIndex}
            flattenColumns={flattenColumns}
            cells={row}
            // stickyOffsets={stickyOffsets}
            rowComponent={trComponent}
            cellComponent={thComponent}
            onHeaderRow={onHeaderRow}
            index={rowIndex}
            height={height}
          />
        );

        return rowNode;
      })}
    </WrapperComponent>
  );
}

function getRowHeight(state: TableStoreState, props: HeaderProps<DefaultRecordType>, rows: CellType<DefaultRecordType>[][]) {
  const { fixedColumnsHeadRowsHeight } = state;
  const { columns, fixed } = props;
  const headerHeight = fixedColumnsHeadRowsHeight[0];

  if (!fixed) {
    return null;
  }

  if (headerHeight && columns) {
    if (headerHeight === 'auto') {
      return 'auto';
    }
    return headerHeight / rows.length;
  }
  return null;
}

function getRowHeightFun (state: TableStoreState, props: HeaderProps<DefaultRecordType>) {
  return (rows: CellType<DefaultRecordType>[][]) => getRowHeight(state, props, rows);
}



export default connect((state: TableStoreState, props: HeaderProps<DefaultRecordType>) => ({
  heightFun: getRowHeightFun(state, props)
}))(Header);

// export default Header;
