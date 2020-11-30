/* eslint-disable no-console,func-names,react/no-multi-comp */
import React from 'react';
import Table from '../src/Ant/table/Table';
import '../src/Ant/table/style';

interface RecordType {
  a?: string;
  b?: string;
  c?: string;
}

const columns = [
  { title: 'title1', dataIndex: 'a', key: 'a', width: 100, fixed: 'left' as any },
  { id: '123', title: 'title2', dataIndex: 'b', key: 'b' },
  { title: 'title3', dataIndex: 'c', key: 'c',},
  { title: 'title4', dataIndex: 'c', key: 'c'},
  { title: 'title5', dataIndex: 'c', key: 'c' },
  { title: 'title6', dataIndex: 'c', key: 'c', },
  {
    title: 'Operations',
    dataIndex: '',
    width: 150,
    key: 'd',
    // fixed: 'right',
    render(_: any, record: RecordType) {
      return (
        <a
          onClick={e => {
            e.preventDefault();
            console.log('Operate on:', record);
          }}
          href="#"
        >
          Operations
        </a>
      );
    },
  },

];

const data = [
  { a: '123', key: '1' },
  { a: 'cdd', b: 'edd', c: 'hahah', key: '2' },
  { a: 's', c: 'eee', d: 2, key: '3' },
  { a: 'a', c: 'eee', d: 2, key: '4' },
  { a: 'v', c: 'eee', d: 2, key: '5' },
  { a: 's', c: 'eee', d: 2, key: '6' },
  { a: 'd', c: 'eee', d: 2, key: '7' },
  { a: 'd', c: 'eee', d: 2, key: '8' },
  { a: 'f', c: 'eee', d: 2, key: '9' },
  { a: 'h', c: 'eee', d: 2, key: '10' },
  { a: '223', c: 'eee', d: 2, key: '13' },
  { a: '1333', c: 'eee', d: 2, key: '33' },
  { a: '1333', c: 'eee', d: 2, key: '35' },
  { a: 'sdf', c: 'eee', d: 2, key: '43' },
  { a: '1333', c: 'eee', d: 2, key: '53' },
  { a: '1333', c: 'eee', d: 2, key: '63' },
  { a: '1333', c: 'eee', d: 2, key: '73' },
  { a: '1333', c: 'eee', d: 2, key: '83' },
  { a: '1333', c: 'eee', d: 2, key: '93' },
  { a: '1333', c: 'eee', d: 2, key: '103' },
  { a: '144', c: 'eee', d: 2, key: '113' },
];

const Demo = () => (
  <div>
    <h2>simple table</h2>
    <br />
    <br />
    <br />
    <br />
    <Table 
      columns={columns} 
      sticky 
      style={{ width: null }} 
      size="small" 
      scroll={{x: 1000, y: 300}}
      // summary={() => (
      //   <Table.Summary.Row style={{ background: '#fafafa' }}>
      //     <Table.Summary.Cell index={0}></Table.Summary.Cell>
      //     <Table.Summary.Cell index={1} colSpan={6}>This is a summary content</Table.Summary.Cell>
      //   </Table.Summary.Row>
      // )}
      summary={(currentData, Tr, Td) => (
        <>
          {/* <Tr rowKey="1">
            <th style={{background: '#f7f7f7'}} colSpan={6}>Summary</th>
          </Tr> */}
          <Tr rowKey="2">
            <Td>-</Td>
            <Td>大开发卡戴珊开发</Td>
            <Td>-</Td>
            <Td>{currentData.reduce((total, item) => total + item.value, 0)}</Td>
            <Td>{currentData.reduce((total, item) => total + item.value2, 0)}</Td>
            <Td>-</Td>
            <Td>-</Td>
          </Tr>
        </>
      )}
      dataSource={data} />
      <div style={{ height: 500 }}></div>
  </div>
);

export default Demo;
/* eslint-enable */
