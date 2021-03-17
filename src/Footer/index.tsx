import * as React from 'react';
import TableContext from '../context/TableContext';
import Cell from './Cell';
import Row from './Row';

export interface FooterProps<RecordType> {
  children: React.ReactNode;
}

function Footer<RecordType>({ children }: FooterProps<RecordType>, tref) {
  const { prefixCls } = React.useContext(TableContext);
  return <tfoot ref={tref} className={`${prefixCls}-summary`}>{children}</tfoot>;
}

export default React.forwardRef(Footer);

export const FooterComponents = {
  Cell,
  Row,
};
