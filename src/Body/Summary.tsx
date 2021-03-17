import * as React from 'react';
import { connect } from 'mini-store'
import TableContext from '../context/TableContext';
import BodyContext from '../context/BodyContext'
import { TableStoreState, DefaultRecordType } from '../interface';



const Td = (props: { children: React.ReactChild, style?: React.CSSProperties }) => {
  // const { fixed, columns } = React.useContext(BodyContext);
  // if (fixed) {
  //   console.log(columns);
  // }
  return <td {...props}>{props.children}</td>;
}


export interface TrComProps<T> {
  children: React.ReactNode, 
  rowKey: string, 
  style?: React.CSSProperties,
  heightFun?: (fixed?: boolean | string) => number | undefined;
}

const SummaryPrefix = 'table_summary_';

const getRowKey = (key: string) =>  `${SummaryPrefix}${key}`;

const TrCom: React.FC<TrComProps<DefaultRecordType>> = (props) => {
  const { rowKey, style: sttyle, children, heightFun } = props;

  const { prefixCls } = React.useContext(TableContext);
  const { fixed, columns } = React.useContext(BodyContext);

  const height = heightFun(fixed);
  const style= {
    ...sttyle,
    height,
  }
  return <tr  data-row-key={getRowKey(rowKey)} className={`${prefixCls}-row`}  style={style}>{
    fixed ? React.Children.toArray(children).slice(0, columns.length) : children
  }</tr>;
}



function getRowHeight(state: TableStoreState, props: TrComProps<DefaultRecordType>, fixed?: string | boolean) {
  const { fixedColumnsBodyRowsHeight } = state;
  const { rowKey } = props;

  if (!fixed) {
    return null;
  }
  return fixedColumnsBodyRowsHeight[getRowKey(rowKey)]
}

function getRowHeightFun(state: TableStoreState, props: TrComProps<DefaultRecordType>) {
  return (fixed?: string | boolean) => getRowHeight(state, props, fixed);
}


const Tr = connect((state: TableStoreState, props: TrComProps<DefaultRecordType>) => {
  const { currentHoverKey } = state;
  const { rowKey } = props;

  return {
    hovered: currentHoverKey === rowKey,
    heightFun: getRowHeightFun(state, props),
  };
})(TrCom);

export {
  Tr,
  Td,
};


