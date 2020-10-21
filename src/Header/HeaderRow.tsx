import * as React from 'react';
import classNames from 'classnames'
import Cell from '../Cell';
import {
  CellType,
  // StickyOffsets,
  ColumnType,
  CustomizeComponent,
  GetComponentProps,
} from '../interface';
import TableContext from '../context/TableContext';
// import { getCellFixedInfo } from '../utils/fixUtil';
import { getColumnsKey } from '../utils/valueUtil';
import BodyContext from '../context/BodyContext';

export interface RowProps<RecordType> {
  cells: CellType<RecordType>[];
  // stickyOffsets: StickyOffsets;
  flattenColumns: ColumnType<RecordType>[];
  rowComponent: CustomizeComponent;
  cellComponent: CustomizeComponent;
  onHeaderRow: GetComponentProps<ColumnType<RecordType>[]>;
  index: number;
  height: number| string| null;
}

function HeaderRow<RecordType>({
  cells,
  rowComponent: RowComponent,
  cellComponent: CellComponent,
  onHeaderRow,
  index,
  height,
}: RowProps<RecordType>) {
  const { prefixCls } = React.useContext(TableContext);
  const { fixed } = React.useContext(BodyContext);

  let rowProps: React.HTMLAttributes<HTMLElement>;
  if (onHeaderRow) {
    rowProps = onHeaderRow(
      cells.map(cell => cell.column),
      index,
    );
  }

  const columnsKey = getColumnsKey(cells.map(cell => cell.column));

  return (
    <RowComponent {...rowProps} style={{ height }}>
      {cells.map((cell: CellType<RecordType>, cellIndex) => {
        const { column } = cell;
        let additionalProps: React.HTMLAttributes<HTMLElement>;
        if (column && column.onHeaderCell) {
          additionalProps = cell.column.onHeaderCell(column);
        }

        // 隐藏掉底部的fixed列
        const shouldHidden = column.fixed && !fixed;

        return (
          <Cell
            {...cell}
            ellipsis={column.ellipsis}
            className={classNames({[`${prefixCls}-fixed-columns-in-body`]: shouldHidden})}
            align={column.align}
            component={CellComponent}
            prefixCls={prefixCls}
            key={columnsKey[cellIndex]}
            additionalProps={additionalProps}
            rowType="header"
          />
        );
      })}
    </RowComponent>
  );
}

HeaderRow.displayName = 'HeaderRow';

export default HeaderRow;
