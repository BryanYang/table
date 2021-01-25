import React from 'react';
import Table from '../src';
import '../assets/index.less';

const columns = [
  { title: 'title1', dataIndex: 'a', key: 'a', width: 100, fixed: 'left' },
  { id: '123', title: 'title2', dataIndex: 'b', key: 'b' },
  { title: 'title3', dataIndex: 'c', key: 'c' },
  {
    title: 'Operations',
    dataIndex: '',
    key: 'd',
    fixed: 'right',
    render() {
      return <a href="#">Operations</a>;
    },
  },
];

const data = [];

const Demo = () => (
  <div>
    <Table columns={columns} data={data} />
    <br />
    <Table columns={columns} data={data} emptyText="customize!!" />
    <br />
    <Table columns={columns} data={data} emptyText={() => <h1>No No No!</h1>} />
  </div>
);

export default Demo;
