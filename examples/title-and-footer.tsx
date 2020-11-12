/* eslint-disable no-param-reassign */
import React from 'react';
import Table from '../src';
import { useCheckbox } from './utils/useInput';
import '../assets/index.less';
import { ColumnType } from '../src/interface';

interface RecordType {
  a: sTring;
  b?: sTring;
  c?: sTring;
  d?: number;
  value?: number;
  value2?: number;
  key: sTring;
}

const data: RecordType[] = [
  { a: '123', key: '1' },
  { a: 'cdd', b: 'edd', key: '2' },
  { a: 'cdd', b: 'edd', key: '4' },
  { a: 'cdd', b: 'edd', key: '5' },
  { a: 'cdd', b: 'edd', key: '6' },
  { a: 'cdd', b: 'edd', key: '7' },
  { a: 'cdd', b: 'edd', key: '8' },
  { a: 'cdd', b: 'edd', key: '9' },
  { a: 'cdd', b: 'edd', key: '10' },
  { a: 'cdd', b: 'edd', key: '11' },
  { a: 'cdd', b: 'edd', key: '12' },
  { a: 'cdd', b: 'edd', key: '13' },
  { a: 'cdd', b: 'edd', key: '14' },
  { a: '1333', c: 'eee', d: 2, key: '3' },
];

data.forEach((item, index) => {
  item.value = index * 3 + 7;
  item.value2 = index * 7 + 5;
});

function useColumns(fixColumns: boolean): ColumnType<RecordType>[] {
  return [
    { title: 'title1', dataIndex: 'a', key: 'a', width: 100, fixed: fixColumns ? 'left' : null },
    { title: 'title2', dataIndex: 'b', key: 'b', width: 100 },
    { title: 'title3', dataIndex: 'c', key: 'c', width: 200 },
    { title: 'value', dataIndex: 'value' },
    { title: 'value2', dataIndex: 'value2' },
    {
      title: 'Operations',
      dataIndex: '',
      key: 'd',
      render() {
        return <a href="#">Operations</a>;
      },
    },
  ];
}

const Demo = () => {
  const [fixColumns, fixColumnsProps] = useCheckbox(false);

  const columns = useColumns(fixColumns);

  return (
    <div>
      <h2>title and footer</h2>
      <label>
        <input {...fixColumnsProps} />
        Fix Columns
      </label>
      <Table<RecordType>
        columns={columns}
        data={data}
        scroll={{ x: fixColumns ? 2000 : null }}
        // title={currentData => <div>Title: {currentData.length} items</div>}
        sticky
        // footer={currentData => <div>Footer: {currentData.length} items</div>}
        summary={(currentData, Tr, Td) => (
          <>
            {/* <Tr rowKey="1">
              <th style={{background: '#f7f7f7'}} colSpan={6}>Summary</th>
            </Tr> */}
            <Tr rowKey="2">
              <Td>-</Td>
              <Td>大开发卡戴珊开发局阿卡丽圣诞节疯狂拉圣诞节快乐非建安克鲁赛德是的咖啡机克鲁赛德就</Td>
              <Td>-</Td>
              <Td>{currentData.reduce((total, item) => total + item.value, 0)}</Td>
              <Td>{currentData.reduce((total, item) => total + item.value2, 0)}</Td>
              <Td>-</Td>
            </Tr>
          </>
        )}
      />
      <div style={{height: 400}}></div>
    </div>
  );
};

export default Demo;
/* eslint-enable */
