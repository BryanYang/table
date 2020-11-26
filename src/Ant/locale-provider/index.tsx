import * as React from 'react';

import { PaginationLocale } from '../pagination/Pagination';
import { TableLocale } from '../table/interface';
import LocaleContext from './context';
export const ANT_MARK = 'internalMark';

export interface Locale {
  locale: string;
  Pagination?: PaginationLocale;
  Select?: Object;
  global?: Object;
  Table?: TableLocale,
}

export interface LocaleProviderProps {
  locale: Locale;
  children?: React.ReactNode;
  _ANT_MARK__?: string;
}

export default class LocaleProvider extends React.Component<LocaleProviderProps, any> {
  static defaultProps = {
    locale: {},
  };

  constructor(props: LocaleProviderProps) {
    super(props);

    console.log(
      props._ANT_MARK__ === ANT_MARK,
      'LocaleProvider',
      '`LocaleProvider` is deprecated. Please use `locale` with `ConfigProvider` instead: http://u.ant.design/locale',
    );
  }

  componentWillUnmount() {
  }

  render() {
    const { locale, children } = this.props;

    return (
      <LocaleContext.Provider value={{ ...locale, exist: true }}>{children}</LocaleContext.Provider>
    );
  }
}
