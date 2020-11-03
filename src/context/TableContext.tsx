import * as React from 'react';
import { GetComponent } from '../interface';
// import { FixedInfo } from '../utils/fixUtil';

export interface TableContextProps {
  // Table context
  prefixCls: string;

  getComponent: GetComponent;

  scrollbarSize: number;

  direction: 'ltr' | 'rtl';

  // fixedInfoList: FixedInfo[];

  isSticky: boolean;

  scrollTop: number;
}

const TableContext = React.createContext<TableContextProps>(null);

export default TableContext;
