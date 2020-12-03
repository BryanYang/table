import * as React from 'react';
import Empty from '../empty';
import { ConfigConsumer, ConfigConsumerProps } from '.';

const renderEmpty = (componentName?: string): React.ReactNode => (
  <ConfigConsumer>
    {({ getPrefixCls }: ConfigConsumerProps) => {
      const prefix = getPrefixCls('empty');

      switch (componentName) {
        case 'Table':
        case 'List':
          return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}>暂无数据</Empty>;

        case 'Select':
        case 'TreeSelect':
        case 'Cascader':
        case 'Transfer':
        case 'Mentions':
          return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} className={`${prefix}-small`} />;
        default:
          return <Empty />;
      }
    }}
  </ConfigConsumer>
);

export type RenderEmptyHandler = typeof renderEmpty;

export default renderEmpty;
