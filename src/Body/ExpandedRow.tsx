import * as React from 'react';
import { CustomizeComponent } from '../interface';
import Cell from '../Cell';
import TableContext from '../context/TableContext';

export interface ExpandedRowProps<RecordType> {
  prefixCls: string;
  component: CustomizeComponent;
  cellComponent: CustomizeComponent;
  fixHeader: boolean;
  fixColumn: boolean;
  horizonScroll: boolean;
  componentWidth: number;
  className: string;
  expanded: boolean;
  children: React.ReactNode;
  colSpan: number;
  ref?: React.RefAttributes<any>;
  style?: React.CSSProperties;
}

function ExpandedRow<RecordType>({
  prefixCls,
  children,
  component: Component,
  cellComponent,
  fixHeader,
  fixColumn,
  horizonScroll,
  className,
  expanded,
  componentWidth,
  colSpan,
  style,
}: ExpandedRowProps<RecordType>, ref) {
  const { scrollbarSize } = React.useContext(TableContext);
  const { height } = style || {};
  // Cache render node
  return React.useMemo(() => {
    let contentNode = children;

    if (fixColumn) {
      contentNode = (
        <div
          style={{
            width: componentWidth - (fixHeader ? scrollbarSize : 0),
            // position: 'sticky',
            // left: 0,
            overflow: 'hidden',
          }}
          className={`${prefixCls}-expanded-row-fixed`}
        >
          {contentNode}
        </div>
      );
    }

    // console.log(style);
    return (
      <Component
        className={className}
        ref={ref}
        style={{
          display: expanded ? null : 'none',
          ...style,
        }}
      >
        <Cell component={cellComponent} prefixCls={prefixCls} colSpan={colSpan}>
          {contentNode}
        </Cell>
      </Component>
    );
  }, [
    children,
    Component,
    fixHeader,
    horizonScroll,
    className,
    expanded,
    componentWidth,
    colSpan,
    scrollbarSize,
    height,
  ]);
}

export default React.forwardRef(ExpandedRow);
